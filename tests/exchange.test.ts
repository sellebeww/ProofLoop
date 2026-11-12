import { describe, it, expect } from 'vitest';
import {
  guideDocOf, guideToJson, guideToMarkdown, parseGuideFile, importGuideIntoDraft, createProcessFromGuideFile, workspaceToJson, parseWorkspaceJson, adoptImport, LOCKED_HASH,
} from '../src/io/exchange.ts';
import { markdownToGuide, FIELDS } from '../src/io/markdown.ts';
import type { Step, State } from '../src/domain/types.ts';
import { makeCtx, makeState, reach, step } from './helpers.ts';

const ids = () => { let n = 0; return () => 'n' + ++n; };
const strip = (s: Step) => { const { id: _id, ...rest } = s; void _id; return rest; };
type Body = Omit<Step, 'id'>;
const norm = (s: Step): Body => ({ ...strip(s), files: [], needsEvidence: !!s.needsEvidence });
const canon = (v: string) => v.replace(/\r\n?/g, '\n').trim();
const canonStep = (s: Body): Body => {
  const o = { ...s, title: s.title.replace(/\r?\n|\r/g, ' ').trim() } as Record<string, unknown>;
  for (const [k] of FIELDS) o[k] = canon(String(o[k] ?? ''));
  return o as unknown as Body;
};

function rng(seed: number) { let x = seed; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
const ALPHA = ['a', 'b', ' ', '\n', '\n', '#', '##', '### ', '\\', '\\#', '---', '- kritis: ya', ':', '"', '“', 'é', '漢', '<b>', '\r\n', '## Langkah 9: x', '### Alasan', '# Judul'];
const rnd = (r: () => number, n: number) => Array.from({ length: n }, () => ALPHA[Math.floor(r() * ALPHA.length)]).join('');

describe('Markdown dengan frontmatter', () => {
  const doc = (steps: Step[]) => ({ name: 'Publikasi: “Mingguan”', category: 'Komunikasi', description: 'Baris 1\nBaris 2 "kutip"', version: '1.1', steps });

  it('menghasilkan frontmatter dan struktur yang terbaca manusia', () => {
    const md = guideToMarkdown(doc([step('Satu', { what: 'Apa', critical: true, needsEvidence: true })]), '2026-01-01T00:00:00.000Z');
    expect(md.startsWith('---\nproofloop: guide\nformat: 1\n')).toBe(true);
    expect(md).toContain('process: "Publikasi: “Mingguan”"');
    expect(md).toContain('description: "Baris 1 Baris 2 \\"kutip\\""');
    expect(md).toContain('## Langkah 1: Satu');
    expect(md).toContain('- kritis: ya');
    expect(md).toContain('- butuh-bukti: ya');
    expect(md).toContain('### Penjelasan\n\nApa');
    expect(md).not.toContain('### Alasan'); // bagian kosong tidak ditulis
  });

  it('round-trip kasus sulit: baris berawalan #, \\#, ---, judul langkah palsu, CRLF, unicode', () => {
    const tricky = step('Judul # dengan: titik dua', {
      what: '# bukan judul\n## Langkah 7: palsu\n### Alasan\n\\# sudah ada backslash\n\\\\# dua\n---\nbaris biasa',
      how: 'Baris A\r\nBaris B', success: '- kritis: ya\n漢字 é <b>x</b>', critical: true,
    });
    const md = guideToMarkdown(doc([tricky, step('Dua')]), 'x');
    const r = markdownToGuide(md, ids());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps).toHaveLength(2);
    expect(canonStep(norm(r.value.steps[0]!))).toEqual(canonStep(norm(tricky)));
    expect(r.value.name).toBe('Publikasi: “Mingguan”');
    expect(r.value.version).toBe('1.1');
    expect(r.warnings).toEqual([]);
  });

  it('round-trip acak (seed tetap): 300 panduan', () => {
    const r = rng(42);
    for (let i = 0; i < 300; i++) {
      const steps = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, k) => step('T' + k + rnd(r, 3), {
        what: rnd(r, 12), why: rnd(r, 6), prepare: rnd(r, 8), how: rnd(r, 10), success: rnd(r, 10), risk: rnd(r, 4), fallback: rnd(r, 4), warning: rnd(r, 4), example: rnd(r, 4),
        checklist: rnd(r, 6), decision: rnd(r, 6), critical: r() > 0.5, needsEvidence: r() > 0.5,
      }));
      const md = guideToMarkdown({ name: 'N' + rnd(r, 4), category: 'C', description: rnd(r, 5), version: 'draf', steps }, 't');
      const res = markdownToGuide(md, ids());
      expect(res.ok, md).toBe(true);
      if (!res.ok) return;
      expect(res.value.steps.map((s) => canonStep(norm(s)))).toEqual(steps.map((s) => canonStep(norm(s))));
    }
  });

  it('menolak masukan tidak valid dengan pesan jelas', () => {
    const bad = (t: string) => { const r = markdownToGuide(t, ids()); expect(r.ok).toBe(false); return r.ok ? [] : r.errors.join(' '); };
    expect(bad('# tanpa frontmatter')).toMatch(/Frontmatter/);
    expect(bad('---\nproofloop: lain\nformat: 1\n---\n')).toMatch(/bukan panduan/);
    expect(bad('---\nproofloop: guide\nformat: 2\n---\n## Langkah 1: A')).toMatch(/tidak didukung/);
    expect(bad('---\nproofloop: guide\nformat: 1\n---\n# Hanya judul')).toMatch(/Tidak ada langkah/);
    expect(bad('---\nproofloop: guide\nformat: 1\n')).toMatch(/Frontmatter/);
    const many = '---\nproofloop: guide\nformat: 1\n---\n' + Array.from({ length: 201 }, (_, i) => `## Langkah ${i + 1}: x`).join('\n');
    expect(bad(many)).toMatch(/Terlalu banyak/);
  });

  it('memberi peringatan untuk bagian tak dikenal dan jumlah langkah tak cocok', () => {
    const r = markdownToGuide('---\nproofloop: guide\nformat: 1\nsteps: 5\n---\n## Langkah 1: A\n\n### Rahasia\n\nx\n\n### Penjelasan\n\nok\n', ids());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.join('|')).toMatch(/Rahasia/);
      expect(r.warnings.join('|')).toMatch(/menyatakan 5 langkah/);
      expect(r.value.steps[0]!.what).toBe('ok');
    }
  });
});

