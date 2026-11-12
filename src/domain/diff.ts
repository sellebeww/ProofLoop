// ProofLoop: diff antarversi panduan (murni). Pencocokan langkah lewat id, lalu judul persis. © 2026 Vassel Goleyu.
import type { Step } from './types.ts';

export type PartType = 'eq' | 'add' | 'del';
export interface DiffPart { type: PartType; text: string }

export const DIFF_FIELDS: readonly (readonly [keyof Step, string])[] = [
  ['title', 'Judul'], ['what', 'Penjelasan'], ['why', 'Alasan'], ['prepare', 'Persiapan'], ['how', 'Cara melakukan'], ['success', 'Hasil yang berhasil'],
  ['risk', 'Risiko'], ['fallback', 'Jika bermasalah'], ['warning', 'Peringatan'], ['example', 'Contoh'], ['checklist', 'Daftar periksa'], ['decision', 'Titik keputusan'],
  ['critical', 'Langkah kritis'], ['needsEvidence', 'Wajib bukti'],
];

const MAX_TOKENS = 1500;

/** Diff tingkat kata (LCS). Untuk teks sangat panjang, jatuh ke penggantian utuh agar tetap cepat. */
export function diffText(a: string, b: string): DiffPart[] {
  if (a === b) return a ? [{ type: 'eq', text: a }] : [];
  const x = a.split(/(\s+)/).filter((t) => t !== ''), y = b.split(/(\s+)/).filter((t) => t !== '');
  if (x.length > MAX_TOKENS || y.length > MAX_TOKENS) {
    return [...(a ? [{ type: 'del' as const, text: a }] : []), ...(b ? [{ type: 'add' as const, text: b }] : [])];
  }
  const n = x.length, m = y.length;
  const L: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = x[i] === y[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: DiffPart[] = [];
  const push = (type: PartType, text: string) => { const l = out[out.length - 1]; if (l && l.type === type) l.text += text; else out.push({ type, text }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { push('eq', x[i]!); i++; j++; } else if (L[i + 1]![j]! >= L[i]![j + 1]!) { push('del', x[i++]!); } else { push('add', y[j++]!); }
  }
  while (i < n) push('del', x[i++]!);
  while (j < m) push('add', y[j++]!);
  return out;
}

export interface FieldChange { key: keyof Step; label: string; before: string; after: string; parts: DiffPart[] }
export type StepChange =
  | { kind: 'added'; step: Step; index: number }
  | { kind: 'removed'; step: Step; index: number }
  | { kind: 'changed'; stepId: string; title: string; index: number; oldIndex: number; moved: boolean; fields: FieldChange[] }
  | { kind: 'moved'; stepId: string; title: string; index: number; oldIndex: number };

export interface VersionDiff {
  changes: StepChange[];
  stats: { added: number; removed: number; changed: number; moved: number; unchanged: number };
}

const show = (v: unknown): string => (typeof v === 'boolean' ? (v ? 'ya' : 'tidak') : String(v ?? '').trim());

export function diffSteps(before: readonly Step[], after: readonly Step[]): VersionDiff {
  const usedOld = new Set<number>();
  const pairs: { n: number; o: number }[] = [];
  after.forEach((s, n) => {
    let o = before.findIndex((x, k) => !usedOld.has(k) && x.id === s.id);
    if (o < 0) o = before.findIndex((x, k) => !usedOld.has(k) && x.title.trim() !== '' && x.title === s.title);
    if (o >= 0) { usedOld.add(o); pairs.push({ n, o }); }
  });
  const pairedNew = new Set(pairs.map((p) => p.n));
  const changes: StepChange[] = [];
  const stats = { added: 0, removed: 0, changed: 0, moved: 0, unchanged: 0 };

  // Posisi relatif di antara langkah yang berpasangan: "pindah" hanya bila urutan relatifnya berubah.
  const order = pairs.map((p) => p.o);
  const stable = new Set<number>();
  // LIS sederhana O(n^2): langkah di luar subsekuens terpanjang dianggap pindah.
  const best: number[] = order.map(() => 1), prev: number[] = order.map(() => -1);
  for (let i = 0; i < order.length; i++) for (let j = 0; j < i; j++) if (order[j]! < order[i]! && best[j]! + 1 > best[i]!) { best[i] = best[j]! + 1; prev[i] = j; }
  let end = best.length ? best.indexOf(Math.max(...best)) : -1;
  while (end >= 0) { stable.add(end); end = prev[end]!; }

  after.forEach((s, n) => {
    if (!pairedNew.has(n)) { stats.added++; changes.push({ kind: 'added', step: s, index: n }); return; }
    const pi = pairs.findIndex((p) => p.n === n);
    const o = pairs[pi]!.o, old = before[o]!;
    const moved = !stable.has(pi);
    const fields: FieldChange[] = [];
    for (const [key, label] of DIFF_FIELDS) {
      const bv = show(old[key]), av = show(s[key]);
      if (bv !== av) fields.push({ key, label, before: bv, after: av, parts: diffText(bv, av) });
    }
    if (fields.length) { stats.changed++; changes.push({ kind: 'changed', stepId: s.id, title: s.title, index: n, oldIndex: o, moved, fields }); if (moved) stats.moved++; }
    else if (moved) { stats.moved++; changes.push({ kind: 'moved', stepId: s.id, title: s.title, index: n, oldIndex: o }); }
    else stats.unchanged++;
  });
  before.forEach((s, o) => { if (!usedOld.has(o)) { stats.removed++; changes.push({ kind: 'removed', step: s, index: o }); } });
  return { changes, stats };
}
