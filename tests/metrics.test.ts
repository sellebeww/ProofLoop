import { describe, it, expect } from 'vitest';
import { portfolioMetrics, report, statusKey } from '../src/domain/metrics.ts';
import { usabilityOf, scoreAttempt } from '../src/domain/usability.ts';
import { completeReview, publishGuide, startAttempt, submitAttempt, type ReviewInput } from '../src/domain/workflow.ts';
import { reach, makeCtx, makeState } from './helpers.ts';

const notes = { well: '', unclear: '', steps: '', next: '' };
const rv = (o: Partial<ReviewInput>): ReviewInput => ({ results: { q1: 'pass', q2: 'pass' }, dropped: {}, outcome: 'mandiri', reason: 'ok', notes, ...o });

describe('statusKey dan portfolioMetrics', () => {
  it('memetakan stage ke status', () => {
    expect(statusKey({ stage: 'done' })).toBe('mandiri');
    expect(statusKey({ stage: 'improve' })).toBe('fix');
    expect(statusKey({ stage: 'draft' })).toBe('none');
    for (const st of ['ready', 'progress', 'submitted'] as const) expect(statusKey({ stage: st })).toBe('test');
  });
  it('menghitung portofolio', () => {
    const s = makeState();
    expect(portfolioMetrics(s)).toEqual({ total: 1, active: 0, mandiri: 0, fix: 0, test: 0, none: 1 });
    const { s: d } = reach('done');
    expect(portfolioMetrics(d)).toMatchObject({ total: 1, active: 0, mandiri: 1 });
    const { s: r } = reach('submitted');
    expect(portfolioMetrics(r)).toMatchObject({ active: 1, test: 1 });
  });
});

describe('report', () => {
  it('kosong: rate dan crit null, bukan 0', () => {
    const r = report(makeState());
    expect(r).toMatchObject({ n: 0, rate: null, crit: null, assist: 0 });
  });
  it('menghitung tingkat mandiri, bantuan per jenis, dan kriteria wajib', () => {
    const { s, c } = reach('submitted');
    const a = s.attempts[0]!;
    a.assist.push({ id: 'a1', step: 'st_satu', type: 'Klarifikasi diminta', text: 'x', provider: 'own', at: '', evidence: '', verified: true });
    a.assist.push({ id: 'a2', step: 'st_satu', type: 'Klarifikasi diminta', text: 'tanpa penolong', provider: '', at: '', evidence: '', verified: true });
    completeReview(s, c, 'rev', a.id, rv({ outcome: 'dengan_bantuan' }));
    const r = report(s);
    expect(r).toMatchObject({ n: 1, rate: 0, mandiri: 0, assist: 1, crit: 100, critN: 1, psN: 1, done: 0 });
    expect(r.byType).toEqual({ 'Klarifikasi diminta': 1 });
    expect(Object.values(r.monthly).reduce((x, y) => x + y, 0)).toBe(1);
  });
  it('N/A tidak dihitung pada kriteria wajib; filter kategori', () => {
    const { s, c } = reach('submitted');
    completeReview(s, c, 'rev', s.attempts[0]!.id, rv({ results: { q1: 'na', q2: 'pass' } }));
    expect(report(s).crit).toBeNull();
    expect(report(s, { cat: 'Komunikasi' }).n).toBe(1);
    expect(report(s, { cat: 'Lain' }).n).toBe(0);
    expect(report(s, { status: 'mandiri' }).n).toBe(1);
    expect(report(s, { status: 'fix' }).n).toBe(0);
  });
});

