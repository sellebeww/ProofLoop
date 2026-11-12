// Fixture uji. Semua data fiktif. © 2026 Vassel Goleyu.
import { expect } from 'vitest';
import { publishGuide, startAttempt, submitAttempt, completeReview, type ReviewInput } from '../src/domain/workflow.ts';
import type { Ctx, Stage, Process, State, Step } from '../src/domain/types.ts';

export function makeCtx(): Ctx & { tick: () => void } {
  let n = 0;
  let t = Date.parse('2026-01-01T09:00:00.000Z');
  return {
    now: () => new Date(t).toISOString(),
    uid: (p) => `${p}${++n}`,
    tick: () => { t += 60_000; },
  };
}

export const step = (title: string, o: Partial<Step> = {}): Step => ({
  id: 'st_' + title.replace(/\W+/g, '').toLowerCase(), title, what: '', why: '', prepare: '', how: 'Lakukan ' + title, success: 'Hasil ' + title,
  risk: '', fallback: '', critical: false, warning: '', example: '', checklist: '', decision: '', files: [], needsEvidence: false, ...o,
});

export function makeState(over: Partial<Process> = {}): State {
  const mk = (id: string, name: string, roles: string[]) => ({ id, name, email: `${id}@contoh.id`, roles, status: 'Aktif', last: '2026-01-01T00:00:00.000Z', title: '' });
  const p: Process = {
    id: 'p1', name: 'Proses Uji', description: '', category: 'Komunikasi', purpose: '', frequency: 'Mingguan', duration: 30, importance: 'High',
    ownerId: 'own', successorId: 'suc', reviewerId: 'rev', expected: '', deliverables: '',
    quality: [{ id: 'q1', text: 'Wajib A', mandatory: true }, { id: 'q2', text: 'Opsional B', mandatory: false }],
    resources: {}, stage: 'draft', cycle: 1, deadline: '2026-02-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    draft: true, seed: false, ...over,
  };
  return {
    ver: 1, session: { user: 'own' }, ui: { view: 'table' },
    org: { id: 'o1', name: 'Org Uji', type: '', size: '', description: '', objective: '', createdAt: '2026-01-01T00:00:00.000Z' },
    members: [mk('own', 'Pemilik', ['Pemegang Pengetahuan']), mk('suc', 'Penerus', ['Penerus']), mk('rev', 'Reviewer', ['Reviewer']), mk('adm', 'Admin', ['Administrator']), mk('zzz', 'Orang Lain', ['Penerus'])],
    invites: [], processes: [p], guides: { p1: { draft: [step('Satu'), step('Dua', { critical: true })], versions: [] } },
    attempts: [], gaps: [], notifications: [], activity: [], settings: {},
  };
}


const P = (s: State): Process => s.processes[0]!;
/** Bawa proses ke stage tertentu lewat operasi sungguhan (bukan menimpa field). */
export function reach(target: Stage) {
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

