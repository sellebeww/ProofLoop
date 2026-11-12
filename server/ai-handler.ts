// ProofLoop: handler AI tanpa framework (dipakai dev server dan fungsi Vercel). Kunci API hanya dibaca dari env di server.
// AI mati secara default: aktif hanya bila ANTHROPIC_API_KEY dan ANTHROPIC_MODEL keduanya terisi. © 2026 Vassel Goleyu.
import Anthropic from '@anthropic-ai/sdk';
import { reviewGuide, validateInput, type AiStepInput, type MessagesClient } from '../src/ai/review.ts';

export interface AiEnv { ANTHROPIC_API_KEY?: string | undefined; ANTHROPIC_MODEL?: string | undefined }
export interface AiResponse { status: number; json: unknown }
export interface AiDeps { makeClient?: (apiKey: string) => MessagesClient }

export const MAX_BODY_BYTES = 100_000;

export function aiStatus(env: AiEnv): { enabled: boolean; reason?: string } {
  if (!env.ANTHROPIC_API_KEY?.trim()) return { enabled: false, reason: 'ANTHROPIC_API_KEY belum diisi di .env' };
  if (!env.ANTHROPIC_MODEL?.trim()) return { enabled: false, reason: 'ANTHROPIC_MODEL belum diisi di .env' };
  return { enabled: true };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export async function handleAi(method: string, path: string, rawBody: string, env: AiEnv, deps: AiDeps = {}): Promise<AiResponse> {
  if (path === '/api/ai/status') {
    if (method !== 'GET') return { status: 405, json: { error: 'Metode tidak diizinkan.' } };
    return { status: 200, json: aiStatus(env) };
  }
  if (path !== '/api/ai/review') return { status: 404, json: { error: 'Tidak ditemukan.' } };
  if (method !== 'POST') return { status: 405, json: { error: 'Metode tidak diizinkan.' } };
  const st = aiStatus(env);
  if (!st.enabled) return { status: 503, json: { error: 'Fitur AI tidak aktif.', reason: st.reason } };
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return { status: 413, json: { error: 'Permintaan terlalu besar.' } };
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return { status: 400, json: { error: 'JSON tidak valid.' } }; }
  if (!isObj(body) || !Array.isArray(body['steps']) || !body['steps'].every(isObj)) return { status: 400, json: { error: 'Isian tidak valid.' } };
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const steps: AiStepInput[] = (body['steps'] as Record<string, unknown>[]).map((s) => ({
    title: str(s['title']), what: str(s['what']), how: str(s['how']), success: str(s['success']), prepare: str(s['prepare']), decision: str(s['decision']), warning: str(s['warning']),
  }));
  const bad = validateInput(steps);
  if (bad) return { status: 400, json: { error: bad } };
  try {
    const client = (deps.makeClient ?? ((k: string) => new Anthropic({ apiKey: k }) as unknown as MessagesClient))(env.ANTHROPIC_API_KEY!.trim());
    const r = await reviewGuide(client, env.ANTHROPIC_MODEL!.trim(), str(body['name']).slice(0, 200), steps);
    if ('error' in r) return { status: 502, json: { error: r.error } };
    return { status: 200, json: { suggestions: r.suggestions, dropped: r.dropped } };
  } catch {
    // Pesan galat penyedia tidak diteruskan: bisa memuat potongan permintaan atau detail akun.
    return { status: 502, json: { error: 'Layanan AI tidak dapat dihubungi atau menolak permintaan. Periksa kunci API dan nama model di .env.' } };
  }
}
