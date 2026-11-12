// ProofLoop: mesin status alur serah terima (murni, tanpa DOM/localStorage). © 2026 Vassel Goleyu.
//
// draft ──publish──▶ ready ──start──▶ progress ──submit──▶ submitted ──approve──▶ done
//                     ▲  │                                      │
//                     │  └─publish (versi baru, siklus sama)    │revise
//                     └────────publish (siklus + 1)──── improve ◀┘
//
// Semua operasi memvalidasi dulu, baru mengubah state. Bila gagal, state tidak berubah sama sekali.

import type {
  Assist, Attempt, Ctx, Gap, Outcome, Process, ReviewNotes, Stage, State, Step, Submission, CriterionResult,
} from './types.ts';

export type StageEvent = 'publish' | 'start' | 'submit' | 'approve' | 'revise';

export const STAGES: readonly Stage[] = ['draft', 'ready', 'progress', 'submitted', 'improve', 'done'];
export const EVENTS: readonly StageEvent[] = ['publish', 'start', 'submit', 'approve', 'revise'];

/** Tabel transisi: stage saat ini → event → stage berikutnya. Selain ini, transisi terlarang. */
export const TRANSITIONS: Readonly<Record<Stage, Partial<Record<StageEvent, Stage>>>> = {
  draft: { publish: 'ready' },
  ready: { publish: 'ready', start: 'progress' },
  progress: { submit: 'submitted' },
  submitted: { approve: 'done', revise: 'improve' },
  improve: { publish: 'ready' },
  done: {},
};

export function nextStage(stage: Stage, event: StageEvent): Stage | null {
  return TRANSITIONS[stage]?.[event] ?? null;
}

export function canTransition(from: Stage, to: Stage): boolean {
  return Object.values(TRANSITIONS[from] ?? {}).includes(to);
}

/** Panduan boleh disunting hanya saat draf, siap, atau perbaikan. */
export function isGuideEditable(stage: Stage): boolean {
  return stage === 'draft' || stage === 'ready' || stage === 'improve';
}

export type ErrorCode = 'not_found' | 'forbidden_transition' | 'forbidden_actor' | 'invalid_input';
export type Failure = { ok: false; code: ErrorCode; errors: string[] };
export type Result<T> = ({ ok: true } & T) | Failure;

const fail = (code: ErrorCode, ...errors: string[]): Failure => ({ ok: false, code, errors });

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

/* ---------- selektor ---------- */

export const getProcess = (s: State, id: string): Process | undefined => s.processes.find((p) => p.id === id);
export const getAttempt = (s: State, id: string): Attempt | undefined => s.attempts.find((a) => a.id === id);
export const memberName = (s: State, id: string): string => s.members.find((m) => m.id === id)?.name ?? '-';
const isAdmin = (s: State, id: string): boolean => !!s.members.find((m) => m.id === id)?.roles.includes('Administrator');

export function getGuide(s: State, pid: string) {
  return (s.guides[pid] ??= { draft: [], versions: [] });
}

export function currentVersion(s: State, pid: string) {
  const v = getGuide(s, pid).versions;
  return v.length ? v[v.length - 1]! : null;
}

export function nextVersion(s: State, pid: string): string {
  const cur = currentVersion(s, pid);
  if (!cur) return '1.0';
  const [a, b] = cur.v.split('.').map(Number);
  return `${a}.${(b ?? 0) + 1}`;
}

export function activeAttempt(s: State, p: Process): Attempt | undefined {
  return s.attempts.find((a) => a.pid === p.id && a.cycle === p.cycle && a.status !== 'reviewed');
}

/** Bantuan yang dihitung: punya penolong, belum dinyatakan tidak valid, dan tidak sedang dicoret reviewer. */
export function countedAssist(a: Attempt, dropped: Record<string, boolean> = {}): Assist[] {
  return a.assist.filter((e) => e.verified !== false && !!e.provider && !dropped[e.id]);
}

/* ---------- validasi ---------- */

export function validateSteps(steps: Step[]): string[] {
  const e: string[] = [];
  if (!steps.length) e.push('Tambahkan minimal satu langkah panduan.');
  steps.forEach((s, i) => {
    if (!s.title.trim()) e.push(`Langkah ${i + 1}: judul wajib diisi.`);
    if (!s.how.trim()) e.push(`Langkah ${i + 1}: cara melakukan langkah wajib diisi.`);
    if (!s.success.trim()) e.push(`Langkah ${i + 1}: gambaran hasil yang berhasil wajib diisi.`);
  });
  return e;
}

