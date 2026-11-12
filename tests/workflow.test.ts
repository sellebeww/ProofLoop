import { describe, it, expect } from 'vitest';
import {
  EVENTS, STAGES, TRANSITIONS, nextStage, canTransition, isGuideEditable, publishGuide, startAttempt, submitAttempt, completeReview,
  suggestOutcome, validateReview, type ReviewInput,
} from '../src/domain/workflow.ts';
import type { Process, Stage, State } from '../src/domain/types.ts';
import { makeCtx, makeState, step } from './helpers.ts';

const P = (s: State): Process => s.processes[0]!;
const snapshot = (s: State) => JSON.stringify(s);

/** Bawa proses ke stage tertentu lewat operasi sungguhan (bukan menimpa field). */
function reach(target: Stage) {
  const c = makeCtx();
  const s = makeState();
  const pub = () => { const r = publishGuide(s, c, 'own', 'p1'); expect(r.ok).toBe(true); };
  const doSubmit = () => {
    const a = s.attempts[0]!;
    const r = submitAttempt(s, c, 'suc', a.id, { submission: { files: [], link: '', text: 'selesai' }, self: {}, minutes: 10 });
    expect(r.ok).toBe(true);
  };
  const okInput = (): ReviewInput => ({ results: { q1: 'pass', q2: 'pass' }, dropped: {}, outcome: 'mandiri', reason: 'baik', notes: { well: '', unclear: '', steps: '', next: '' } });
  if (target !== 'draft') pub();
  if (['progress', 'submitted', 'improve', 'done'].includes(target)) {
    const r = startAttempt(s, c, 'suc', 'p1'); expect(r.ok).toBe(true);
    s.attempts[0]!.doneSteps = ['st_satu', 'st_dua'];
  }
  if (['submitted', 'improve', 'done'].includes(target)) doSubmit();
  if (target === 'improve') expect(completeReview(s, c, 'rev', s.attempts[0]!.id, { ...okInput(), results: { q1: 'revision', q2: 'pass' }, outcome: 'belum' }).ok).toBe(true);
  if (target === 'done') expect(completeReview(s, c, 'rev', s.attempts[0]!.id, okInput()).ok).toBe(true);
  expect(P(s).stage).toBe(target);
  return { s, c, okInput };
}

describe('tabel transisi', () => {
  const expected: Record<Stage, Partial<Record<string, Stage>>> = {
    draft: { publish: 'ready' },
    ready: { publish: 'ready', start: 'progress' },
    progress: { submit: 'submitted' },
    submitted: { approve: 'done', revise: 'improve' },
    improve: { publish: 'ready' },
    done: {},
  };
  for (const st of STAGES) for (const ev of EVENTS) {
    const to = expected[st][ev] ?? null;
    it(`${st} + ${ev} → ${to ?? 'DITOLAK'}`, () => { expect(nextStage(st, ev)).toBe(to); });
  }
  it('canTransition konsisten dengan tabel', () => {
    for (const from of STAGES) for (const to of STAGES) {
      expect(canTransition(from, to)).toBe(Object.values(TRANSITIONS[from]).includes(to));
    }
    expect(canTransition('done', 'draft')).toBe(false);
    expect(canTransition('draft', 'progress')).toBe(false);
    expect(canTransition('progress', 'done')).toBe(false);
    expect(canTransition('submitted', 'ready')).toBe(false);
  });
  it('done adalah status akhir', () => { expect(Object.keys(TRANSITIONS.done)).toHaveLength(0); });
  it('panduan hanya bisa disunting pada draft, ready, improve', () => {
    expect(STAGES.filter(isGuideEditable)).toEqual(['draft', 'ready', 'improve']);
  });
});

describe('alur sah dari draf sampai disetujui', () => {
  it('jalur bahagia: draft → ready → progress → submitted → done', () => {
    const { s } = reach('done');
    expect(P(s).stage).toBe('done');
    expect(P(s).completedAt).toBeTruthy();
    expect(s.attempts[0]!.outcome).toBe('mandiri');
    expect(s.gaps).toHaveLength(0);
  });
  it('jalur revisi: improve → publish menaikkan siklus dan versi', () => {
    const { s, c } = reach('improve');
    expect(P(s).cycle).toBe(1);
    expect(s.gaps.length).toBeGreaterThan(0);
    const r = publishGuide(s, c, 'own', 'p1', 'revisi');
    expect(r).toMatchObject({ ok: true, version: '1.1' });
    expect(P(s).stage).toBe('ready');
    expect(P(s).cycle).toBe(2);
  });
  it('publish saat ready membuat versi baru tanpa menaikkan siklus', () => {
    const { s, c } = reach('ready');
    expect(publishGuide(s, c, 'own', 'p1')).toMatchObject({ ok: true, version: '1.1' });
    expect(P(s).cycle).toBe(1);
    expect(P(s).stage).toBe('ready');
  });
  it('publish pertama memberi penugasan ke penerus', () => {
    const { s } = reach('ready');
    expect(s.notifications.some((n) => n.to === 'suc' && n.type === 'assign')).toBe(true);
  });
});