describe('JSON panduan', () => {
  const s = (() => { const x = makeState(); return x; })();
  it('round-trip dan id langkah dibuat baru', () => {
    const d = guideDocOf(s, 'p1', 'draf')!;
    const json = guideToJson(d, '2026-01-01T00:00:00.000Z');
    expect(JSON.parse(json)).toMatchObject({ format: 'proofloop.guide', formatVersion: 1, version: 'draf' });
    const r = parseGuideFile(json, ids());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps.map((x) => norm(x))).toEqual(d.steps.map((x) => norm(x)));
    expect(r.value.steps.map((x) => x.id)).toEqual(['n1', 'n2']);
  });
  it('tidak membawa data anggota atau data praktik', () => {
    const { s: st } = reach('done');
    const json = guideToJson(guideDocOf(st, 'p1', '1.0')!, 'x');
    for (const k of ['own', 'suc', 'rev', 'email', 'pwHash', 'attempts', 'notifications']) expect(json).not.toContain(`"${k}"`);
    expect(json).not.toContain('contoh.id');
  });
  it('guideDocOf: versi atau proses tak ada → null', () => {
    expect(guideDocOf(s, 'x', 'draf')).toBeNull();
    expect(guideDocOf(s, 'p1', '9.9')).toBeNull();
  });
  it('menolak format salah, versi tak didukung, JSON rusak, langkah kosong', () => {
    const e = (t: string) => { const r = parseGuideFile(t, ids()); return r.ok ? '' : r.errors.join(' '); };
    expect(e('{ rusak')).toMatch(/JSON tidak valid/);
    expect(e('halo dunia')).toMatch(/Format tidak dikenali/);
    expect(e('{"format":"lain"}')).toMatch(/Bukan berkas panduan/);
    expect(e('{"format":"proofloop.guide","formatVersion":9,"steps":[]}')).toMatch(/tidak didukung/);
    expect(e('{"format":"proofloop.guide","formatVersion":1}')).toMatch(/steps/);
    expect(e('{"format":"proofloop.guide","formatVersion":1,"steps":[1,"x"]}')).toMatch(/Tidak ada langkah/);
    expect(e('x'.repeat(9 * 1024 * 1024))).toMatch(/terlalu besar/);
  });
  it('membersihkan tipe salah dan memotong teks panjang', () => {
    const r = parseGuideFile(JSON.stringify({ format: 'proofloop.guide', formatVersion: 1, steps: [{ title: 5, how: 'x'.repeat(50000), critical: 'ya', files: [1, 'a.png'] }, 7] }), ids());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.steps).toHaveLength(1);
      expect(r.value.steps[0]).toMatchObject({ title: '', critical: false, files: ['a.png'] });
      expect(r.value.steps[0]!.how).toHaveLength(20000);
      expect(r.warnings.length).toBe(1);
    }
  });
  it('MD dan JSON dikenali otomatis oleh parseGuideFile', () => {
    const d = guideDocOf(s, 'p1', 'draf')!;
    expect(parseGuideFile(guideToMarkdown(d, 'x'), ids()).ok).toBe(true);
    expect(parseGuideFile('﻿' + guideToJson(d, 'x'), ids()).ok).toBe(true);
  });
});