export function validateSubmission(s: State, a: Attempt, sub: Submission, minutes: number): string[] {
  const er: string[] = [];
  const ver = getGuide(s, a.pid).versions.find((v) => v.v === a.guideVersion);
  const steps = ver ? ver.steps : [];
  const left = steps.filter((st) => !a.doneSteps.includes(st.id));
  if (left.length) er.push(`Masih ada ${left.length} langkah yang belum ditandai selesai: ${left.map((x) => x.title).join(', ')}.`);
  const needEv = steps.filter((st) => st.needsEvidence && !hasEvidence(a, st.id));
  if (needEv.length) er.push(`Langkah berikut wajib bukti (teks atau foto): ${needEv.map((x) => x.title).join(', ')}.`);
  if (!sub.files.length && !sub.link.trim() && !sub.text.trim()) er.push('Lampirkan minimal satu bukti hasil: berkas, tautan, atau penjelasan tertulis.');
  if (sub.link.trim() && !/^https?:\/\/\S+/.test(sub.link.trim())) er.push('Tautan harus diawali http:// atau https://.');
  if (!(minutes >= 1)) er.push('Waktu pengerjaan minimal 1 menit.');
  return er;
}

export function hasEvidence(a: Attempt, stepId: string): boolean {
  const e = a.stepEvidence?.[stepId];
  return !!e && (!!e.text.trim() || !!e.photo);
}

export interface ReviewInput {
  results: Record<string, CriterionResult>;
  dropped: Record<string, boolean>;
  outcome: Outcome | '';
  reason: string;
  notes: ReviewNotes;
  minutes?: number;
}

export function suggestOutcome(p: Process, a: Attempt, results: Record<string, CriterionResult | undefined>, dropped: Record<string, boolean> = {}): Outcome {
  const failed = p.quality.filter((q) => q.mandatory).some((q) => results[q.id] === 'revision');
  if (failed) return 'belum';
  return countedAssist(a, dropped).length ? 'dengan_bantuan' : 'mandiri';
}

export function validateReview(p: Process, a: Attempt, d: ReviewInput): string[] {
  const er: string[] = [];
  if (!p.quality.every((q) => d.results[q.id])) er.push('Nilai semua kriteria kualitas.');
  if (!d.outcome) er.push('Pilih klasifikasi hasil.');
  if (!d.reason.trim()) er.push('Alasan klasifikasi wajib diisi.');
  const failed = p.quality.some((q) => q.mandatory && d.results[q.id] === 'revision');
  const help = countedAssist(a, d.dropped).length;
  if (d.outcome === 'mandiri' && failed) er.push('Hasil tidak dapat “Mandiri” karena ada kriteria wajib yang perlu revisi.');
  if (d.outcome === 'mandiri' && help) er.push('Hasil tidak dapat “Mandiri” karena masih ada bantuan langsung yang tervalidasi. Koreksi catatan bantuan bila keliru.');
  if (d.outcome === 'dengan_bantuan' && failed) er.push('Hasil tidak dapat “Dengan Bantuan” karena ada kriteria wajib yang belum terpenuhi. Pilih “Belum Berhasil”.');
  return er;
}

/* ---------- efek samping di dalam state (notifikasi, log) ---------- */

function notify(s: State, c: Ctx, to: string, type: string, title: string, body: string, route: string): void {
  if (!to) return;
  s.notifications.unshift({ id: c.uid('n'), to, type, title, body, route, read: false, at: c.now() });
}

function log(s: State, c: Ctx, who: string, text: string, route: string): void {
  s.activity.unshift({ id: c.uid('ac'), who, text, route, at: c.now() });
  s.activity = s.activity.slice(0, 60);
}

/* ---------- operasi ---------- */

export function publishGuide(s: State, c: Ctx, actorId: string, pid: string, summary?: string): Result<{ version: string }> {
  const p = getProcess(s, pid);
  if (!p) return fail('not_found', 'Proses tidak ditemukan.');
  const to = nextStage(p.stage, 'publish');
  if (!to) return fail('forbidden_transition', 'Panduan terkunci selama praktik atau peninjauan berlangsung.');
  if (actorId !== p.ownerId && !isAdmin(s, actorId)) return fail('forbidden_actor', 'Hanya pemegang pengetahuan atau administrator yang dapat menerbitkan panduan.');
  const g = getGuide(s, pid);
  const errs = validateSteps(g.draft);
  if (!p.successorId) errs.push('Tetapkan penerus terlebih dahulu.');
  if (!p.reviewerId) errs.push('Tetapkan reviewer terlebih dahulu.');
  if (errs.length) return fail('invalid_input', ...errs);

  const v = nextVersion(s, pid);
  const first = !g.versions.length;
  const solved = s.gaps.filter((x) => x.pid === pid && x.status === 'Selesai' && !x.resolvedIn);
  solved.forEach((x) => { x.resolvedIn = v; });
  g.versions.push({ v, at: c.now(), editor: actorId, summary: summary || (first ? 'Panduan awal.' : 'Pembaruan panduan.'), gapIds: solved.map((x) => x.id), steps: clone(g.draft) });

  if (p.stage === 'draft') {
    p.cycle = 1; p.draft = false;
    notify(s, c, p.successorId, 'assign', 'Penugasan baru', `Anda ditetapkan sebagai penerus untuk ${p.name}. Panduan v${v} siap digunakan.`, '#/transfer/' + pid);
  } else if (p.stage === 'improve') {
    p.cycle += 1;
    notify(s, c, p.successorId, 'ready', `Cycle ${p.cycle} siap`, `Panduan ${p.name} versi ${v} telah diperbarui. Anda dapat mengulang praktik.`, '#/transfer/' + pid);
  } else {
    notify(s, c, p.successorId, 'guide', 'Panduan diperbarui', `${p.name} kini versi ${v}.`, '#/transfer/' + pid);
  }
  p.stage = to;
  p.updatedAt = c.now();
  log(s, c, actorId, `menerbitkan panduan ${p.name} versi ${v}`, '#/proses/' + pid);
  return { ok: true, version: v };
}

