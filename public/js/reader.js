(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const novelSlug = params.get('novel') || '';
  const chapterSlug = params.get('chapter') || '';
  const root = document.documentElement;
  const body = document.body;
  const content = document.querySelector('#reader-content');
  const controls = document.querySelector('#reader-controls');
  let chapter;
  let csrf = '';
  let user = null;
  let saveTimer;
  const key = `saint-eresia:reader:${novelSlug}`;
  // Mention de fantraduction, affichée avant et après le texte du chapitre.
  const disclaimer = (extra = ``) => `<aside class="disclaimer ${extra}"><strong>Interdit à la vente</strong><p>Prière d’acheter les séries à leur sortie en France pour soutenir le marché et les auteurs.</p><p>Veuillez acheter la série une fois licenciée en France.</p></aside>`;
  const prefKey = 'saint-eresia:reader-preferences';
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));

  // Mode statique : le lecteur lit des fichiers JSON générés, sans compte ni sauvegarde serveur.
  const STATIC = typeof window !== 'undefined' && window.SAINT_ERESIA_STATIC === true;
  async function staticRequest(url) {
    if (url === '/api/auth/me') return { user: null, csrfToken: '' };
    if (url.startsWith('/api/chapters/')) {
      const response = await fetch(`/data/chapters/${url.slice(14)}.json`);
      if (!response.ok) throw new Error('Chapitre introuvable.');
      return response.json();
    }
    return null; // progression de lecture : ignorée, elle reste dans le navigateur
  }
  async function request(url, options = {}) {
    if (STATIC) return staticRequest(url);
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (!['GET','HEAD'].includes(options.method || 'GET') && csrf) headers['x-csrf-token'] = csrf;
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Contenu indisponible.');
    return data;
  }

  function preferences() { try { return JSON.parse(localStorage.getItem(prefKey)) || {}; } catch { return {}; } }
  function applyPrefs(next = preferences()) {
    root.style.setProperty('--reader-font', `${next.fontSize || 19}px`);
    root.style.setProperty('--reader-line', next.lineHeight || 1.9);
    root.style.setProperty('--reader-width', `${next.width || 760}px`);
    content.style.fontFamily = next.fontFamily || 'Georgia,serif';
    body.classList.remove('light','sepia','dark'); if (next.theme) body.classList.add(next.theme);
    document.querySelector('#font-size').value = next.fontSize || 19;
    document.querySelector('#line-height').value = Math.round((next.lineHeight || 1.9) * 10);
    document.querySelector('#reader-width').value = next.width || 760;
    document.querySelector('#font-family').value = next.fontFamily || 'Georgia,serif';
  }
  function savePrefs(delta) { const next = { ...preferences(), ...delta }; localStorage.setItem(prefKey, JSON.stringify(next)); applyPrefs(next); }

  function navTarget(offset) {
    const index = chapter.navigation.findIndex((item) => item.slug === chapter.slug);
    return chapter.navigation[index + offset];
  }
  function go(offset) { const target = navTarget(offset); if (target) location.assign(`/reader.html?novel=${encodeURIComponent(novelSlug)}&chapter=${encodeURIComponent(target.slug)}`); }

  function progress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(scrollY / max * 100)));
  }
  async function saveProgress() {
    if (!chapter) return;
    const value = { novelId: chapter.novel.id, chapterId: chapter.id, chapter: chapter.slug, position: Math.round(scrollY), percent: progress(), updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(value));
    if (user) { try { await request('/api/users/me/reading-progress', { method:'PUT', body:JSON.stringify(value) }); } catch {} }
  }
  function updateProgress() { document.querySelector('.reader-progress').style.width = `${progress()}%`; clearTimeout(saveTimer); saveTimer = setTimeout(saveProgress, 700); }

  async function init() {
    try { const me = await request('/api/auth/me'); user = me.user; csrf = me.csrfToken; chapter = await request(`/api/chapters/${encodeURIComponent(chapterSlug)}`); }
    catch (error) { content.innerHTML = `<h1>Chapitre indisponible</h1><p>${esc(error.message)}</p>`; return; }
    document.title = `${chapter.novel.title} — Chapitre ${chapter.number} | Saint Eresia`;
    document.querySelector('.reader-title').textContent = `${chapter.novel.title} · ${chapter.novel.readingUnit === `volume` ? `Tome ${chapter.volume.number}` : `Chapitre ${chapter.number}`}`;
    document.querySelector('#back-link').href = `/novel.html?slug=${encodeURIComponent(chapter.novel.slug)}`;
    content.innerHTML = `${chapter.novel.readingUnit === `volume` ? `<h1>Tome ${chapter.volume.number}${chapter.title ? ` — ${esc(chapter.title)}` : ``}</h1>` : `<p class="eyebrow">Volume ${chapter.volume.number}${chapter.volume.title ? ` · ${esc(chapter.volume.title)}` : ``}</p><h1>Chapitre ${chapter.number}${chapter.title ? ` — ${esc(chapter.title)}` : ``}</h1>`}${disclaimer()}${chapter.content}${disclaimer(`disclaimer-end`)}<nav class="reader-nav"><button class="btn" data-go="-1" ${!navTarget(-1)?'disabled':''}>← Chapitre précédent</button><button class="btn btn-primary" data-go="1" ${!navTarget(1)?'disabled':''}>Chapitre suivant →</button></nav>`;
    document.querySelector('#prev').disabled = !navTarget(-1); document.querySelector('#next').disabled = !navTarget(1);
    document.querySelectorAll('[data-go]').forEach((button) => button.onclick = () => go(Number(button.dataset.go)));
    applyPrefs();
    try { const saved = JSON.parse(localStorage.getItem(key)); if (saved?.chapter === chapter.slug && saved.position > 50) setTimeout(() => scrollTo({ top:saved.position, behavior:'smooth' }), 150); } catch {}
    window.addEventListener('scroll', updateProgress, { passive:true }); window.addEventListener('pagehide', saveProgress); updateProgress();
  }

  document.querySelector('#prev').onclick = () => go(-1); document.querySelector('#next').onclick = () => go(1);
  document.querySelector('#settings').onclick = () => { const hidden = controls.classList.toggle('hidden'); document.querySelector('#settings').setAttribute('aria-expanded', String(!hidden)); };
  document.querySelector('#font-size').oninput = (e) => savePrefs({ fontSize:Number(e.target.value) });
  document.querySelector('#line-height').oninput = (e) => savePrefs({ lineHeight:Number(e.target.value)/10 });
  document.querySelector('#reader-width').oninput = (e) => savePrefs({ width:Number(e.target.value) });
  document.querySelector('#font-family').onchange = (e) => savePrefs({ fontFamily:e.target.value });
  document.querySelectorAll('.theme').forEach((button) => button.onclick = () => savePrefs({ theme:button.dataset.theme }));
  document.querySelector('#focus').onclick = () => body.classList.toggle('focus');
  document.querySelector('#bookmark').onclick = () => { const marks = JSON.parse(localStorage.getItem('saint-eresia:bookmarks') || '[]'); marks.push({ novel:novelSlug, chapter:chapterSlug, position:scrollY, createdAt:new Date().toISOString() }); localStorage.setItem('saint-eresia:bookmarks',JSON.stringify(marks.slice(-50))); document.querySelector('#bookmark').textContent='✓ Signet enregistré'; };
  document.addEventListener('keydown', (event) => {
    if (['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowLeft') go(-1); if (event.key === 'ArrowRight') go(1);
    if (event.key.toLowerCase() === 'f') body.classList.toggle('focus');
    if (event.key.toLowerCase() === 'd') { const themes=['light','sepia','dark']; const current=preferences().theme||'light'; savePrefs({theme:themes[(themes.indexOf(current)+1)%3]}); }
    if (event.key === '+' || event.key === '=') savePrefs({fontSize:Math.min(28,(preferences().fontSize||19)+1)});
    if (event.key === '-') savePrefs({fontSize:Math.max(15,(preferences().fontSize||19)-1)});
    if (event.key === 'Escape') controls.classList.add('hidden');
  });
  document.addEventListener('DOMContentLoaded', init);
})();
