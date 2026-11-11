/* ProofLoop — bootstrap. © 2026 Vassel Goleyu. */
(function (PL) {
  PL.setTheme = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('pl.theme', t); } catch (e) {} };
  let th = 'light'; try { th = localStorage.getItem('pl.theme') || 'light'; } catch (e) {} document.documentElement.dataset.theme = th;
  PL.A.theme = () => { PL.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); PL.rerender(); };
  if (!location.hash) history.replaceState(null, '', '#/');
  PL.render();
  window.addEventListener('load', PL.icons);
})(window.PL);
