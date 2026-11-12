// ProofLoop: ekspor/impor panduan dan cadangan workspace (JSON, Markdown). Masukan impor dianggap tak tepercaya.
// © 2026 Vassel Goleyu.
import type { Attempt, Ctx, Process, State, Step } from '../domain/types.ts';
import { STAGES, getProcess, isGuideEditable } from '../domain/workflow.ts';
import { guideToMarkdown, markdownToGuide, MAX_STEPS, MAX_TEXT, type GuideDoc, type ParseResult } from './markdown.ts';

export const GUIDE_FORMAT = 'proofloop.guide';
export const WORKSPACE_FORMAT = 'proofloop.workspace';
export const FORMAT_VERSION = 1;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_CHARS = 600_000;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const VER_RE = /^\d{1,4}\.\d{1,4}$/;
const PHOTO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const clip = (v: unknown, max = MAX_TEXT): string => (typeof v === 'string' ? v.slice(0, max) : '');
/** Rute internal saja. Mencegah href berbahaya (mis. javascript:) dari berkas impor. */
const safeRoute = (v: unknown): string => (typeof v === 'string' && /^#\/[\w\-/?=&.%]{0,200}$/.test(v) ? v : '#/beranda');
const ints = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const OUTCOMES = ['mandiri', 'dengan_bantuan', 'belum'] as const;
const RESULTS = ['pass', 'revision', 'na'] as const;

/* ---------- ekspor panduan ---------- */

export function guideDocOf(s: State, pid: string, version: string | 'draf'): GuideDoc | null {
  const p = getProcess(s, pid);
  const g = s.guides[pid];
  if (!p || !g) return null;
  const steps = version === 'draf' ? g.draft : g.versions.find((v) => v.v === version)?.steps;
  if (!steps) return null;
  return { name: p.name, category: p.category, description: p.description, version, steps: JSON.parse(JSON.stringify(steps)) as Step[] };
}

export function guideToJson(doc: GuideDoc, exportedAt: string): string {
  return JSON.stringify({ format: GUIDE_FORMAT, formatVersion: FORMAT_VERSION, exportedAt, process: { name: doc.name, category: doc.category, description: doc.description }, version: doc.version, steps: doc.steps }, null, 2) + '\n';
}

export { guideToMarkdown };

/* ---------- impor panduan ---------- */

function cleanStep(raw: unknown, i: number, newId: () => string, warnings: string[]): Step | null {
  if (!isObj(raw)) { warnings.push(`Langkah ${i + 1} bukan objek dan dilewati.`); return null; }
  return {
    id: newId(), title: clip(raw['title'], 300), what: clip(raw['what']), why: clip(raw['why']), prepare: clip(raw['prepare']), how: clip(raw['how']),
    success: clip(raw['success']), risk: clip(raw['risk']), fallback: clip(raw['fallback']), critical: raw['critical'] === true, warning: clip(raw['warning']),
    example: clip(raw['example']), checklist: clip(raw['checklist']), decision: clip(raw['decision']),
    files: Array.isArray(raw['files']) ? raw['files'].filter((f): f is string => typeof f === 'string').slice(0, 50).map((f) => f.slice(0, 200)) : [],
    needsEvidence: raw['needsEvidence'] === true,
  };
}

/** Mengurai berkas panduan (JSON atau Markdown). Id langkah selalu dibuat baru agar tidak bentrok dengan data yang ada. */
export function parseGuideFile(text: string, newId: () => string): ParseResult<GuideDoc> {
  if (text.length > MAX_FILE_BYTES) return { ok: false, errors: ['Berkas terlalu besar.'] };
  const t = text.replace(/^\uFEFF/, '').trimStart();
  if (t.startsWith('---')) return markdownToGuide(t, newId);
  if (!t.startsWith('{')) return { ok: false, errors: ['Format tidak dikenali. Gunakan berkas .json atau .md hasil ekspor ProofLoop.'] };
  let j: unknown;
  try { j = JSON.parse(t); } catch { return { ok: false, errors: ['JSON tidak valid.'] }; }
  if (!isObj(j) || j['format'] !== GUIDE_FORMAT) return { ok: false, errors: [`Bukan berkas panduan ProofLoop (format “${GUIDE_FORMAT}” diharapkan).`] };
  if (j['formatVersion'] !== FORMAT_VERSION) return { ok: false, errors: [`Versi format ${String(j['formatVersion'])} tidak didukung; yang didukung: ${FORMAT_VERSION}.`] };
  if (!Array.isArray(j['steps'])) return { ok: false, errors: ['Daftar langkah (steps) tidak ada.'] };
  if (j['steps'].length > MAX_STEPS) return { ok: false, errors: [`Terlalu banyak langkah (maksimum ${MAX_STEPS}).`] };
  const warnings: string[] = [];
  const steps = j['steps'].map((x, i) => cleanStep(x, i, newId, warnings)).filter((x): x is Step => x !== null);
  if (!steps.length) return { ok: false, errors: ['Tidak ada langkah yang valid di berkas.'] };
  const pr = isObj(j['process']) ? j['process'] : {};
  return { ok: true, warnings, value: { name: clip(pr['name'], 200), category: clip(pr['category'], 100), description: clip(pr['description']), version: clip(j['version'], 20) || 'draf', steps } };
}

export type ImportOutcome = { ok: true; warnings: string[] } | { ok: false; errors: string[] };

/** Mengganti draf panduan sebuah proses dengan isi berkas. Hanya bila panduan boleh disunting dan pelaku adalah pemilik/admin. */
export function importGuideIntoDraft(s: State, c: Ctx, actorId: string, pid: string, text: string): ImportOutcome {
  const p = getProcess(s, pid);
  if (!p) return { ok: false, errors: ['Proses tidak ditemukan.'] };
  if (!isGuideEditable(p.stage)) return { ok: false, errors: ['Panduan terkunci selama praktik atau peninjauan; impor tidak dapat dilakukan.'] };
  const actor = s.members.find((m) => m.id === actorId);
  if (actorId !== p.ownerId && !actor?.roles.includes('Administrator')) return { ok: false, errors: ['Hanya pemegang pengetahuan atau administrator yang dapat mengimpor ke draf.'] };
  const r = parseGuideFile(text, () => c.uid('st'));
  if (!r.ok) return r;
  (s.guides[pid] ??= { draft: [], versions: [] }).draft = r.value.steps;
  p.updatedAt = c.now();
  return { ok: true, warnings: r.warnings };
}

/** Membuat proses baru berstatus draf dari berkas panduan. */
export function createProcessFromGuideFile(s: State, c: Ctx, ownerId: string, text: string): ({ ok: true; pid: string; warnings: string[] }) | { ok: false; errors: string[] } {
  const r = parseGuideFile(text, () => c.uid('st'));
  if (!r.ok) return r;
  const id = c.uid('p'), now = c.now();
  const p: Process = {
    id, name: r.value.name || 'Panduan impor', description: r.value.description, category: r.value.category || 'Operasional', purpose: '', frequency: 'Mingguan', duration: 30,
    importance: 'Medium', ownerId, successorId: '', reviewerId: '', expected: '', deliverables: '',
    quality: [{ id: c.uid('q'), text: 'Hasil sesuai deskripsi proses', mandatory: true }],
    resources: { files: '', equipment: '', software: '', access: '', refs: '' }, stage: 'draft', cycle: 1, deadline: now, createdAt: now, updatedAt: now, draft: true, seed: false,
  };
  s.processes.push(p);
  s.guides[id] = { draft: r.value.steps, versions: [] };
  return { ok: true, pid: id, warnings: r.warnings };
}

/* ---------- cadangan workspace ---------- */

export interface WorkspaceExportOptions {
  /** Menyertakan hash kata sandi akun. Default: tidak (berkas lebih aman dibagikan, tetapi akun non-demo terkunci setelah impor di tempat lain). */
  includeHashes?: boolean;
}

export function workspaceToJson(s: State, exportedAt: string, opts: WorkspaceExportOptions = {}): string {
  const copy = JSON.parse(JSON.stringify(s)) as State;
  copy.session = { user: null };
  if (!opts.includeHashes) copy.members.forEach((m) => { delete m.pwHash; });
  const note = opts.includeHashes
    ? 'Cadangan lengkap, termasuk hash kata sandi akun. Perlakukan sebagai rahasia.'
    : 'Cadangan tanpa kata sandi. Aman dibagikan secara terbatas, tetapi masih memuat seluruh isi workspace.';
  return JSON.stringify({ format: WORKSPACE_FORMAT, formatVersion: FORMAT_VERSION, exportedAt, note, state: copy }, null, 2) + '\n';
}

/** Hash yang tidak mungkin cocok dengan kata sandi apa pun: mengunci akun yang kata sandinya tidak ikut diimpor. */
export const LOCKED_HASH = '0'.repeat(64);
const DEMO_EMAIL = /@ruangaksi\.id$/i;

/**
 * Menyiapkan state hasil impor untuk menggantikan state saat ini: mempertahankan sesi pengguna yang sama (cocok lewat email),
 * mewarisi hash kata sandi dari akun saat ini bila email sama, dan mengunci akun non-demo yang tidak membawa hash.
 */
export function adoptImport(current: State | null, imported: State): { state: State; lockedEmails: string[] } {
  const state = JSON.parse(JSON.stringify(imported)) as State;
  const me = current ? current.members.find((m) => m.id === current.session.user) : undefined;
  const lockedEmails: string[] = [];
  for (const m of state.members) {
    if (m.pwHash) continue;
    const prev = current?.members.find((x) => x.email.toLowerCase() === m.email.toLowerCase());
    if (prev?.pwHash) m.pwHash = prev.pwHash;
    else if (!DEMO_EMAIL.test(m.email)) { m.pwHash = LOCKED_HASH; lockedEmails.push(m.email); }
  }
  const same = me ? state.members.find((m) => m.email.toLowerCase() === me.email.toLowerCase()) : undefined;
  state.session = { user: same ? same.id : null };
  return { state, lockedEmails };
}

class Errs {
  list: string[] = [];
  add(m: string) { if (this.list.length < 25) this.list.push(m); }
  get any() { return this.list.length > 0; }
}

function checkIds(items: unknown, label: string, e: Errs, key = 'id'): Set<string> {
  const seen = new Set<string>();
  if (!Array.isArray(items)) { e.add(`${label}: harus berupa daftar.`); return seen; }
  items.forEach((it, i) => {
    if (!isObj(it)) { e.add(`${label}[${i}]: bukan objek.`); return; }
    const id = it[key];
    if (typeof id !== 'string' || !ID_RE.test(id)) { e.add(`${label}[${i}]: id tidak valid.`); return; }
    if (seen.has(id)) e.add(`${label}: id ganda “${id}”.`);
    seen.add(id);
  });
  return seen;
}

function sanitizeSteps(steps: unknown, label: string, e: Errs): Step[] {
  if (!Array.isArray(steps) || steps.length > MAX_STEPS) { e.add(`${label}: daftar langkah tidak valid.`); return []; }
  const out: Step[] = [];
  const seen = new Set<string>();
  steps.forEach((raw, i) => {
    if (!isObj(raw) || typeof raw['id'] !== 'string' || !ID_RE.test(raw['id']) || seen.has(raw['id'])) { e.add(`${label}[${i}]: langkah tidak valid atau id ganda.`); return; }
    seen.add(raw['id']);
    out.push({
      id: raw['id'], title: clip(raw['title'], 300), what: clip(raw['what']), why: clip(raw['why']), prepare: clip(raw['prepare']), how: clip(raw['how']), success: clip(raw['success']),
      risk: clip(raw['risk']), fallback: clip(raw['fallback']), critical: raw['critical'] === true, warning: clip(raw['warning']), example: clip(raw['example']),
      checklist: clip(raw['checklist']), decision: clip(raw['decision']),
      files: Array.isArray(raw['files']) ? raw['files'].filter((f): f is string => typeof f === 'string').slice(0, 50).map((f) => f.slice(0, 200)) : [],
      needsEvidence: raw['needsEvidence'] === true,
    });
  });
  return out;
}

/**
 * Memvalidasi dan menormalkan cadangan workspace. Berkas yang melanggar invarian (mis. proses "progress" tanpa praktik
 * berjalan) ditolak seluruhnya, karena mesin status tidak boleh dimulai dari keadaan mustahil.
 */
export function parseWorkspaceJson(text: string): { ok: true; state: State; warnings: string[] } | { ok: false; errors: string[] } {
  if (text.length > MAX_FILE_BYTES) return { ok: false, errors: ['Berkas terlalu besar.'] };
  let j: unknown;
  try { j = JSON.parse(text); } catch { return { ok: false, errors: ['JSON tidak valid.'] }; }
  if (!isObj(j) || j['format'] !== WORKSPACE_FORMAT) return { ok: false, errors: [`Bukan cadangan workspace ProofLoop (format “${WORKSPACE_FORMAT}” diharapkan).`] };
  if (j['formatVersion'] !== FORMAT_VERSION) return { ok: false, errors: [`Versi format ${String(j['formatVersion'])} tidak didukung; yang didukung: ${FORMAT_VERSION}.`] };
  const st = j['state'];
  if (!isObj(st) || st['ver'] !== 1) return { ok: false, errors: ['State tidak ada atau versinya tidak didukung (ver harus 1).'] };

  const e = new Errs();
  const warnings: string[] = [];
  const memberIds = checkIds(st['members'], 'members', e);
  const procIds = checkIds(st['processes'], 'processes', e);
  checkIds(st['attempts'], 'attempts', e);
  checkIds(st['gaps'], 'gaps', e);
  for (const k of ['invites', 'notifications', 'activity']) if (!Array.isArray(st[k])) e.add(`${k}: harus berupa daftar.`);
  if (!isObj(st['guides'])) e.add('guides: harus berupa objek.');
  if (!isObj(st['org'])) e.add('org: harus berupa objek.');
  if (e.any) return { ok: false, errors: e.list };

  const members = (st['members'] as Obj[]).map((m) => ({
    id: m['id'] as string, name: clip(m['name'], 200), email: clip(m['email'], 200), roles: Array.isArray(m['roles']) ? m['roles'].filter((r): r is string => typeof r === 'string').slice(0, 8) : [],
    status: clip(m['status'], 40) || 'Aktif', last: clip(m['last'], 40), title: clip(m['title'], 200), ...(typeof m['pwHash'] === 'string' && /^[0-9a-f]{64}$/.test(m['pwHash']) ? { pwHash: m['pwHash'] } : {}),
  }));

  const guidesRaw = st['guides'] as Obj;
  const guides: State['guides'] = {};
  for (const pid of procIds) {
    const g = guidesRaw[pid];
    if (g === undefined) { guides[pid] = { draft: [], versions: [] }; continue; }
    if (!isObj(g)) { e.add(`guides.${pid}: tidak valid.`); continue; }
    const versions = Array.isArray(g['versions']) ? g['versions'] : [];
    const vseen = new Set<string>();
    guides[pid] = {
      draft: sanitizeSteps(g['draft'] ?? [], `guides.${pid}.draft`, e),
      versions: versions.map((v, i) => {
        if (!isObj(v) || typeof v['v'] !== 'string' || !VER_RE.test(v['v']) || vseen.has(v['v'])) { e.add(`guides.${pid}.versions[${i}]: versi tidak valid atau ganda.`); return null; }
        vseen.add(v['v']);
        return { v: v['v'], at: clip(v['at'], 40), editor: clip(v['editor'], 64), summary: clip(v['summary'], 2000), gapIds: Array.isArray(v['gapIds']) ? v['gapIds'].filter((x): x is string => typeof x === 'string') : [], steps: sanitizeSteps(v['steps'], `guides.${pid}.versions[${i}].steps`, e) };
      }).filter((x): x is NonNullable<typeof x> => x !== null),
    };
  }
  for (const k of Object.keys(guidesRaw)) if (!procIds.has(k)) warnings.push(`Panduan untuk proses tak dikenal “${k.slice(0, 30)}” dibuang.`);

  const processes = (st['processes'] as Obj[]).map((p) => {
    const stage = p['stage'];
    if (typeof stage !== 'string' || !(STAGES as readonly string[]).includes(stage)) e.add(`processes.${String(p['id'])}: stage tidak valid.`);
    for (const k of ['ownerId', 'successorId', 'reviewerId']) {
      const v = p[k];
      if (typeof v !== 'string' || (v !== '' && !memberIds.has(v))) e.add(`processes.${String(p['id'])}.${k}: merujuk anggota yang tidak ada.`);
    }
    if (typeof p['cycle'] !== 'number' || !Number.isInteger(p['cycle']) || p['cycle'] < 1 || p['cycle'] > 99) e.add(`processes.${String(p['id'])}: cycle tidak valid.`);
    const quality = Array.isArray(p['quality']) ? (p['quality'] as unknown[]).filter(isObj).map((q) => ({ id: clip(q['id'], 64), text: clip(q['text'], 500), mandatory: q['mandatory'] === true })) : [];
    if (quality.some((q) => !ID_RE.test(q.id)) || new Set(quality.map((q) => q.id)).size !== quality.length) e.add(`processes.${String(p['id'])}.quality: id kriteria tidak valid atau ganda.`);
    return {
      id: p['id'] as string, name: clip(p['name'], 200), description: clip(p['description']), category: clip(p['category'], 100), purpose: clip(p['purpose']), frequency: clip(p['frequency'], 100),
      duration: typeof p['duration'] === 'number' ? p['duration'] : 30, importance: clip(p['importance'], 40), ownerId: clip(p['ownerId'], 64), successorId: clip(p['successorId'], 64),
      reviewerId: clip(p['reviewerId'], 64), expected: clip(p['expected']), deliverables: clip(p['deliverables']), quality,
      resources: isObj(p['resources']) ? Object.fromEntries(Object.entries(p['resources']).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k.slice(0, 40), clip(v)])) : {},
      stage: stage as Process['stage'], cycle: p['cycle'] as number, deadline: clip(p['deadline'], 40), createdAt: clip(p['createdAt'], 40), updatedAt: clip(p['updatedAt'], 40),
      draft: p['draft'] === true, seed: p['seed'] === true, ...(typeof p['completedAt'] === 'string' ? { completedAt: p['completedAt'] } : {}),
    } satisfies Process;
  });

  const attempts: Attempt[] = (st['attempts'] as Obj[]).map((a) => {
    if (typeof a['pid'] !== 'string' || !procIds.has(a['pid'])) e.add(`attempts.${String(a['id'])}: merujuk proses yang tidak ada.`);
    if (a['status'] !== 'progress' && a['status'] !== 'submitted' && a['status'] !== 'reviewed') e.add(`attempts.${String(a['id'])}: status tidak valid.`);
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : []);
    const sub = isObj(a['submission']) ? a['submission'] : {};
    const ev: NonNullable<Attempt['stepEvidence']> = {};
    if (isObj(a['stepEvidence'])) {
      for (const [sid, v] of Object.entries(a['stepEvidence'])) {
        if (!ID_RE.test(sid) || !isObj(v)) continue;
        const ph = isObj(v['photo']) && typeof v['photo']['dataUrl'] === 'string' && v['photo']['dataUrl'].length <= MAX_PHOTO_CHARS && PHOTO_RE.test(v['photo']['dataUrl'])
          ? { name: clip(v['photo']['name'], 200), dataUrl: v['photo']['dataUrl'] } : undefined;
        if (isObj(v['photo']) && !ph) warnings.push('Satu foto bukti dibuang karena bukan PNG/JPEG/WebP yang valid atau terlalu besar.');
        ev[sid] = { text: clip(v['text'], 5000), at: clip(v['at'], 40), ...(ph ? { photo: ph } : {}) };
      }
    }
    const comments = Array.isArray(a['comments']) ? (a['comments'] as unknown[]).filter(isObj).filter((c) => typeof c['id'] === 'string' && ID_RE.test(c['id'])).slice(0, 500)
      .map((c) => ({ id: c['id'] as string, stepId: clip(c['stepId'], 64), authorId: clip(c['authorId'], 64), text: clip(c['text'], 3000), at: clip(c['at'], 40) })) : [];
    const assist = (Array.isArray(a['assist']) ? (a['assist'] as unknown[]).filter(isObj) : []).slice(0, 500).map((x) => ({
      id: clip(x['id'], 64), step: clip(x['step'], 64), type: clip(x['type'], 100), text: clip(x['text'], 3000), provider: clip(x['provider'], 64), at: clip(x['at'], 40), evidence: clip(x['evidence'], 500), verified: x['verified'] !== false,
    }));
    const issues = (Array.isArray(a['issues']) ? (a['issues'] as unknown[]).filter(isObj) : []).slice(0, 500).map((x) => ({
      id: clip(x['id'], 64), step: clip(x['step'], 64), kind: clip(x['kind'], 200), text: clip(x['text'], 3000), at: clip(x['at'], 40),
    }));
    let review: Attempt['review'] = null;
    if (isObj(a['review'])) {
      const r = a['review'];
      const results: Record<string, (typeof RESULTS)[number]> = {};
      if (isObj(r['results'])) for (const [k, v] of Object.entries(r['results'])) if (ID_RE.test(k) && (RESULTS as readonly unknown[]).includes(v)) results[k] = v as (typeof RESULTS)[number];
      const n = isObj(r['notes']) ? r['notes'] : {};
      review = { id: clip(r['id'], 64), reviewerId: clip(r['reviewerId'], 64), results, reason: clip(r['reason'], 3000), at: clip(r['at'], 40), notes: { well: clip(n['well'], 3000), unclear: clip(n['unclear'], 3000), steps: clip(n['steps'], 3000), next: clip(n['next'], 3000) } };
    }
    return {
      id: a['id'] as string, pid: a['pid'] as string, cycle: ints(a['cycle'], 1, 99, 1), guideVersion: clip(a['guideVersion'], 20), startedAt: clip(a['startedAt'], 40),
      submittedAt: typeof a['submittedAt'] === 'string' ? a['submittedAt'].slice(0, 40) : null, doneSteps: strs(a['doneSteps']), cursor: ints(a['cursor'], -1, 1000, -1),
      assist, issues, submission: { files: strs(sub['files']), link: clip(sub['link'], 2000), text: clip(sub['text']) },
      self: isObj(a['self']) ? Object.fromEntries(Object.entries(a['self']).filter(([k]) => ID_RE.test(k)).map(([k, v]) => [k, v === true])) : {},
      minutes: typeof a['minutes'] === 'number' && a['minutes'] >= 0 && a['minutes'] < 100000 ? a['minutes'] : 0,
      status: a['status'] as Attempt['status'], outcome: (OUTCOMES as readonly unknown[]).includes(a['outcome']) ? (a['outcome'] as Attempt['outcome']) : null,
      review, notes: [], stepEvidence: ev, comments,
    };
  });

  // Invarian stage <-> data. Keadaan mustahil ditolak.
  for (const p of processes) {
    const vers = guides[p.id]?.versions ?? [];
    const open = attempts.find((a) => a.pid === p.id && a.cycle === p.cycle && a.status !== 'reviewed');
    if (p.stage !== 'draft' && !vers.length) e.add(`Proses “${p.name}” berstatus ${p.stage} tetapi belum punya versi panduan terbit.`);
    if (p.stage === 'progress' && open?.status !== 'progress') e.add(`Proses “${p.name}” berstatus progress tanpa praktik yang berjalan.`);
    if (p.stage === 'submitted' && open?.status !== 'submitted') e.add(`Proses “${p.name}” berstatus submitted tanpa hasil yang menunggu review.`);
    if ((p.stage === 'improve' || p.stage === 'done') && !attempts.some((a) => a.pid === p.id && a.status === 'reviewed')) e.add(`Proses “${p.name}” berstatus ${p.stage} tanpa praktik yang sudah direview.`);
    if (['draft', 'ready', 'improve', 'done'].includes(p.stage) && open) e.add(`Proses “${p.name}” berstatus ${p.stage} tetapi masih punya praktik yang belum selesai.`);
  }
  for (const a of attempts) if (a.status === 'reviewed' && !a.review) e.add(`attempts.${a.id}: berstatus reviewed tanpa data review.`);
  if (e.any) return { ok: false, errors: e.list };

  const settingsRaw = st['settings'];
  const orgRaw = st['org'] as Obj;
  const state: State = {
    ver: 1, session: { user: null }, ui: { view: clip((isObj(st['ui']) ? st['ui']['view'] : '') as unknown, 20) || 'table' },
    org: { id: clip(orgRaw['id'], 64), name: clip(orgRaw['name'], 200), type: clip(orgRaw['type'], 100), size: clip(orgRaw['size'], 100), description: clip(orgRaw['description']), objective: clip(orgRaw['objective']), createdAt: clip(orgRaw['createdAt'], 40) },
    members, invites: (st['invites'] as unknown[]).slice(0, 500), processes, guides, attempts,
    gaps: (st['gaps'] as Obj[]).slice(0, 2000).filter((g) => typeof g['pid'] === 'string' && procIds.has(g['pid'])).map((g) => ({
      id: g['id'] as string, pid: g['pid'] as string, attemptId: clip(g['attemptId'], 64), stepId: clip(g['stepId'], 64),
      source: (['assist', 'issue', 'review'] as const).find((x) => x === g['source']) ?? 'issue', desc: clip(g['desc'], 3000), evidence: clip(g['evidence'], 1000),
      cause: ints(g['cause'], 0, 6, 0), suggestion: clip(g['suggestion'], 3000), status: clip(g['status'], 20) || 'Baru', resolvedIn: typeof g['resolvedIn'] === 'string' ? g['resolvedIn'].slice(0, 20) : null,
    })),
    notifications: (st['notifications'] as unknown[]).filter(isObj).slice(0, 500).map((n) => ({
      id: clip(n['id'], 64), to: clip(n['to'], 64), type: clip(n['type'], 40), title: clip(n['title'], 300), body: clip(n['body'], 1000), route: safeRoute(n['route']), read: n['read'] === true, at: clip(n['at'], 40),
    })),
    activity: (st['activity'] as unknown[]).filter(isObj).slice(0, 60).map((x) => ({ id: clip(x['id'], 64), who: clip(x['who'], 64), text: clip(x['text'], 500), route: safeRoute(x['route']), at: clip(x['at'], 40) })),
    settings: isObj(settingsRaw) ? settingsRaw : {},
  };
  return { ok: true, state, warnings };
}