export function startAttempt(s: State, c: Ctx, actorId: string, pid: string): Result<{ attempt: Attempt }> {
  const p = getProcess(s, pid);
  if (!p) return fail('not_found', 'Proses tidak ditemukan.');
  if (actorId !== p.successorId) return fail('forbidden_actor', 'Hanya penerus yang ditetapkan yang dapat memulai praktik.');
  const existing = activeAttempt(s, p);
  if (existing && p.stage === 'progress') return { ok: true, attempt: existing }; // idempoten
  if (!nextStage(p.stage, 'start')) return fail('forbidden_transition', 'Praktik hanya dapat dimulai saat panduan sudah terbit dan siap dipraktikkan.');
  const ver = currentVersion(s, pid);
  if (!ver) return fail('invalid_input', 'Belum ada versi panduan yang terbit.');
  const a: Attempt = {
    id: c.uid('at'), pid, cycle: p.cycle, guideVersion: ver.v, startedAt: c.now(), submittedAt: null, doneSteps: [], cursor: -1,
    assist: [], issues: [], submission: { files: [], link: '', text: '' }, self: {}, minutes: 0, status: 'progress', outcome: null, review: null, notes: [],
    stepEvidence: {}, comments: [],
  };
  s.attempts.push(a);
  p.stage = 'progress';
  p.updatedAt = c.now();
  notify(s, c, p.ownerId, 'guide', `Praktik Cycle ${p.cycle} dimulai`, `${memberName(s, p.successorId)} mulai mempraktikkan ${p.name}.`, '#/transfer/' + pid);
  log(s, c, actorId, `memulai praktik Cycle ${p.cycle} untuk ${p.name}`, '#/transfer/' + pid);
  return { ok: true, attempt: a };
}

export interface SubmitInput { submission: Submission; self: Record<string, boolean>; minutes: number }

export function submitAttempt(s: State, c: Ctx, actorId: string, aid: string, d: SubmitInput): Result<{ attempt: Attempt }> {
  const a = getAttempt(s, aid);
  if (!a) return fail('not_found', 'Data praktik tidak ditemukan.');
  const p = getProcess(s, a.pid);
  if (!p) return fail('not_found', 'Proses tidak ditemukan.');
  if (a.status !== 'progress' || !nextStage(p.stage, 'submit')) return fail('forbidden_transition', 'Hasil hanya dapat dikirim saat praktik sedang berjalan.');
  if (actorId !== p.successorId) return fail('forbidden_actor', 'Hanya penerus yang ditetapkan yang dapat mengirim hasil praktik.');
  const errs = validateSubmission(s, a, d.submission, d.minutes);
  if (errs.length) return fail('invalid_input', ...errs);
  Object.assign(a, { submission: d.submission, self: d.self, minutes: d.minutes, status: 'submitted', submittedAt: c.now() });
  p.stage = 'submitted';
  p.updatedAt = c.now();
  notify(s, c, p.reviewerId, 'review', 'Menunggu peninjauan', `${memberName(s, p.successorId)} mengirim hasil Cycle ${a.cycle} untuk ${p.name}.`, '#/review/' + a.id);
  log(s, c, actorId, `mengirim hasil Cycle ${a.cycle} untuk ${p.name}`, '#/transfer/' + p.id);
  return { ok: true, attempt: a };
}

export const ISSUE_KINDS: Readonly<Record<string, readonly [number, string]>> = {
  'Instruksi tidak jelas': [0, 'Perjelas instruksi pada langkah ini dengan contoh konkret.'],
  'Informasi belum tersedia': [2, 'Tambahkan informasi atau berkas yang dibutuhkan ke sumber daya langkah ini.'],
  'Saya tidak memahami proses ini': [4, 'Tambahkan konteks: tujuan langkah dan kaitannya dengan hasil akhir.'],
  'Langkah yang dijelaskan berbeda dari kondisi sebenarnya': [1, 'Perbarui langkah agar sesuai dengan kondisi sebenarnya di lapangan.'],
  'Membutuhkan bantuan orang lain': [5, 'Dokumentasikan praktik yang saat ini hanya diketahui lewat bimbingan langsung.'],
  'Kendala lainnya': [6, 'Tinjau kendala ini dan tambahkan panduan penanganannya.'],
};