describe('impor ke proses', () => {
  const md = guideToMarkdown({ name: 'Impor', category: 'Keuangan', description: 'd', version: '1.0', steps: [step('Baru A'), step('Baru B')] }, 'x');
  it('mengganti draf bila boleh disunting dan pelaku pemilik/admin', () => {
    const s = makeState(); const c = makeCtx();
    expect(importGuideIntoDraft(s, c, 'suc', 'p1', md)).toMatchObject({ ok: false });
    expect(s.guides['p1']!.draft.map((x) => x.title)).toEqual(['Satu', 'Dua']);
    expect(importGuideIntoDraft(s, c, 'own', 'p1', md)).toMatchObject({ ok: true });
    expect(s.guides['p1']!.draft.map((x) => x.title)).toEqual(['Baru A', 'Baru B']);
    expect(importGuideIntoDraft(s, c, 'adm', 'p1', md).ok).toBe(true);
  });
  it('ditolak saat panduan terkunci; state tidak berubah', () => {
    const { s, c } = reach('progress');
    const before = JSON.stringify(s);
    expect(importGuideIntoDraft(s, c, 'own', 'p1', md)).toMatchObject({ ok: false });
    expect(JSON.stringify(s)).toBe(before);
  });
  it('berkas rusak tidak mengubah draf', () => {
    const s = makeState(); const c = makeCtx(); const before = JSON.stringify(s);
    expect(importGuideIntoDraft(s, c, 'own', 'p1', 'bukan panduan').ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('membuat proses baru berstatus draf', () => {
    const s = makeState(); const c = makeCtx();
    const r = createProcessFromGuideFile(s, c, 'own', md);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = s.processes.find((x) => x.id === r.pid)!;
    expect(p).toMatchObject({ name: 'Impor', category: 'Keuangan', stage: 'draft', ownerId: 'own', successorId: '' });
    expect(s.guides[r.pid]!.draft).toHaveLength(2);
    expect(s.processes).toHaveLength(2);
  });
});

describe('cadangan workspace', () => {
  const roundTrip = (s: State) => { const r = parseWorkspaceJson(workspaceToJson(s, 'x', { includeHashes: true })); if (!r.ok) throw new Error(r.errors.join('; ')); return r.state; };
  for (const stage of ['draft', 'ready', 'progress', 'submitted', 'improve', 'done'] as const) {
    it(`round-trip pada stage ${stage}`, () => {
      const { s } = reach(stage);
      s.members[0]!.pwHash = 'a'.repeat(64);
      const back = roundTrip(s);
      expect(back).toEqual({ ...s, session: { user: null } });
    });
  }
  it('tidak membawa sesi aktif ke state hasil impor', () => {
    expect(roundTrip(makeState()).session.user).toBeNull();
    expect(JSON.parse(workspaceToJson(makeState(), 'x')).state.session.user).toBeNull();
  });
  it('hash kata sandi hanya diekspor bila diminta', () => {
    const s = makeState(); s.members[0]!.pwHash = 'b'.repeat(64);
    expect(workspaceToJson(s, 'x')).not.toContain('bbbbbbbb');
    expect(workspaceToJson(s, 'x', { includeHashes: true })).toContain('bbbbbbbb');
    expect(s.members[0]!.pwHash).toBe('b'.repeat(64)); // sumber tidak dimutasi
  });
  it('adoptImport: mempertahankan sesi, mewarisi hash, mengunci akun non-demo tanpa hash', () => {
    const cur = makeState(); cur.session.user = 'own'; cur.members[0]!.pwHash = 'c'.repeat(64);
    const imp = roundTrip(makeState());
    imp.members.push({ id: 'dm', name: 'Demo', email: 'x@ruangaksi.id', roles: [], status: 'Aktif', last: '', title: '' });
    const { state, lockedEmails } = adoptImport(cur, imp);
    expect(state.session.user).toBe('own');
    expect(state.members.find((m) => m.id === 'own')!.pwHash).toBe('c'.repeat(64));
    expect(state.members.find((m) => m.id === 'suc')!.pwHash).toBe(LOCKED_HASH);
    expect(state.members.find((m) => m.id === 'dm')!.pwHash).toBeUndefined();
    expect(lockedEmails).toContain('suc@contoh.id');
    expect(lockedEmails).not.toContain('own@contoh.id');
    expect(adoptImport(null, imp).state.session.user).toBeNull();
    expect(imp.members.find((m) => m.id === 'suc')!.pwHash).toBeUndefined(); // masukan tidak dimutasi
  });

  const mutate = (fn: (j: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const j = JSON.parse(workspaceToJson(reach('submitted').s, 'x', { includeHashes: true })); fn(j); return parseWorkspaceJson(JSON.stringify(j));
  };
  const errs = (r: ReturnType<typeof parseWorkspaceJson>) => (r.ok ? '' : r.errors.join(' | '));

  it('menolak format, versi format, ver state, JSON rusak, ukuran', () => {
    expect(errs(mutate((j) => { j.format = 'x'; }))).toMatch(/Bukan cadangan/);
    expect(errs(mutate((j) => { j.formatVersion = 2; }))).toMatch(/tidak didukung/);
    expect(errs(mutate((j) => { j.state.ver = 2; }))).toMatch(/ver harus 1/);
    expect(errs(parseWorkspaceJson('{'))).toMatch(/JSON tidak valid/);
    expect(errs(parseWorkspaceJson('x'.repeat(9 * 1024 * 1024)))).toMatch(/terlalu besar/);
    expect(errs(parseWorkspaceJson('[]'))).toMatch(/Bukan cadangan/);
  });
  it('menolak id ganda, id berbahaya, referensi yatim', () => {
    expect(errs(mutate((j) => { j.state.members[1].id = j.state.members[0].id; }))).toMatch(/id ganda/);
    expect(errs(mutate((j) => { j.state.processes[0].id = '__proto__'; }))).not.toBe('');
    expect(errs(mutate((j) => { j.state.processes[0].id = 'a b'; }))).toMatch(/id tidak valid/);
    expect(errs(mutate((j) => { j.state.attempts[0].pid = 'tidak-ada'; }))).toMatch(/merujuk proses/);
    expect(errs(mutate((j) => { j.state.processes[0].reviewerId = 'hantu'; }))).toMatch(/anggota yang tidak ada/);
  });
  it('menolak keadaan mustahil (invarian stage)', () => {
    expect(errs(mutate((j) => { j.state.processes[0].stage = 'banana'; }))).toMatch(/stage tidak valid/);
    expect(errs(mutate((j) => { j.state.processes[0].stage = 'progress'; }))).toMatch(/progress tanpa praktik/);
    expect(errs(mutate((j) => { j.state.processes[0].stage = 'done'; }))).toMatch(/done tanpa praktik yang sudah direview|masih punya praktik/);
    expect(errs(mutate((j) => { j.state.guides.p1.versions = []; }))).toMatch(/belum punya versi/);
    expect(errs(mutate((j) => { j.state.processes[0].cycle = 0; }))).toMatch(/cycle tidak valid/);
    expect(errs(mutate((j) => { j.state.attempts[0].status = 'reviewed'; j.state.attempts[0].review = null; }))).toMatch(/tanpa data review/);
  });
  it('menetralkan rute berbahaya, memotong teks, dan membuang foto non-gambar', () => {
    const r = mutate((j) => {
      j.state.notifications = [{ id: 'n1', to: 'own', type: 't', title: 'x'.repeat(5000), body: '<img src=x onerror=alert(1)>', route: 'javascript:alert(1)', read: false, at: '' }];
      j.state.activity = [{ id: 'a1', who: 'own', text: 't', route: '//evil.example', at: '' }];
      j.state.attempts[0].stepEvidence = {
        s1: { text: 'ok', at: '', photo: { name: 'a.svg', dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } },
        s2: { text: 'ok', at: '', photo: { name: 'b.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } },
      };
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.notifications[0]!.route).toBe('#/beranda');
    expect(r.state.notifications[0]!.title).toHaveLength(300);
    expect(r.state.notifications[0]!.body).toBe('<img src=x onerror=alert(1)>'); // disimpan sebagai teks; UI meng-escape
    expect(r.state.activity[0]!.route).toBe('#/beranda');
    const ev = r.state.attempts[0]!.stepEvidence!;
    expect(ev['s1']!.photo).toBeUndefined();
    expect(ev['s2']!.photo?.dataUrl).toMatch(/^data:image\/png/);
    expect(r.warnings.join('|')).toMatch(/foto bukti dibuang/);
  });
  it('membuang panduan yatim dan hash kata sandi yang bukan sha-256', () => {
    const r = mutate((j) => { j.state.guides.hantu = { draft: [], versions: [] }; j.state.members[0].pwHash = 'bukan-hash'; });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.guides['hantu']).toBeUndefined();
      expect(r.state.members[0]!.pwHash).toBeUndefined();
      expect(r.warnings.join('|')).toMatch(/proses tak dikenal/);
    }
  });
  it('input hasil impor tidak berbagi referensi dengan objek mentah dan aman untuk prototype', () => {
    const r = mutate((j) => { j.state.attempts[0].self = { __proto__: { polluted: true }, q1: true }; });
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
