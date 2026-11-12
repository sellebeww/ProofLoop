import { describe, it, expect } from 'vitest';
import { setStepEvidence, addComment, deleteComment } from '../src/domain/evidence.ts';
import { submitAttempt, completeReview } from '../src/domain/workflow.ts';
import { reach } from './helpers.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('bukti per langkah', () => {
  it('menyimpan teks dan foto; mengosongkan keduanya menghapus bukti', () => {
    const { s, c } = reach('progress'); const a = s.attempts[0]!;
    expect(setStepEvidence(s, c, 'suc', a.id, 'st_satu', { text: 'ok', photo: { name: 'a.png', dataUrl: PNG } })).toMatchObject({ ok: true });
    expect(a.stepEvidence!['st_satu']).toMatchObject({ text: 'ok', photo: { name: 'a.png' } });
    expect(setStepEvidence(s, c, 'suc', a.id, 'st_satu', { text: ' ', photo: null })).toMatchObject({ ok: true, evidence: null });
    expect(a.stepEvidence!['st_satu']).toBeUndefined();
  });
  it('menolak foto non-gambar, SVG, terlalu besar', () => {
    const { s, c } = reach('progress'); const a = s.attempts[0]!;
    for (const dataUrl of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGI+', 'https://x.example/a.png', 'data:image/png;base64,' + 'A'.repeat(600_001)]) {
      expect(setStepEvidence(s, c, 'suc', a.id, 'st_satu', { text: '', photo: { name: 'x', dataUrl } })).toMatchObject({ ok: false, code: 'invalid_input' });
    }
    expect(a.stepEvidence!['st_satu']).toBeUndefined();
  });
  it('menolak langkah tak dikenal, selain penerus, dan setelah dikirim', () => {
    const { s, c } = reach('progress'); const a = s.attempts[0]!;
    expect(setStepEvidence(s, c, 'suc', a.id, 'hantu', { text: 'x' })).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(setStepEvidence(s, c, 'rev', a.id, 'st_satu', { text: 'x' })).toMatchObject({ ok: false, code: 'forbidden_actor' });
    submitAttempt(s, c, 'suc', a.id, { submission: { files: [], link: '', text: 'ok' }, self: {}, minutes: 5 });
    expect(setStepEvidence(s, c, 'suc', a.id, 'st_satu', { text: 'x' })).toMatchObject({ ok: false, code: 'forbidden_transition' });
  });
  it('memotong teks bukti yang terlalu panjang', () => {
    const { s, c } = reach('progress');
    setStepEvidence(s, c, 'suc', s.attempts[0]!.id, 'st_satu', { text: 'x'.repeat(9000) });
    expect(s.attempts[0]!.stepEvidence!['st_satu']!.text).toHaveLength(5000);
  });
});

describe('komentar reviewer', () => {
  it('hanya reviewer, hanya setelah hasil dikirim, langkah valid, tidak kosong', () => {
    const { s, c } = reach('progress'); const a = s.attempts[0]!;
    expect(addComment(s, c, 'rev', a.id, '', 'x')).toMatchObject({ ok: false, code: 'forbidden_transition' });
    submitAttempt(s, c, 'suc', a.id, { submission: { files: [], link: '', text: 'ok' }, self: {}, minutes: 5 });
    expect(addComment(s, c, 'own', a.id, '', 'x')).toMatchObject({ ok: false, code: 'forbidden_actor' });
    expect(addComment(s, c, 'suc', a.id, '', 'x')).toMatchObject({ ok: false, code: 'forbidden_actor' });
    expect(addComment(s, c, 'rev', a.id, '', '  ')).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(addComment(s, c, 'rev', a.id, 'hantu', 'x')).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(addComment(s, c, 'rev', a.id, '', 'x'.repeat(3001))).toMatchObject({ ok: false });
    expect(a.comments).toHaveLength(0);
    expect(addComment(s, c, 'rev', a.id, 'st_dua', ' Perjelas langkah ini ')).toMatchObject({ ok: true, comment: { text: 'Perjelas langkah ini', authorId: 'rev', stepId: 'st_dua' } });
    expect(a.comments).toHaveLength(1);
  });
  it('penulis dapat menghapus sebelum review selesai, tidak sesudahnya', () => {
    const { s, c, okInput } = reach('submitted'); const a = s.attempts[0]!;
    const r = addComment(s, c, 'rev', a.id, '', 'catatan'); if (!r.ok) throw new Error('x');
    expect(deleteComment(s, 'own', a.id, r.comment.id)).toMatchObject({ ok: false, code: 'forbidden_actor' });
    const r2 = addComment(s, c, 'rev', a.id, '', 'kedua'); if (!r2.ok) throw new Error('x');
    expect(deleteComment(s, 'rev', a.id, r2.comment.id).ok).toBe(true);
    expect(deleteComment(s, 'rev', a.id, 'nope')).toMatchObject({ ok: false, code: 'not_found' });
    completeReview(s, c, 'rev', a.id, okInput());
    expect(deleteComment(s, 'rev', a.id, r.comment.id)).toMatchObject({ ok: false, code: 'forbidden_transition' });
    expect(addComment(s, c, 'rev', a.id, '', 'setelah review').ok).toBe(true); // reviewer masih boleh menambah catatan
  });
});