describe('transisi terlarang: operasi ditolak dan state tidak berubah', () => {
  const attempt = (s: State) => s.attempts[0]!.id;
  const sub = { submission: { files: [], link: '', text: 'x' }, self: {}, minutes: 5 };

  const cases: { name: string; from: Stage; run: (s: State, c: ReturnType<typeof makeCtx>, okInput: () => ReviewInput) => { ok: boolean; code?: string } }[] = [
    { name: 'mulai praktik saat draft', from: 'draft', run: (s, c) => startAttempt(s, c, 'suc', 'p1') },
    { name: 'mulai praktik saat submitted', from: 'submitted', run: (s, c) => startAttempt(s, c, 'suc', 'p1') },
    { name: 'mulai praktik saat improve', from: 'improve', run: (s, c) => startAttempt(s, c, 'suc', 'p1') },
    { name: 'mulai praktik saat done', from: 'done', run: (s, c) => startAttempt(s, c, 'suc', 'p1') },
    { name: 'terbitkan saat progress', from: 'progress', run: (s, c) => publishGuide(s, c, 'own', 'p1') },
    { name: 'terbitkan saat submitted', from: 'submitted', run: (s, c) => publishGuide(s, c, 'own', 'p1') },
    { name: 'terbitkan saat done', from: 'done', run: (s, c) => publishGuide(s, c, 'own', 'p1') },
    { name: 'kirim hasil dua kali', from: 'submitted', run: (s, c) => submitAttempt(s, c, 'suc', attempt(s), sub) },
    { name: 'kirim hasil setelah direview', from: 'done', run: (s, c) => submitAttempt(s, c, 'suc', attempt(s), sub) },
    { name: 'review saat praktik masih berjalan', from: 'progress', run: (s, c, ok) => completeReview(s, c, 'rev', attempt(s), ok()) },
    { name: 'review dua kali (done)', from: 'done', run: (s, c, ok) => completeReview(s, c, 'rev', attempt(s), ok()) },
    { name: 'review dua kali (improve)', from: 'improve', run: (s, c, ok) => completeReview(s, c, 'rev', attempt(s), ok()) },
  ];
  for (const t of cases) {
    it(t.name, () => {
      const { s, c, okInput } = reach(t.from);
      const before = snapshot(s);
      const r = t.run(s, c, okInput);
      expect(r.ok).toBe(false);
      expect((r as { code: string }).code).toBe('forbidden_transition');
      expect(snapshot(s)).toBe(before);
    });
  }

  it('review atas attempt yang tidak ada → not_found', () => {
    const { s, c, okInput } = reach('submitted');
    expect(completeReview(s, c, 'rev', 'nope', okInput())).toMatchObject({ ok: false, code: 'not_found' });
  });
  it('proses yang tidak ada → not_found', () => {
    const { s, c } = reach('draft');
    expect(publishGuide(s, c, 'own', 'x')).toMatchObject({ ok: false, code: 'not_found' });
    expect(startAttempt(s, c, 'suc', 'x')).toMatchObject({ ok: false, code: 'not_found' });
  });
  it('mulai praktik saat sudah progress bersifat idempoten (tidak menggandakan attempt)', () => {
    const { s, c } = reach('progress');
    const r = startAttempt(s, c, 'suc', 'p1');
    expect(r.ok).toBe(true);
    expect(s.attempts).toHaveLength(1);
  });
});

