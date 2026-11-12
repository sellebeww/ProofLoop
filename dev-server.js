// ProofLoop dev server (tanpa dependensi). Melayani dist/ (jalankan `npm run build` dulu). © 2026 Vassel Goleyu.
const http = require('http'), fs = require('fs'), path = require('path');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };
const ROOT = path.join(__dirname, 'dist');
const port = process.env.PORT || 5173;
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('Not found'); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(d); });
});
let p = +port;
server.on('error', e => { if (e.code === 'EADDRINUSE' && p < +port + 20) { console.log(`Port ${p} terpakai, mencoba ${p + 1}...`); server.listen(++p); } else { console.error(e.message); process.exit(1); } });
server.on('listening', () => console.log(`\n  ProofLoop berjalan di  http://localhost:${p}\n`));
server.listen(p);
