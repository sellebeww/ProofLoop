// ProofLoop dev server. Melayani dist/ (jalankan `npm run build` dulu) dan rute opsional /api/ai/*.
// Tanpa .env berisi ANTHROPIC_API_KEY dan ANTHROPIC_MODEL, fitur AI mati. © 2026 Vassel Goleyu.
const http = require('http'), fs = require('fs'), path = require('path');
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* .env opsional */ }
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };
const ROOT = path.join(__dirname, 'dist');
// Header keamanan diambil dari vercel.json agar yang diuji lokal sama dengan yang dipakai saat deploy.
let SEC = {};
try { const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8')); for (const h of (v.headers.find(x => x.source === '/(.*)') || { headers: [] }).headers) SEC[h.key] = h.value; } catch { /* tanpa header */ }
const port = process.env.PORT || 5173;
let aiMod; const ai = () => aiMod || (aiMod = import('./server/ai-handler.ts'));

const server = http.createServer(async (q, r) => {
  const url = q.url.split('?')[0];
  if (url.startsWith('/api/ai/')) {
    const chunks = []; let n = 0;
    for await (const c of q) { n += c.length; if (n > 200000) break; chunks.push(c); }
    try {
      const out = await (await ai()).handleAi(q.method, url, Buffer.concat(chunks).toString('utf8'), process.env);
      r.writeHead(out.status, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return r.end(JSON.stringify(out.json));
    } catch { r.writeHead(500, { 'Content-Type': 'application/json' }); return r.end(JSON.stringify({ error: 'Galat server.' })); }
  }
  let f = path.join(ROOT, decodeURIComponent(url));
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('Not found'); } r.writeHead(200, { ...SEC, 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(d); });
});
let p = +port;
server.on('error', e => { if (e.code === 'EADDRINUSE' && p < +port + 20) { console.log(`Port ${p} terpakai, mencoba ${p + 1}...`); server.listen(++p); } else { console.error(e.message); process.exit(1); } });
server.on('listening', () => {
  const on = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL);
  console.log(`\n  ProofLoop berjalan di  http://localhost:${p}\n  Asisten AI: ${on ? 'AKTIF (kunci dan model dari .env)' : 'mati (isi ANTHROPIC_API_KEY dan ANTHROPIC_MODEL di .env untuk mengaktifkan)'}\n`);
});
server.listen(p);
