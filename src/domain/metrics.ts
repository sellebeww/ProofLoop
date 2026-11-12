// ProofLoop: metrik portofolio dan laporan keberlanjutan (murni). © 2026 Vassel Goleyu.
import type { Attempt, Process, State } from './types.ts';
import { countedAssist, getProcess } from './workflow.ts';

export type StatusKey = 'mandiri' | 'test' | 'fix' | 'none';

export function statusKey(p: Pick<Process, 'stage'>): StatusKey {
  return p.stage === 'done' ? 'mandiri' : p.stage === 'improve' ? 'fix' : p.stage === 'draft' ? 'none' : 'test';
}

export const isActive = (p: Pick<Process, 'stage'>): boolean => ['ready', 'progress', 'submitted', 'improve'].includes(p.stage);

export function portfolioMetrics(s: State) {
  const P = s.processes;
  const c = (k: StatusKey) => P.filter((p) => statusKey(p) === k).length;
  return { total: P.length, active: P.filter(isActive).length, mandiri: c('mandiri'), fix: c('fix'), test: c('test'), none: c('none') };
}

export interface ReportFilter {
  cat?: string; owner?: string; succ?: string; status?: string; from?: string; to?: string;
}

export interface Report {
  at: Attempt[];
  procs: string[];
  n: number;
  /** % praktik berhasil Mandiri, null bila belum ada praktik yang direview. */
  rate: number | null;
  mandiri: number;
  assist: number;
  byType: Record<string, number>;
  /** % kriteria wajib lulus (N/A tidak dihitung), null bila tidak ada data. */
  crit: number | null;
  critN: number;
  done: number;
  psN: number;
  monthly: Record<string, number>;
  ps: Process[];
}

export function report(s: State, f: ReportFilter = {}): Report {
  const okP = (p: Process) =>
    (!f.cat || p.category === f.cat) && (!f.owner || p.ownerId === f.owner) && (!f.succ || p.successorId === f.succ) && (!f.status || statusKey(p) === f.status);
  const at = s.attempts.filter((a) => {
    const p = getProcess(s, a.pid);
    if (!p || a.status !== 'reviewed' || !a.review) return false;
    const d = new Date(a.review.at);
    return (!f.from || d >= new Date(f.from)) && (!f.to || d <= new Date(f.to + 'T23:59:59')) && okP(p);
  });
  const mandiri = at.filter((a) => a.outcome === 'mandiri').length;
  let crit = 0, critOk = 0;
  at.forEach((a) => {
    const p = getProcess(s, a.pid)!;
    p.quality.filter((q) => q.mandatory).forEach((q) => {
      const r = a.review!.results[q.id];
      if (r && r !== 'na') { crit++; if (r === 'pass') critOk++; }
    });
  });
  const assistEv = at.flatMap((a) => countedAssist(a));
  const byType: Record<string, number> = {};
  assistEv.forEach((e) => { byType[e.type] = (byType[e.type] ?? 0) + 1; });
  const monthly: Record<string, number> = {};
  at.forEach((a) => {
    const d = new Date(a.submittedAt || a.review!.at);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    monthly[k] = (monthly[k] ?? 0) + 1;
  });
  const ps = s.processes.filter(okP);
  return {
    at, procs: [...new Set(at.map((a) => a.pid))], n: at.length, rate: at.length ? Math.round((mandiri / at.length) * 100) : null, mandiri,
    assist: assistEv.length, byType, crit: crit ? Math.round((critOk / crit) * 100) : null, critN: crit,
    done: ps.filter((p) => p.stage === 'done').length, psN: ps.length, monthly, ps,
  };
}