describe('penjagaan peran', () => {
  it('hanya pemilik atau admin yang boleh menerbitkan', () => {
    const c = makeCtx(); const s = makeState();
    expect(publishGuide(s, c, 'suc', 'p1')).toMatchObject({ ok: false, code: 'forbidden_actor' });
    expect(publishGuide(s, c, 'rev', 'p1')).toMatchObject({ ok: false, code: 'forbidden_actor' });
    expect(P(s).stage).toBe('draft');
    expect(publishGuide(s, c, 'adm', 'p1').ok).toBe(true);
  });
  it('hanya penerus yang ditetapkan boleh mulai dan kirim', () => {
    const { s, c } = reach('ready');
    expect(startAttempt(s, c, 'zzz', 'p1')).toMatchObject({ ok: false, code: 'forbidden_actor' });
    expect(startAttempt(s, c, 'own', 'p1')).toMatchObject({ ok: false, code: 'forbidden_actor' });
    expect(P(s).stage).toBe('ready');
    startAttempt(s, c, 'suc', 'p1');
    s.attempts[0]!.doneSteps = ['st_satu', 'st_dua'];
    const r = submitAttempt(s, c, 'rev', s.attempts[0]!.id, { submission: { files: [], link: '', text: 'x' }, self: {}, minutes: 5 });
    expect(r).toMatchObject({ ok: false, code: 'forbidden_actor' });
    expect(P(s).stage).toBe('progress');
  });
  it('hanya reviewer yang ditetapkan boleh menilai', () => {
    const { s, c, okInput } = reach('submitted');
    for (const who of ['own', 'suc', 'adm', 'zzz']) {
      expect(completeReview(s, c, who, s.attempts[0]!.id, okInput())).toMatchObject({ ok: false, code: 'forbidden_actor' });
    }
    expect(P(s).stage).toBe('submitted');
    expect(s.attempts[0]!.review).toBeNull();
  });
});

describe('validasi menerbitkan panduan', () => {
  it('menolak panduan kosong, langkah tidak lengkap, tanpa penerus/reviewer', () => {
    const c = makeCtx(); const s = makeState({ successorId: '', reviewerId: '' });
    s.guides['p1']!.draft = [step('A', { how: '', success: '' })];
    const r = publishGuide(s, c, 'own', 'p1');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('invalid_input');
      expect(r.errors.join('|')).toMatch(/cara melakukan/);
      expect(r.errors.join('|')).toMatch(/penerus/);
      expect(r.errors.join('|')).toMatch(/reviewer/);
    }
    s.guides['p1']!.draft = [];
    const r2 = publishGuide(s, c, 'own', 'p1');
    expect(r2.ok === false && r2.errors[0]).toMatch(/minimal satu langkah/);
    expect(s.guides['p1']!.versions).toHaveLength(0);
  });
  it('isu yang sudah Selesai ditautkan ke versi baru', () => {
    const { s, c } = reach('improve');
    s.gaps.forEach((g) => { g.status = 'Selesai'; });
    const ids = s.gaps.map((g) => g.id);
    publishGuide(s, c, 'own', 'p1');
    expect(s.gaps.every((g) => g.resolvedIn === '1.1')).toBe(true);
    expect(s.guides['p1']!.versions[1]!.gapIds).toEqual(ids);
  });
});

describe('validasi pengiriman hasil', () => {
  const base = { submission: { files: [], link: '', text: 'x' }, self: {}, minutes: 5 };
  it('menolak bila langkah belum selesai', () => {
    const { s, c } = reach('progress');
    s.attempts[0]!.doneSteps = ['st_satu'];
    const r = submitAttempt(s, c, 'suc', s.attempts[0]!.id, base);
    expect(r).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(P(s).stage).toBe('progress');
  });
  it('menolak tanpa bukti hasil, tautan tidak valid, menit nol', () => {
    const { s, c } = reach('progress');
    const id = s.attempts[0]!.id;
    expect(submitAttempt(s, c, 'suc', id, { ...base, submission: { files: [], link: '', text: ' ' } }).ok).toBe(false);
    expect(submitAttempt(s, c, 'suc', id, { ...base, submission: { files: [], link: 'javascript:alert(1)', text: '' } }).ok).toBe(false);
    expect(submitAttempt(s, c, 'suc', id, { ...base, minutes: 0 }).ok).toBe(false);
    expect(P(s).stage).toBe('progress');
  });
  it('langkah yang butuh bukti wajib punya bukti teks atau foto', () => {
    const { s, c } = reach('progress');
    s.guides['p1']!.versions[0]!.steps[0]!.needsEvidence = true;
    const a = s.attempts[0]!;
    expect(submitAttempt(s, c, 'suc', a.id, base)).toMatchObject({ ok: false });
    a.stepEvidence = { st_satu: { text: '  ', at: '' } };
    expect(submitAttempt(s, c, 'suc', a.id, base)).toMatchObject({ ok: false });
    a.stepEvidence = { st_satu: { text: 'Tangkapan layar terlampir', at: '' } };
    expect(submitAttempt(s, c, 'suc', a.id, base).ok).toBe(true);
  });
});

