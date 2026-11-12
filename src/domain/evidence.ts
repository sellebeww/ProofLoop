// ProofLoop: bukti per langkah (teks/foto) dan komentar reviewer (murni). © 2026 Vassel Goleyu.
import type { Ctx, ReviewComment, State, StepEvidence } from './types.ts';
import { getAttempt, getGuide, getProcess, type Result } from './workflow.ts';

export const MAX_EVIDENCE_TEXT = 5000;
export const MAX_COMMENT = 3000;
export const MAX_PHOTO_CHARS = 600_000;
export const PHOTO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const fail = (code: 'not_found' | 'forbidden_transition' | 'forbidden_actor' | 'invalid_input', ...errors: string[]) => ({ ok: false as const, code, errors });

export interface EvidenceInput { text: string; photo?: { name: string; dataUrl: string } | null }

export function setStepEvidence(s: State, c: Ctx, actorId: string, aid: string, stepId: string, input: EvidenceInput): Result<{ evidence: StepEvidence | null }> {
  const a = getAttempt(s, aid);
  if (!a) return fail('not_found', 'Data praktik tidak ditemukan.');
  const p = getProcess(s, a.pid);
  if (!p) return fail('not_found', 'Proses tidak ditemukan.');
  if (a.status !== 'progress') return fail('forbidden_transition', 'Bukti hanya dapat diubah saat praktik sedang berjalan.');
  if (actorId !== p.successorId) return fail('forbidden_actor', 'Hanya penerus yang ditetapkan yang dapat melampirkan bukti.');
  const steps = getGuide(s, a.pid).versions.find((v) => v.v === a.guideVersion)?.steps ?? [];
  if (!steps.some((x) => x.id === stepId)) return fail('invalid_input', 'Langkah tidak ada pada versi panduan yang dipraktikkan.');
  const text = input.text.slice(0, MAX_EVIDENCE_TEXT);
  const ph = input.photo ?? undefined;
  if (ph && (ph.dataUrl.length > MAX_PHOTO_CHARS || !PHOTO_RE.test(ph.dataUrl))) return fail('invalid_input', 'Foto harus PNG, JPEG, atau WebP dan berukuran kecil (maksimum ±450 KB).');
  a.stepEvidence ??= {};
  if (!text.trim() && !ph) { delete a.stepEvidence[stepId]; return { ok: true, evidence: null }; }
  const ev: StepEvidence = { text, at: c.now(), ...(ph ? { photo: { name: ph.name.slice(0, 200), dataUrl: ph.dataUrl } } : {}) };
  a.stepEvidence[stepId] = ev;
  return { ok: true, evidence: ev };
}

export function addComment(s: State, c: Ctx, actorId: string, aid: string, stepId: string, text: string): Result<{ comment: ReviewComment }> {
  const a = getAttempt(s, aid);
  if (!a) return fail('not_found', 'Data praktik tidak ditemukan.');
  const p = getProcess(s, a.pid);
  if (!p) return fail('not_found', 'Proses tidak ditemukan.');
  if (a.status === 'progress') return fail('forbidden_transition', 'Komentar reviewer baru dapat diberikan setelah hasil dikirim.');
  if (actorId !== p.reviewerId) return fail('forbidden_actor', 'Hanya reviewer yang ditetapkan yang dapat memberi komentar.');
  const t = text.trim();
  if (!t) return fail('invalid_input', 'Komentar tidak boleh kosong.');
  if (t.length > MAX_COMMENT) return fail('invalid_input', `Komentar maksimum ${MAX_COMMENT} karakter.`);
  const steps = getGuide(s, a.pid).versions.find((v) => v.v === a.guideVersion)?.steps ?? [];
  if (stepId && !steps.some((x) => x.id === stepId)) return fail('invalid_input', 'Langkah tidak ada pada versi panduan ini.');
  const comment: ReviewComment = { id: c.uid('cm'), stepId, authorId: actorId, text: t, at: c.now() };
  (a.comments ??= []).push(comment);
  p.updatedAt = c.now();
  return { ok: true, comment };
}

/** Penulis komentar boleh menghapusnya selama hasil belum selesai direview. */
export function deleteComment(s: State, actorId: string, aid: string, commentId: string): Result<object> {
  const a = getAttempt(s, aid);
  if (!a) return fail('not_found', 'Data praktik tidak ditemukan.');
  const cm = a.comments?.find((x) => x.id === commentId);
  if (!cm) return fail('not_found', 'Komentar tidak ditemukan.');
  if (cm.authorId !== actorId) return fail('forbidden_actor', 'Hanya penulis yang dapat menghapus komentar.');
  if (a.status === 'reviewed') return fail('forbidden_transition', 'Komentar pada evaluasi yang sudah selesai tidak dapat dihapus.');
  a.comments = (a.comments ?? []).filter((x) => x.id !== commentId);
  return { ok: true };
}
