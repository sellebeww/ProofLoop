// ProofLoop: skor "keterpakaian" panduan. Rumus transparan; bobot adalah pilihan desain, bukan hasil kalibrasi statistik.
// © 2026 Vassel Goleyu.
import type { Attempt, Outcome, State } from './types.ts';
import { countedAssist, getGuide, getProcess, hasEvidence } from './workflow.ts';

export const OUTCOME_POINTS: Readonly<Record<Outcome, number>> = { mandiri: 100, dengan_bantuan: 60, belum: 0 };

export const WEIGHTS = { outcome: 40, steps: 35, criteria: 25 } as const;

export interface Component {
  key: 'outcome' | 'steps' | 'criteria';
  label: string;
  /** Bobot nominal (persen). */
  weight: number;
  /** Nilai komponen 0 sampai 100, atau null bila tidak bisa dihitung dari data. */
  value: number | null;
  /** Penjelasan angka mentahnya, untuk ditampilkan apa adanya. */
  detail: string;
}

export interface Usability {
  pid: string;
  /** 0 sampai 100, atau null bila belum ada praktik yang direview. Bukan 0. */
  score: number | null;
  components: Component[];
  /** Bobot efektif setelah komponen yang tak terhitung dibuang dan sisanya dinormalkan. */
  effectiveWeights: Record<string, number>;
  attemptId: string | null;
  cycle: number | null;
  guideVersion: string | null;
  /** Jumlah praktik yang sudah direview untuk proses ini (dasar skor adalah yang terakhir). */
  reviewedCount: number;
  trend: { cycle: number; version: string; score: number }[];
  evidence: { withEvidence: number; total: number } | null;
}

const pct = (n: number, d: number): number => (d ? (n / d) * 100 : 0);

export function scoreAttempt(s: State, a: Attempt): { score: number | null; components: Component[]; effectiveWeights: Record<string, number> } {
  const p = getProcess(s, a.pid);
  const ver = getGuide(s, a.pid).versions.find((v) => v.v === a.guideVersion);
  const steps = ver?.steps ?? [];
  const stepIds = new Set(steps.map((x) => x.id));

  const out = a.outcome ? OUTCOME_POINTS[a.outcome] : null;
  const friction = new Set<string>();
  countedAssist(a).forEach((e) => { if (stepIds.has(e.step)) friction.add(e.step); });
  a.issues.forEach((i) => { if (stepIds.has(i.step)) friction.add(i.step); });
  const mandatory = p ? p.quality.filter((q) => q.mandatory) : [];
  const rated = mandatory.map((q) => a.review?.results[q.id]).filter((r) => r === 'pass' || r === 'revision');
  const passed = rated.filter((r) => r === 'pass').length;

  const components: Component[] = [
    {
      key: 'outcome', label: 'Hasil praktik', weight: WEIGHTS.outcome, value: out,
      detail: a.outcome ? `Hasil “${a.outcome}” bernilai ${out}` : 'Belum ada hasil',
    },
    {
      key: 'steps', label: 'Langkah tanpa bantuan atau kendala', weight: WEIGHTS.steps, value: steps.length ? pct(steps.length - friction.size, steps.length) : null,
      detail: steps.length ? `${steps.length - friction.size} dari ${steps.length} langkah berjalan tanpa bantuan tervalidasi maupun laporan kendala` : 'Versi panduan tidak ditemukan',
    },
    {
      key: 'criteria', label: 'Kriteria wajib lulus', weight: WEIGHTS.criteria, value: rated.length ? pct(passed, rated.length) : null,
      detail: rated.length ? `${passed} dari ${rated.length} kriteria wajib yang dinilai lulus (N/A tidak dihitung)` : 'Tidak ada kriteria wajib yang dinilai',
    },
  ];
  const usable = components.filter((c) => c.value !== null);
  const total = usable.reduce((t, c) => t + c.weight, 0);
  const effectiveWeights: Record<string, number> = {};
  usable.forEach((c) => { effectiveWeights[c.key] = total ? Math.round((c.weight / total) * 1000) / 10 : 0; });
  const score = usable.length ? Math.round(usable.reduce((t, c) => t + (c.weight / total) * (c.value as number), 0)) : null;
  return { score, components, effectiveWeights };
}

export function usabilityOf(s: State, pid: string): Usability {
  const reviewed = s.attempts.filter((a) => a.pid === pid && a.status === 'reviewed').sort((x, y) => x.cycle - y.cycle);
  const last = reviewed[reviewed.length - 1];
  const base = { pid, reviewedCount: reviewed.length };
  if (!last) {
    return { ...base, score: null, components: [], effectiveWeights: {}, attemptId: null, cycle: null, guideVersion: null, trend: [], evidence: null };
  }
  const cur = scoreAttempt(s, last);
  const trend = reviewed.map((a) => ({ cycle: a.cycle, version: a.guideVersion, score: scoreAttempt(s, a).score })).filter((t): t is { cycle: number; version: string; score: number } => t.score !== null);
  const steps = getGuide(s, pid).versions.find((v) => v.v === last.guideVersion)?.steps ?? [];
  const need = steps.filter((x) => x.needsEvidence);
  const evidence = need.length ? { withEvidence: need.filter((x) => hasEvidence(last, x.id)).length, total: need.length } : null;
  return { ...base, ...cur, attemptId: last.id, cycle: last.cycle, guideVersion: last.guideVersion, trend, evidence };
}