export const ASSIST_TYPES: Readonly<Record<string, number>> = {
  'Klarifikasi diminta': 0, 'Demonstrasi diperlukan': 5, 'Intervensi langsung diperlukan': 3, 'Masalah tak terduga': 6, 'Sumber daya kurang': 2,
};

export const OUTCOME_LABEL: Readonly<Record<Outcome, string>> = { mandiri: 'Mandiri', dengan_bantuan: 'Dengan Bantuan', belum: 'Belum Berhasil' };

export function completeReview(s: State, c: Ctx, actorId: string, aid: string, d: ReviewInput): Result<{ outcome: Outcome; stage: Stage }> {
  const a = getAttempt(s, aid);
  if (!a) return fail('not_found', 'Data praktik tidak ditemukan.');
  const p = getProcess(s, a.pid);
  if (!p) return fail('not_found', 'Proses tidak ditemukan.');
  if (a.status !== 'submitted') return fail('forbidden_transition', 'Evaluasi hanya dapat diberikan pada hasil yang sudah dikirim dan belum direview.');
  if (!d.outcome) return fail('invalid_input', 'Pilih klasifikasi hasil.');
  const to = nextStage(p.stage, d.outcome === 'mandiri' ? 'approve' : 'revise');
  if (!to) return fail('forbidden_transition', 'Status proses tidak memungkinkan evaluasi.');
  if (actorId !== p.reviewerId) return fail('forbidden_actor', 'Hanya reviewer yang ditetapkan yang dapat menyelesaikan evaluasi.');
  const errs = validateReview(p, a, d);
  if (errs.length) return fail('invalid_input', ...errs);
  const outcome = d.outcome;

  // Hitung bantuan yang dihitung SEBELUM menandai yang dicoret, agar celah dibuat dari catatan yang sama dengan validasi.
  const counted = countedAssist(a, d.dropped);
  a.assist.forEach((e) => { if (d.dropped[e.id]) e.verified = false; });
  a.review = { id: c.uid('rv'), reviewerId: actorId, results: d.results, notes: d.notes, reason: d.reason, at: c.now() };
  a.status = 'reviewed';
  a.outcome = outcome;
  if (d.minutes) a.minutes = d.minutes;

  if (outcome !== 'mandiri') {
    const add = (stepId: string, source: Gap['source'], desc: string, evidence: string, cause: number, sug: string) =>
      s.gaps.push({ id: c.uid('g'), pid: p.id, attemptId: a.id, stepId, source, desc, evidence, cause, suggestion: sug, status: 'Baru', resolvedIn: null });
    a.issues.forEach((i) => {
      const k = ISSUE_KINDS[i.kind] ?? ISSUE_KINDS['Kendala lainnya']!;
      add(i.step, 'issue', i.text || i.kind, 'Laporan kendala penerus: ' + i.kind, k[0], k[1]);
    });
    counted.forEach((e) => add(e.step, 'assist', e.text || e.type, 'Bantuan dicatat saat praktik: ' + e.type, ASSIST_TYPES[e.type] ?? 0, 'Dokumentasikan bantuan yang diberikan sebagai instruksi tertulis pada langkah ini.'));
    p.quality.filter((q) => q.mandatory && d.results[q.id] === 'revision').forEach((q) =>
      add('', 'review', `Kriteria belum terpenuhi: ${q.text}`, 'Hasil evaluasi reviewer', 0, 'Perjelas hasil yang diharapkan dan cara memeriksanya pada langkah terkait.'));
  } else {
    p.completedAt = c.now();
  }
  p.stage = to;
  p.updatedAt = c.now();
  notify(s, c, p.successorId, 'review', `Hasil Cycle ${a.cycle} telah ditinjau`, `${p.name}: ${OUTCOME_LABEL[outcome]}.`, '#/hasil/' + p.id);
  notify(s, c, p.ownerId, 'review', 'Evaluasi selesai', outcome === 'mandiri' ? `${p.name} terverifikasi Mandiri.` : `${p.name} memerlukan perbaikan panduan.`, outcome === 'mandiri' ? '#/hasil/' + p.id : '#/perbaikan/' + p.id);
  log(s, c, actorId, `menyelesaikan evaluasi Cycle ${a.cycle} untuk ${p.name}`, '#/hasil/' + p.id);
  return { ok: true, outcome, stage: to };
}
