// ProofLoop: panduan <-> Markdown dengan frontmatter. Murni, tanpa DOM. © 2026 Vassel Goleyu.
import type { Step } from '../domain/types.ts';

export interface GuideDoc {
  name: string;
  category: string;
  description: string;
  /** 'draf' atau nomor versi, mis. "1.1". */
  version: string;
  steps: Step[];
}

/** Urutan dan label bagian per langkah. Label ini adalah bagian dari format berkas. */
export const FIELDS: readonly (readonly [keyof Step, string])[] = [
  ['what', 'Penjelasan'], ['why', 'Alasan'], ['prepare', 'Persiapan'], ['how', 'Cara melakukan'], ['success', 'Hasil yang berhasil'],
  ['risk', 'Risiko'], ['fallback', 'Jika bermasalah'], ['warning', 'Peringatan'], ['example', 'Contoh'], ['checklist', 'Daftar periksa'], ['decision', 'Titik keputusan'],
];

const LABEL_TO_KEY = new Map(FIELDS.map(([k, l]) => [l.toLowerCase(), k]));

export const MD_FORMAT = 1;

const oneLine = (s: string) => s.replace(/\r?\n|\r/g, ' ').trim();
/** Baris yang diawali '#' (dengan atau tanpa backslash di depannya) diberi satu backslash tambahan, agar tidak terbaca sebagai judul. */
const escBody = (s: string) => s.replace(/\r\n?/g, '\n').trim().split('\n').map((l) => (/^\\*#/.test(l) ? '\\' + l : l)).join('\n');
const unescBody = (s: string) => s.split('\n').map((l) => (/^\\+#/.test(l) ? l.slice(1) : l)).join('\n').trim();

export function guideToMarkdown(doc: GuideDoc, exportedAt: string): string {
  const fm = [
    '---',
    'proofloop: guide',
    `format: ${MD_FORMAT}`,
    `process: ${JSON.stringify(oneLine(doc.name))}`,
    `category: ${JSON.stringify(oneLine(doc.category))}`,
    `description: ${JSON.stringify(oneLine(doc.description))}`,
    `version: ${JSON.stringify(doc.version)}`,
    `exported: ${JSON.stringify(exportedAt)}`,
    `steps: ${doc.steps.length}`,
    '---',
    '',
    `# ${oneLine(doc.name) || 'Panduan'}`,
    '',
  ];
  const out = [...fm];
  doc.steps.forEach((s, i) => {
    out.push(`## Langkah ${i + 1}: ${oneLine(s.title)}`, '');
    out.push(`- kritis: ${s.critical ? 'ya' : 'tidak'}`, `- butuh-bukti: ${s.needsEvidence ? 'ya' : 'tidak'}`, '');
    for (const [k, label] of FIELDS) {
      const v = String(s[k] ?? '').trim();
      if (!v) continue;
      out.push(`### ${label}`, '', escBody(v), '');
    }
  });
  return out.join('\n').replace(/\n+$/, '\n');
}

export type ParseResult<T> = { ok: true; value: T; warnings: string[] } | { ok: false; errors: string[] };

function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } | null {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return null;
  const meta: Record<string, string> = {};
  for (const l of lines.slice(1, end)) {
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(l);
    if (m) meta[m[1]!] = m[2]!.trim();
  }
  return { meta, body: lines.slice(end + 1).join('\n') };
}

function metaString(raw: string | undefined): string {
  if (raw === undefined) return '';
  if (raw.startsWith('"')) { try { const v: unknown = JSON.parse(raw); return typeof v === 'string' ? v : ''; } catch { return ''; } }
  return raw.replace(/^'(.*)'$/, '$1');
}

export const MAX_STEPS = 200;
export const MAX_TEXT = 20_000;

export function markdownToGuide(input: string, newId: () => string): ParseResult<GuideDoc> {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fm = parseFrontmatter(text);
  if (!fm) return { ok: false, errors: ['Frontmatter tidak ditemukan. Berkas harus diawali dengan baris “---”.'] };
  if (metaString(fm.meta['proofloop']) !== 'guide' && fm.meta['proofloop'] !== 'guide') return { ok: false, errors: ['Berkas ini bukan panduan ProofLoop (proofloop: guide).'] };
  const fmt = Number(fm.meta['format']);
  if (fmt !== MD_FORMAT) return { ok: false, errors: [`Versi format ${fm.meta['format'] ?? '(kosong)'} tidak didukung; yang didukung: ${MD_FORMAT}.`] };

  const warnings: string[] = [];
  const steps: Step[] = [];
  let cur: Step | null = null;
  let field: keyof Step | null = null;
  let buf: string[] = [];
  let stepN = 0;
  const flush = () => {
    if (cur && field) {
      const v = unescBody(buf.join('\n'));
      if (v.length > MAX_TEXT) warnings.push(`Langkah ${stepN}: bagian “${String(field)}” dipotong ke ${MAX_TEXT} karakter.`);
      (cur as unknown as Record<string, string>)[field as string] = v.slice(0, MAX_TEXT);
    }
    field = null; buf = [];
  };

  for (const line of fm.body.split('\n')) {
    const h2 = /^## Langkah \d+:(.*)$/.exec(line);
    if (h2) {
      flush();
      stepN++;
      if (stepN > MAX_STEPS) return { ok: false, errors: [`Terlalu banyak langkah (maksimum ${MAX_STEPS}).`] };
      cur = {
        id: newId(), title: h2[1]!.trim().slice(0, 300), what: '', why: '', prepare: '', how: '', success: '', risk: '', fallback: '', critical: false,
        warning: '', example: '', checklist: '', decision: '', files: [], needsEvidence: false,
      };
      steps.push(cur);
      continue;
    }
    if (/^#{1,2} /.test(line) && !cur) continue; // judul H1 dokumen
    if (/^#{1,2} /.test(line) && cur) { flush(); warnings.push(`Judul tak dikenal diabaikan: “${line.slice(0, 40)}”.`); cur = null; continue; }
    const h3 = /^### (.+)$/.exec(line);
    if (h3 && cur) {
      flush();
      const key = LABEL_TO_KEY.get(h3[1]!.trim().toLowerCase());
      if (key) field = key; else warnings.push(`Langkah ${stepN}: bagian “${h3[1]!.trim()}” tidak dikenal dan diabaikan.`);
      continue;
    }
    if (cur && !field) {
      const meta = /^- (kritis|butuh-bukti):\s*(ya|tidak)\s*$/.exec(line);
      if (meta) { if (meta[1] === 'kritis') cur.critical = meta[2] === 'ya'; else cur.needsEvidence = meta[2] === 'ya'; }
      continue;
    }
    if (cur && field) buf.push(line);
  }
  flush();

  if (!steps.length) return { ok: false, errors: ['Tidak ada langkah ditemukan. Gunakan judul “## Langkah N: Judul”.'] };
  const declared = Number(fm.meta['steps']);
  if (Number.isFinite(declared) && fm.meta['steps'] !== undefined && declared !== steps.length) warnings.push(`Frontmatter menyatakan ${declared} langkah, tetapi ditemukan ${steps.length}.`);
  return {
    ok: true, warnings,
    value: {
      name: metaString(fm.meta['process']).slice(0, 200), category: metaString(fm.meta['category']).slice(0, 100),
      description: metaString(fm.meta['description']).slice(0, MAX_TEXT), version: metaString(fm.meta['version']).slice(0, 20) || 'draf', steps,
    },
  };
}
