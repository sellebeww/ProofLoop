/* ProofLoop — UI core: templating, modal, toast, charts, router. © 2026 Vassel Goleyu. */
(function (PL) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const val = v => v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : (v == null || v === false) ? '' : esc(v);
  const html = (st, ...v) => new Raw(st.reduce((a, s, i) => a + s + (i < v.length ? val(v[i]) : ''), ''));
  Object.assign(PL, { esc, html, raw: s => new Raw(s), Raw });
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  PL.$ = $; PL.$$ = $$;
  PL.ic = (n, c = '') => html`<i data-lucide="${n}" class="i ${c}"></i>`;
  const ic = PL.ic;
  PL.icons = () => { try { window.lucide && lucide.createIcons(); } catch (e) {} };
  const fmtD = (d, o) => d ? new Date(d).toLocaleDateString('id-ID', o || { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  PL.fmtD = fmtD;
  PL.fmtDT = d => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ':') : '—';
  PL.fmtT = d => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  PL.rel = d => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; if (s < 86400 * 7) return Math.floor(s / 86400) + ' hari lalu'; return fmtD(d); };
  PL.initials = n => String(n || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  PL.avatar = (id, c = '') => { const m = PL.M(id); return html`<span class="avatar ${c}" title="${m ? m.name : ''}" aria-hidden="true">${PL.initials(m ? m.name : '?')}</span>`; };
  PL.person = id => html`<span class="row" style="gap:8px;flex-wrap:nowrap">${PL.avatar(id)}<span>${PL.name(id)}</span></span>`;
  PL.statusChip = p => { const s = PL.STATUS[PL.statusKey(p)]; return html`<span class="chip ${s.cls}">${ic(s.ic)} ${s.t}</span>`; };
  PL.outChip = o => { const s = PL.OUTCOME[o]; return s ? html`<span class="chip ${s.cls}">${ic(s.ic)} ${s.t}</span>` : html`<span class="chip">Belum dinilai</span>`; };
  PL.logo = (size = 32) => html`<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="lg${size}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1D4ED8"/><stop offset="1" stop-color="#4DB2FF"/></linearGradient></defs><path d="M9 47C20 47 24 31 33 25c9-6 22-1 21 8-1 9-13 10-21 2-5-5-9-11-21-12" fill="none" stroke="url(#lg${size})" stroke-width="8" stroke-linecap="round"/><path d="M19 22c8 1 12 7 16 12" fill="none" stroke="#fff" stroke-opacity=".0" stroke-width="1"/></svg>`;

  /* toast */
  PL.toast = (msg, type = 'ok') => {
    let c = $('.toasts'); if (!c) { c = document.createElement('div'); c.className = 'toasts'; c.setAttribute('role', 'status'); c.setAttribute('aria-live', 'polite'); document.body.appendChild(c); }
    const t = document.createElement('div'); t.className = 'toast ' + type; t.innerHTML = ic(type === 'err' ? 'alert-circle' : 'check-circle-2').s + '<span>' + esc(msg) + '</span>'; c.appendChild(t); PL.icons();
    setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 250); }, 3600);
  };
  /* modal */
  PL.closeModal = () => { $$('.ov').forEach(o => o.remove()); };
  PL.modal = ({ title, body, actions = [], wide, onOpen }) => {
    PL.closeModal();
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Tutup">${ic('x').s}</button></div><div class="modal-b">${val(body)}</div>${actions.length ? '<div class="modal-f"></div>' : ''}</div>`;
    const f = $('.modal-f', ov);
    actions.forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.cls || ''); b.innerHTML = (a.icon ? ic(a.icon).s + ' ' : '') + esc(a.label); b.onclick = () => { const r = a.fn ? a.fn(ov) : null; if (r !== false && !a.keep) ov.remove(); }; f.appendChild(b); });
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    ov.addEventListener('click', e => { if (e.target.closest('[data-close]')) ov.remove(); });
    document.body.appendChild(ov); PL.icons();
    const first = $('input:not([type=hidden]),textarea,select,.modal-f .btn:last-child', ov); first && first.focus();
    onOpen && onOpen(ov); return ov;
  };
  PL.confirm = (title, body, fn, o = {}) => PL.modal({ title, body: html`<p>${body}</p>`, actions: [{ label: o.cancel || 'Batal' }, { label: o.ok || 'Ya, lanjutkan', cls: o.danger ? 'danger solid' : 'primary', fn }] });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { PL.closeModal(); PL.pop(null); } });

  /* charts (SVG, accessible) */
  PL.donut = (items, o = {}) => {
    const R = 70, C = 2 * Math.PI * R, tot = items.reduce((a, i) => a + i.value, 0) || 1; let off = 0;
    const segs = items.filter(i => i.value > 0).map(i => { const len = i.value / tot * C, s = `<a href="${i.href || '#'}" aria-label="${esc(i.label)}: ${i.value}"><circle class="chart-seg" cx="90" cy="90" r="${R}" fill="none" stroke="${i.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(i.label)}: ${i.value}</title></circle></a>`; off += len; return s; }).join('');
    return html`<svg viewBox="0 0 180 180" width="${o.size || 180}" height="${o.size || 180}" role="img" aria-label="Diagram distribusi status"><circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--neutral-bg)" stroke-width="26"/>${PL.raw(segs)}<text x="90" y="88" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="30" fill="var(--text)">${items.reduce((a, i) => a + i.value, 0)}</text><text x="90" y="108" text-anchor="middle" font-size="11" fill="var(--muted)">${o.center || 'proses'}</text></svg>`;
  };
  PL.hbars = (items, o = {}) => { const mx = Math.max(1, ...items.map(i => i.value)); return html`<div class="col" style="gap:9px">${items.map(i => html`<${i.href ? 'a' : 'div'} ${PL.raw(i.href ? `href="${i.href}"` : '')} style="color:inherit;text-decoration:none"><div class="row between small"><span>${i.label}</span><b>${i.value}${o.unit || ''}</b></div><div class="bar" role="img" aria-label="${esc(i.label)}: ${i.value}"><i style="width:${Math.round(i.value / mx * 100)}%;background:${i.color || 'var(--brand)'}"></i></div></${i.href ? 'a' : 'div'}>`)}</div>`; };
  PL.vbars = (items, o = {}) => { const mx = Math.max(1, ...items.map(i => i.value)), w = 100 / items.length; return html`<svg viewBox="0 0 400 170" style="width:100%;max-width:560px;max-height:220px;display:block;margin:0 auto" role="img" aria-label="${o.label || 'Grafik batang'}">${PL.raw(items.map((i, k) => { const h = i.value / mx * 120, x = k * (400 / items.length) + 12, bw = 400 / items.length - 24; return `<rect x="${x}" y="${140 - h}" width="${bw}" height="${h}" rx="4" fill="${o.color || 'var(--brand)'}"><title>${esc(i.label)}: ${i.value}</title></rect><text x="${x + bw / 2}" y="${134 - h}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${i.value}</text><text x="${x + bw / 2}" y="158" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(i.label)}</text>`; }).join(''))}</svg>`; };
  PL.gbars = (items, la, lb) => { const mx = Math.max(1, ...items.flatMap(i => [i.a, i.b])); return html`<div class="col" style="gap:12px">${items.map(i => html`<div><div class="small b">${i.label}</div>${[[la, i.a, 'var(--warn)'], [lb, i.b, 'var(--ok)']].map(([l, v, c]) => html`<div class="row small" style="gap:8px;flex-wrap:nowrap"><span style="width:62px" class="muted">${l}</span><div class="bar grow" role="img" aria-label="${esc(i.label)} ${l}: ${v}"><i style="width:${Math.max(v ? 4 : 0, Math.round(v / mx * 100))}%;background:${c}"></i></div><b style="width:22px;text-align:right">${v}</b></div>`)}</div>`)}</div>`; };

  /* popups in the top bar */
  PL.ui = { pop: null, nav: false, q: '' };
  PL.pop = name => { PL.ui.pop = PL.ui.pop === name ? null : name; const h = $('#pop'); if (h) { h.innerHTML = PL.popHtml(); PL.icons(); } };

  /* registries */
  PL.A = {}; PL.F = {}; PL.I = {};
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!e.target.closest('#search')) { const sr = $('#sres'); sr && sr.remove(); }
    if (!t) { const inPop = e.target.closest('.pop'); if (PL.ui.pop && ((!inPop && !e.target.closest('[data-pop]')) || (inPop && e.target.closest('a[href]')))) { PL.ui.pop = null; const h = $('#pop'); h && (h.innerHTML = ''); } return; }
    const f = PL.A[t.dataset.act];
    if (!f) { console.error('Aksi tidak terdaftar:', t.dataset.act); PL.toast('Aksi belum tersedia: ' + t.dataset.act, 'err'); return; }
    if (t.tagName === 'A' && !t.getAttribute('href')) e.preventDefault();
    try { f(t, e); } catch (err) { console.error(err); PL.toast('Terjadi kesalahan: ' + err.message, 'err'); }
  });
  document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); const h = PL.F[f.dataset.form]; if (!h) { PL.toast('Form belum tersedia', 'err'); return; } try { h(f, e); } catch (err) { console.error(err); PL.toast('Terjadi kesalahan: ' + err.message, 'err'); } });
  ['input', 'change'].forEach(ev => document.addEventListener(ev, e => { const t = e.target.closest('[data-in]'); if (!t) return; if (t.dataset.ev && t.dataset.ev !== ev) return; const h = PL.I[t.dataset.in]; h && h(t, e); }));

  /* router */
  const routes = [];
  PL.route = (pat, fn, o = {}) => routes[pat.includes(':') ? 'push' : 'unshift']({ re: new RegExp('^' + pat.replace(/:(\w+)/g, '([^/]+)') + '$'), keys: [...pat.matchAll(/:(\w+)/g)].map(m => m[1]), fn, ...o });
  PL.query = () => { const q = {}; new URLSearchParams((location.hash.split('?')[1] || '')).forEach((v, k) => q[k] = v); return q; };
  PL.go = h => { if (location.hash === h) PL.render(); else location.hash = h; };
  PL.NAV = [['Beranda', '#/beranda', 'layout-dashboard'], ['Proses Kerja', '#/proses', 'workflow'], ['Transfer Pengetahuan', '#/transfer', 'repeat'], ['Tim', '#/tim', 'users'], ['Laporan', '#/laporan', 'bar-chart-3'], ['Notifikasi', '#/notifikasi', 'bell'], ['Pengaturan', '#/pengaturan', 'settings']];
  PL.unread = () => PL.S.notifications.filter(n => n.to === PL.S.session.user && !n.read).length;
  PL.shell = (r, nav) => {
    const me = PL.me(), u = PL.unread();
    return html`<div class="shell"><aside class="sb ${PL.ui.nav ? 'open' : ''}" id="sb" aria-label="Navigasi utama">
      <a class="logo" href="#/beranda">${PL.logo()}<span>Proof<b>Loop</b></span></a>
      <button class="org-sel" data-act="org-info" aria-label="Organisasi aktif"><span class="avatar">${PL.initials(PL.S.org.name)}</span><span class="grow"><span class="b" style="display:block;line-height:1.2">${PL.S.org.name}</span><span class="tiny muted">Workspace aktif</span></span>${ic('chevrons-up-down')}</button>
      <nav class="nav">${PL.NAV.map(([l, h, i]) => html`<a href="${h}" class="${nav === h ? 'on' : ''}" ${nav === h ? PL.raw('aria-current="page"') : ''} data-act="nav-close">${ic(i)} ${l}${l === 'Notifikasi' && u ? html`<span class="cnt">${u}</span>` : ''}</a>`)}
        <h6>Lainnya</h6><a href="#/profil" data-act="nav-close">${ic('building-2')} Profil ProofLoop</a><a href="#/" data-act="nav-close">${ic('globe')} Situs Publik</a></nav>
      <button class="me" data-act="pop-me" data-pop aria-label="Menu akun">${PL.avatar(me.id)}<span class="grow"><span class="b" style="display:block;line-height:1.2">${me.name}</span><span class="tiny muted">${me.roles[0]}</span></span>${ic('more-vertical')}</button>
    </aside>${PL.ui.nav ? html`<div class="scrim" data-act="nav-close"></div>` : ''}
    <div class="main"><header class="tb">
      <button class="icon-btn menu-btn" data-act="nav-open" aria-label="Buka menu">${ic('menu')}</button>
      <div class="crumb" aria-label="Breadcrumb">${r.crumbs.map((c, i) => i === r.crumbs.length - 1 ? html`<b>${c[0]}</b>` : html`<a href="${c[1]}">${c[0]}</a>${ic('chevron-right')}`)}</div>
      <div class="search" id="search"><label class="sr" for="q">Cari</label>${ic('search')}<input id="q" type="search" placeholder="Cari proses, anggota, notifikasi…" autocomplete="off" data-in="search" value="${PL.ui.q}"></div>
      <button class="icon-btn only-m" data-act="search-toggle" aria-label="Cari" style="margin-left:auto">${ic('search')}</button>
      <div style="position:relative" class="row" id="tbr"><button class="icon-btn" data-act="pop-notif" data-pop aria-label="Notifikasi, ${u} belum dibaca">${ic('bell')}${u ? html`<span class="badge-dot">${u}</span>` : ''}</button>
      <button class="icon-btn themebtn" data-act="theme" aria-label="Ganti tema terang atau gelap" title="Tema">${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
      <button class="icon-btn hide-m" data-act="help" aria-label="Pusat bantuan">${ic('help-circle')}</button>
      <button class="icon-btn" data-act="pop-me" data-pop aria-label="Menu akun">${PL.avatar(me.id)}</button><div id="pop"></div></div>
    </header><main class="content" id="content">${r.body}</main></div></div>`;
  };
  PL.popHtml = () => {
    const p = PL.ui.pop; if (!p) return '';
    const me = PL.me();
    if (p === 'notif') { const ns = PL.S.notifications.filter(n => n.to === me.id).slice(0, 5); return html`<div class="pop" role="menu"><div class="ph"><span>Notifikasi</span><a href="#/notifikasi">Lihat semua</a></div>${ns.length ? ns.map(n => html`<a href="${n.route}" data-act="notif-open" data-id="${n.id}" style="${n.read ? '' : 'background:var(--brand-soft)'}">${ic('bell', 'muted')}<span><b class="small" style="display:block">${n.title}</b><span class="tiny muted">${PL.rel(n.at)}</span></span></a>`) : html`<div class="empty" style="padding:20px">Belum ada notifikasi.</div>`}</div>`; }
    if (p === 'me') return html`<div class="pop" role="menu"><div class="ph"><span>${me.name}</span><span class="chip">${me.roles[0]}</span></div>
      ${PL.M('m1') ? html`<div class="tiny muted" style="padding:8px 14px 2px;font-weight:700;text-transform:uppercase">Ganti peran demo</div>` : ''}
      ${['m1', 'm2', 'm3'].filter(PL.M).map(id => html`<button class="it" data-act="switch-user" data-id="${id}">${PL.avatar(id)}<span><b class="small" style="display:block">${PL.name(id)} ${id === me.id ? PL.raw('✓') : ''}</b><span class="tiny muted">${{ m1: 'Pemegang pengetahuan · Admin', m2: 'Penerus', m3: 'Reviewer' }[id]}</span></span></button>`)}
      <hr style="border:0;border-top:1px solid var(--border);margin:4px 0"><a href="#/tim/${me.id}">${ic('user')} Profil saya</a><a href="#/pengaturan">${ic('settings')} Pengaturan</a><button class="it" data-act="reset-demo">${ic('rotate-ccw')} Reset data demo</button><button class="it" data-act="logout">${ic('log-out')} Keluar</button></div>`;
    return '';
  };
  PL.render = (keep) => {
    PL.closeModal(); PL.timers && PL.timers.forEach(clearInterval); PL.timers = [];
    const full = location.hash || '#/', path = full.slice(1).split('?')[0] || '/';
    let m = null, rt = null;
    for (const r of routes) { const x = r.re.exec(path); if (x) { m = {}; r.keys.forEach((k, i) => m[k] = decodeURIComponent(x[i + 1])); rt = r; break; } }
    const root = $('#root'), sy = window.scrollY;
    if (!rt) { root.innerHTML = html`<div class="empty" style="padding-top:20vh">${ic('compass')}<h3>Halaman tidak ditemukan</h3><p><a href="#/">Kembali ke beranda</a></p></div>`.s; PL.icons(); return; }
    if (rt.auth && !PL.S.session.user) { sessionStorage.setItem('pl.next', full); location.hash = '#/masuk'; return; }
    let r;
    try { r = rt.fn(m, PL.query()); } catch (err) { console.error(err); r = { layout: 'app', nav: '#/beranda', crumbs: [['Beranda', '#/beranda'], ['Kesalahan']], body: html`<div class="empty">${ic('alert-octagon')}<h3>Halaman gagal dimuat</h3><p>${err.message}</p><a class="btn mt" href="#/beranda">Ke Beranda</a></div>` }; }
    if (r.guest && PL.S.session.user) { location.hash = PL.S.onboarding ? '#/onboarding' : '#/beranda'; return; }
    document.title = (r.title || 'ProofLoop') + ' · ProofLoop';
    root.innerHTML = (r.layout === 'app' ? PL.shell(r, r.nav) : r.body).s;
    document.documentElement.classList.toggle('pub', r.layout === 'pub');
    PL.icons(); PL.autosize(); r.after && r.after();
    if (keep) window.scrollTo(0, sy); else window.scrollTo(0, 0);
  };
  PL.autosize = () => $$('textarea[data-f]').forEach(t => { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, 60) + 'px'; });
  document.addEventListener('input', e => { if (e.target.matches && e.target.matches('textarea[data-f]')) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; } });
  PL.rerender = () => PL.render(true);
  window.addEventListener('hashchange', () => { PL.ui.nav = false; PL.ui.pop = null; PL.render(); });
  PL.table = (cols, rows, o = {}) => html`<div class="tw"><table><thead><tr>${cols.map(c => html`<th scope="col">${c}</th>`)}</tr></thead><tbody>${rows}</tbody></table></div>`;
  PL.head = (title, desc, actions) => html`<div class="ph-head"><div><h1>${title}</h1>${desc ? html`<p>${desc}</p>` : ''}</div><div class="row">${actions || ''}</div></div>`;
  PL.empty = (icon, title, desc, action) => html`<div class="empty">${ic(icon)}<h3>${title}</h3><p>${desc}</p>${action ? html`<div class="mt">${action}</div>` : ''}</div>`;
  PL.field = (label, name, o = {}) => html`<label class="f">${label}${o.hint ? html`<span class="hint">${o.hint}</span>` : ''}${o.type === 'textarea' ? html`<textarea name="${name}" ${o.req ? PL.raw('required') : ''} placeholder="${o.ph || ''}" rows="${o.rows || 3}">${o.v || ''}</textarea>` : o.type === 'select' ? html`<select name="${name}">${o.opts.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return html`<option value="${v}" ${String(v) === String(o.v) ? PL.raw('selected') : ''}>${l}</option>`; })}</select>` : html`<input type="${o.type || 'text'}" name="${name}" value="${o.v ?? ''}" placeholder="${o.ph || ''}" ${o.req ? PL.raw('required') : ''} ${o.min != null ? PL.raw('min="' + o.min + '"') : ''}>`}</label>`;
  PL.fd = f => Object.fromEntries(new FormData(f).entries());
  PL.memberOpts = (rl) => PL.S.members.filter(m => m.status === 'Aktif').map(m => [m.id, m.name]);
  PL.download = (name, text, type = 'text/csv') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
})(window.PL);