describe('skor keterpakaian', () => {
  it('null (bukan 0) bila belum ada praktik yang direview', () => {
    const u = usabilityOf(reach('progress').s, 'p1');
    expect(u.score).toBeNull();
    expect(u.reviewedCount).toBe(0);
    expect(u.components).toEqual([]);
  });
  it('Mandiri sempurna = 100 dengan rumus 40/35/25', () => {
    const { s } = reach('done');
    const u = usabilityOf(s, 'p1');
    expect(u.score).toBe(100);
    expect(u.components.map((x) => x.value)).toEqual([100, 100, 100]);
    expect(u.effectiveWeights).toEqual({ outcome: 40, steps: 35, criteria: 25 });
  });
  it('Dengan Bantuan pada 1 dari 2 langkah: 0.4*60 + 0.35*50 + 0.25*100 = 66.5 → 67', () => {
    const { s, c } = reach('submitted');
    const a = s.attempts[0]!;
    a.assist.push({ id: 'a1', step: 'st_satu', type: 'Klarifikasi diminta', text: 'x', provider: 'own', at: '', evidence: '', verified: true });
    completeReview(s, c, 'rev', a.id, rv({ outcome: 'dengan_bantuan' }));
    const u = usabilityOf(s, 'p1');
    expect(u.components.map((x) => x.value)).toEqual([60, 50, 100]);
    expect(u.score).toBe(67);
  });
  it('kendala yang dilaporkan juga mengurangi komponen langkah; bantuan umum (tanpa langkah) tidak', () => {
    const { s, c } = reach('submitted');
    const a = s.attempts[0]!;
    a.issues.push({ id: 'i1', step: 'st_dua', kind: 'Instruksi tidak jelas', text: '', at: '' });
    a.assist.push({ id: 'a1', step: '', type: 'Klarifikasi diminta', text: 'umum', provider: 'own', at: '', evidence: '', verified: true });
    completeReview(s, c, 'rev', a.id, rv({ outcome: 'dengan_bantuan' }));
    expect(usabilityOf(s, 'p1').components[1]!.value).toBe(50);
  });
  it('Belum Berhasil dengan kriteria wajib gagal: 0 pada hasil dan kriteria', () => {
    const { s } = reach('improve');
    const u = usabilityOf(s, 'p1');
    expect(u.components.map((x) => x.value)).toEqual([0, 100, 0]);
    expect(u.score).toBe(35);
  });
  it('komponen yang tak terhitung dibuang dan bobot dinormalkan', () => {
    const { s, c } = reach('submitted');
    completeReview(s, c, 'rev', s.attempts[0]!.id, rv({ results: { q1: 'na', q2: 'pass' } }));
    const u = usabilityOf(s, 'p1');
    expect(u.components[2]!.value).toBeNull();
    expect(u.effectiveWeights).toEqual({ outcome: 53.3, steps: 46.7 });
    expect(u.score).toBe(100);
  });
  it('tren per siklus: siklus 1 gagal, siklus 2 mandiri', () => {
    const { s, c } = reach('improve');
    publishGuide(s, c, 'own', 'p1', 'revisi');
    startAttempt(s, c, 'suc', 'p1');
    const a2 = s.attempts[1]!;
    a2.doneSteps = ['st_satu', 'st_dua'];
    submitAttempt(s, c, 'suc', a2.id, { submission: { files: [], link: '', text: 'ok' }, self: {}, minutes: 5 });
    completeReview(s, c, 'rev', a2.id, rv({}));
    const u = usabilityOf(s, 'p1');
    expect(u.reviewedCount).toBe(2);
    expect(u.trend).toEqual([{ cycle: 1, version: '1.0', score: 35 }, { cycle: 2, version: '1.1', score: 100 }]);
    expect(u.score).toBe(100);
    expect(u.cycle).toBe(2);
  });
  it('cakupan bukti dilaporkan terpisah dan tidak memengaruhi skor', () => {
    const { s, c } = reach('progress');
    s.guides['p1']!.versions[0]!.steps[0]!.needsEvidence = true;
    const a = s.attempts[0]!;
    a.stepEvidence = { st_satu: { text: 'bukti', at: '' } };
    submitAttempt(s, c, 'suc', a.id, { submission: { files: [], link: '', text: 'ok' }, self: {}, minutes: 5 });
    completeReview(s, c, 'rev', a.id, rv({}));
    const u = usabilityOf(s, 'p1');
    expect(u.evidence).toEqual({ withEvidence: 1, total: 1 });
    expect(u.score).toBe(100);
  });
  it('scoreAttempt aman untuk versi panduan yang hilang', () => {
    const { s } = reach('done');
    const a = { ...s.attempts[0]!, guideVersion: '9.9' };
    const r = scoreAttempt(s, a);
    expect(r.components[1]!.value).toBeNull();
    expect(r.score).toBe(100);
  });
  it('makeCtx deterministik', () => { const c = makeCtx(); expect(c.uid('x')).toBe('x1'); expect(c.uid('x')).toBe('x2'); });
});