describe('aturan penilaian (dulu hanya di UI)', () => {
  const withHelp = () => {
    const r = reach('submitted');
    r.s.attempts[0]!.assist.push({ id: 'as1', step: 'st_satu', type: 'Klarifikasi diminta', text: 'bantu', provider: 'own', at: '', evidence: '', verified: true });
    return r;
  };
  it('Mandiri ditolak bila ada bantuan tervalidasi, diterima bila dicoret reviewer', () => {
    const { s, c, okInput } = withHelp();
    const id = s.attempts[0]!.id;
    expect(completeReview(s, c, 'rev', id, okInput())).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(s.attempts[0]!.status).toBe('submitted');
    const ok = completeReview(s, c, 'rev', id, { ...okInput(), dropped: { as1: true } });
    expect(ok).toMatchObject({ ok: true, outcome: 'mandiri', stage: 'done' });
    expect(s.attempts[0]!.assist[0]!.verified).toBe(false);
  });
  it('Mandiri dan Dengan Bantuan ditolak bila kriteria wajib gagal', () => {
    const { s, c, okInput } = reach('submitted');
    const id = s.attempts[0]!.id;
    const failed = { ...okInput(), results: { q1: 'revision', q2: 'pass' } as const };
    expect(completeReview(s, c, 'rev', id, { ...failed, outcome: 'mandiri' }).ok).toBe(false);
    expect(completeReview(s, c, 'rev', id, { ...failed, outcome: 'dengan_bantuan' }).ok).toBe(false);
    expect(completeReview(s, c, 'rev', id, { ...failed, outcome: 'belum' }).ok).toBe(true);
  });
  it('kriteria opsional yang gagal tidak menghalangi Mandiri', () => {
    const { s, c, okInput } = reach('submitted');
    expect(completeReview(s, c, 'rev', s.attempts[0]!.id, { ...okInput(), results: { q1: 'pass', q2: 'revision' } }).ok).toBe(true);
  });
  it('wajib menilai semua kriteria, memilih hasil, dan memberi alasan', () => {
    const { s, c, okInput } = reach('submitted');
    const id = s.attempts[0]!.id;
    const r = completeReview(s, c, 'rev', id, { ...okInput(), results: { q1: 'pass' }, reason: ' ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('|')).toMatch(/Nilai semua kriteria[\s\S]*Alasan/);
    expect(completeReview(s, c, 'rev', id, { ...okInput(), outcome: '' })).toMatchObject({ ok: false, code: 'invalid_input' });
  });
  it('hasil non-mandiri menghasilkan celah dari kendala, bantuan, dan kriteria gagal', () => {
    const { s, c, okInput } = withHelp();
    const a = s.attempts[0]!;
    a.issues.push({ id: 'is1', step: 'st_dua', kind: 'Instruksi tidak jelas', text: 'bingung', at: '' });
    const r = completeReview(s, c, 'rev', a.id, { ...okInput(), results: { q1: 'revision', q2: 'pass' }, outcome: 'belum' });
    expect(r).toMatchObject({ ok: true, stage: 'improve' });
    expect(s.gaps.map((g) => g.source).sort()).toEqual(['assist', 'issue', 'review']);
    expect(s.gaps.every((g) => g.status === 'Baru' && g.resolvedIn === null)).toBe(true);
  });
  it('suggestOutcome dan validateReview konsisten', () => {
    const { s } = withHelp();
    const p = P(s), a = s.attempts[0]!;
    expect(suggestOutcome(p, a, { q1: 'pass', q2: 'pass' })).toBe('dengan_bantuan');
    expect(suggestOutcome(p, a, { q1: 'pass', q2: 'pass' }, { as1: true })).toBe('mandiri');
    expect(suggestOutcome(p, a, { q1: 'revision', q2: 'pass' })).toBe('belum');
    expect(validateReview(p, a, { results: { q1: 'pass', q2: 'pass' }, dropped: {}, outcome: 'dengan_bantuan', reason: 'ok', notes: { well: '', unclear: '', steps: '', next: '' } })).toEqual([]);
  });
});
