import { describe, it, expect } from 'vitest';
import { diffText, diffSteps } from '../src/domain/diff.ts';
import { step } from './helpers.ts';

const join = (p: ReturnType<typeof diffText>, t: 'eq' | 'add' | 'del') => p.filter((x) => x.type === t).map((x) => x.text).join('');

describe('diffText', () => {
  it('sama → satu bagian eq; kosong → []', () => {
    expect(diffText('a b', 'a b')).toEqual([{ type: 'eq', text: 'a b' }]);
    expect(diffText('', '')).toEqual([]);
  });
  it('tambah dan hapus kata, rekonstruksi akurat', () => {
    const p = diffText('kirim pesan ke grup', 'kirim pesan baru ke semua grup');
    expect(p.map((x) => x.text).filter((_, i) => p[i]!.type !== 'add').join('')).toBe('kirim pesan ke grup');
    expect(p.map((x) => x.text).filter((_, i) => p[i]!.type !== 'del').join('')).toBe('kirim pesan baru ke semua grup');
    expect(join(p, 'add')).toContain('baru');
    expect(join(p, 'del')).toBe('');
  });
  it('dari kosong dan ke kosong', () => {
    expect(diffText('', 'baru')).toEqual([{ type: 'add', text: 'baru' }]);
    expect(diffText('lama', '')).toEqual([{ type: 'del', text: 'lama' }]);
  });
  it('teks sangat panjang jatuh ke penggantian utuh', () => {
    const a = 'a '.repeat(2000), b = 'b '.repeat(2000);
    expect(diffText(a, b).map((x) => x.type)).toEqual(['del', 'add']);
  });
});

describe('diffSteps', () => {
  const A = [step('Satu'), step('Dua', { how: 'cara lama' }), step('Tiga')];
  it('identik → semua unchanged', () => {
    const d = diffSteps(A, JSON.parse(JSON.stringify(A)));
    expect(d.changes).toEqual([]);
    expect(d.stats).toEqual({ added: 0, removed: 0, changed: 0, moved: 0, unchanged: 3 });
  });
  it('mendeteksi tambah, hapus, ubah isi', () => {
    const B = [A[0]!, { ...A[1]!, how: 'cara baru' }, step('Empat')];
    const d = diffSteps(A, B);
    expect(d.stats).toMatchObject({ added: 1, removed: 1, changed: 1 });
    const ch = d.changes.find((c) => c.kind === 'changed')!;
    expect(ch.kind === 'changed' && ch.fields.map((f) => f.key)).toEqual(['how']);
    expect(d.changes.find((c) => c.kind === 'removed')).toMatchObject({ step: { title: 'Tiga' } });
  });
  it('pengubahan judul tetap berpasangan lewat id (bukan hapus+tambah)', () => {
    const B = [A[0]!, { ...A[1]!, title: 'Dua (baru)' }, A[2]!];
    const d = diffSteps(A, B);
    expect(d.stats).toMatchObject({ added: 0, removed: 0, changed: 1 });
  });
  it('mencocokkan judul persis bila id berbeda (mis. hasil impor)', () => {
    const B = A.map((s) => ({ ...s, id: s.id + 'x' }));
    expect(diffSteps(A, B).stats).toMatchObject({ added: 0, removed: 0, changed: 0, unchanged: 3 });
  });
  it('mendeteksi perpindahan urutan, hanya langkah yang bergeser', () => {
    const B = [A[2]!, A[0]!, A[1]!];
    const d = diffSteps(A, B);
    expect(d.stats.moved).toBe(1);
    expect(d.changes[0]).toMatchObject({ kind: 'moved', title: 'Tiga', index: 0, oldIndex: 2 });
  });
  it('mencatat perubahan flag kritis dan wajib bukti', () => {
    const d = diffSteps([step('A')], [step('A', { critical: true, needsEvidence: true })]);
    const c = d.changes[0]!;
    expect(c.kind === 'changed' && c.fields.map((f) => [f.key, f.before, f.after])).toEqual([['critical', 'tidak', 'ya'], ['needsEvidence', 'tidak', 'ya']]);
  });
  it('panduan kosong ke berisi dan sebaliknya', () => {
    expect(diffSteps([], A).stats.added).toBe(3);
    expect(diffSteps(A, []).stats.removed).toBe(3);
  });
});
