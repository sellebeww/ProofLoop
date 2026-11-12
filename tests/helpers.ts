// Fixture uji. Semua data fiktif. © 2026 Vassel Goleyu.
import type { Ctx, Process, State, Step } from '../src/domain/types.ts';

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
  risk: '', fallback: '', critical: false, warning: '', example: '', checklist: '', decision: '', files: [], ...o,
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

