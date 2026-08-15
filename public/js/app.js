(() => {
  'use strict';

  const state = { user: null, csrf: '', novels: [], patches: [] };
  // Renseigner l’invitation Discord pour afficher le bloc communauté sur l’accueil.
  const COMMUNITY = { discord: '' };
  // Mention affichée sur les fiches de romans et dans le lecteur.
  const DISCLAIMER = `<aside class="disclaimer"><strong>Interdit à la vente</strong><p>Prière d’acheter les séries à leur sortie en France pour soutenir le marché et les auteurs.</p><p>Veuillez acheter la série une fois licenciée en France.</p></aside>`;
  // Membres affichés sur /equipe.html. Les champs vides ne sont pas affichés : à compléter par l’équipe.
  // roles : autant de tags que voulu · projects : intitulés libres
  // links acceptés : github, twitter, bluesky, discord, youtube, gamebanana, linktree, site (une clé inconnue n’est pas affichée)
  const TEAM = [
    { name: 'Mekki', avatar: '/assets/icondev/mekki.webp', roles: ['Fondateur', 'Traduction (JA->FR)', 'Programmation', 'Hacking', 'Édition d’images'], projects: ['CHAOS;HEAD NOAH', 'CHAOS;CHILD', 'Rance 01', 'Zero no Tsukaima', 'Rakudai Kishi no Cavaltry', 'Suzumiya Haruhi'], links: { gamebanana: 'https://gamebanana.com/members/1957696', github: 'https://github.com/jabberwockyfool', youtube: 'https://www.youtube.com/@jabberwockyfool', linktree: 'https://guns.lol/wrotemysins' } },
    { name: 'Medpapaya', avatar: '/assets/icondev/medpapaya.webp', roles: ['Fondateur', 'Traduction (EN->FR)', 'Édition d’images', 'Programmation', 'Hacking'], projects: ['CHAOS;HEAD NOAH', 'CHAOS;CHILD', 'Rance 01', 'Suzumiya Haruhi'], links: { gamebanana: 'https://gamebanana.com/members/1835686', github: 'https://github.com/medlpb' } },
    { name: 'Beatripping', avatar: '/assets/icondev/beatripping.webp', roles: ['Traduction (JA->FR)', 'Site Internet', 'Programmation'], projects: ['CHAOS;CHILD', 'Rance 01', 'Zero No Tsukaima'], links: { github: 'https://github.com/JemiraCodePrime' } },
    { name: 'Ryuu7n', avatar: '/assets/icondev/ryuu7n.webp', roles: ['Communication', 'Bêta-Testing'], projects: ['CHAOS;CHILD', 'Rakudai Kishi no Cavalry'], links: { linktree: 'https://guns.lol/ryuu7n' } },
  ];
  const page = document.body.dataset.page || 'home';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  const fmt = (value) => new Intl.NumberFormat('fr-FR', { notation: Number(value) > 9999 ? 'compact' : 'standard' }).format(value || 0);
  const date = (value) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—';
  const params = new URLSearchParams(location.search);

  function toast(message, type = '') {
    let region = $('.toast-region');
    if (!region) { region = document.createElement('div'); region.className = 'toast-region'; region.setAttribute('aria-live', 'polite'); document.body.append(region); }
    const item = document.createElement('div'); item.className = `toast ${type}`; item.textContent = message; region.append(item); setTimeout(() => item.remove(), 3500);
  }

  // Mode statique (GitHub Pages) : aucune API derrière, les données viennent de fichiers JSON générés.
  // Le filtrage, le tri et la pagination sont rejoués ici à l'identique du serveur.
  const STATIC = typeof window !== 'undefined' && window.SAINT_ERESIA_STATIC === true;
  const staticCache = new Map();
  async function staticJson(file) {
    if (!staticCache.has(file)) {
      staticCache.set(file, fetch(file).then((response) => {
        if (!response.ok) throw new Error('Ressource introuvable.');
        return response.json();
      }));
    }
    return staticCache.get(file);
  }
  function staticList(items, query, kind) {
    const page = Math.max(1, Number(query.get('page')) || 1);
    const limit = Math.min(24, Math.max(1, Number(query.get('limit')) || 8));
    const search = String(query.get('search') || '').toLowerCase();
    let list = items.slice();
    if (search) {
      list = list.filter((x) => (kind === 'novels'
        ? [x.title, x.author, ...(x.genres || []), ...(x.tags || [])]
        : [x.title, ...(x.alternativeTitles || []), x.developer, x.publisher, x.team, x.vndbId]
      ).join(' ').toLowerCase().includes(search));
    }
    const exact = kind === 'novels'
      ? { type: 'type', status: 'workStatus', translationStatus: 'translationStatus' }
      : { platform: 'platform', status: 'status', engine: 'engine', team: 'team', type: 'type' };
    for (const [param, field] of Object.entries(exact)) {
      const value = query.get(param);
      if (value) list = list.filter((x) => (kind === 'novels' ? x[field] === value : String(x[field]).includes(value)));
    }
    const genre = query.get('genre');
    if (genre && kind === 'novels') list = list.filter((x) => (x.genres || []).includes(genre));
    const sorters = kind === 'novels'
      ? { popular: (a,b) => b.views-a.views, rating: (a,b) => b.rating-a.rating, followed: (a,b) => b.favorites-a.favorites, alpha: (a,b) => a.title.localeCompare(b.title), published: (a,b) => b.publishedAt.localeCompare(a.publishedAt), updated: (a,b) => b.updatedAt.localeCompare(a.updatedAt) }
      : { downloads: (a,b) => b.downloads-a.downloads, rating: (a,b) => b.rating-a.rating, alpha: (a,b) => a.title.localeCompare(b.title), progress: (a,b) => b.progress-a.progress, published: (a,b) => b.updatedAt.localeCompare(a.updatedAt), updated: (a,b) => b.updatedAt.localeCompare(a.updatedAt) };
    list.sort(sorters[query.get('sort')] || sorters.updated);
    const total = list.length;
    return { items: list.slice((page-1)*limit, page*limit), pagination: { page, limit, total, pages: Math.ceil(total/limit) } };
  }
  async function staticApi(url) {
    const [pathname, search = ''] = url.split('?');
    const query = new URLSearchParams(search);
    if (pathname === '/api/auth/me') return { user: null, csrfToken: '' };
    for (const kind of ['novels', 'patches']) {
      if (pathname === `/api/${kind}`) return staticList(await staticJson(`/data/${kind}.json`), query, kind);
      if (pathname.startsWith(`/api/${kind}/`)) return staticJson(`/data/${kind}/${pathname.slice(kind.length + 6)}.json`);
    }
    if (pathname.startsWith('/api/chapters/')) return staticJson(`/data/chapters/${pathname.slice(14)}.json`);
    throw new Error('Cette fonctionnalité demande un compte, indisponible sur la version publique.');
  }
  async function api(url, options = {}) {
    if (STATIC) return staticApi(url);
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (!['GET','HEAD'].includes(options.method || 'GET') && state.csrf) headers['x-csrf-token'] = state.csrf;
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.errors?.join(' ') || 'Une erreur est survenue.');
    return data;
  }

  function header() {
    const path = location.pathname;
    const current = (href) => path.endsWith(href) ? 'aria-current="page"' : '';
    $('#site-header').innerHTML = `<a class="skip-link" href="#main">Aller au contenu</a><header class="site-header"><div class="container header-inner"><a class="brand" href="/index.html" aria-label="Saint Eresia, accueil"><span class="brand-mark">SE</span><span><span class="brand-name">Saint Eresia</span><small>Light Novels &amp; Visual Novel Patches</small></span></a><nav class="nav" aria-label="Navigation principale"><a href="/index.html" ${current('index.html')}>Accueil</a><a href="/novels.html" ${current('novels.html')}>Novels</a><a href="/patchs.html" ${current('patchs.html')}>Patchs VN</a><a href="/equipe.html" ${current('equipe.html')}>Équipe</a>${STATIC ? `` : `<a href="/reading-list.html" ${current('reading-list.html')}>Liste de lecture</a><a href="/history.html" ${current('history.html')}>Historique</a>`}</nav><div class="header-actions"><a class="icon-button" href="/novels.html" aria-label="Rechercher">⌕</a><button class="icon-button js-theme" type="button" aria-label="Basculer entre thème sombre et clair" title="Thème sombre ou clair">${document.documentElement.dataset.theme === `light` ? `☾` : `☀`}</button>${STATIC ? `` : `<a class="icon-button" href="/favorites.html" aria-label="Favoris">♡</a>`}${STATIC ? `` : `<a class="user-chip" href="${state.user ? '/profile.html' : '/login.html'}"><span class="avatar">${esc((state.user?.name || 'C').charAt(0).toUpperCase())}</span><span>${esc(state.user?.name || 'Connexion')}</span></a>`}<button class="menu-button" type="button" aria-label="Ouvrir le menu" aria-expanded="false">☰</button></div></div></header><nav class="mobile-nav" aria-label="Navigation mobile"><a href="/index.html">Accueil</a><a href="/novels.html">Novels</a><a href="/patchs.html">Patchs VN</a><a href="/equipe.html">Équipe</a>${STATIC ? `` : `<a href="/reading-list.html">Liste de lecture</a><a href="/favorites.html">Favoris</a><a href="/history.html">Historique</a>`}${state.user?.role === 'ADMIN' ? '<a href="/admin/">Administration</a>' : ''}</nav>`;
    // Bascule sombre / clair, mémorisée d'une visite à l'autre.
    $('.js-theme').addEventListener('click', () => {
      const light = document.documentElement.dataset.theme === 'light';
      if (light) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = 'light';
      try { localStorage.setItem('saint-eresia:theme', light ? 'sombre' : 'light'); } catch { /* stockage refusé */ }
      $('.js-theme').textContent = light ? '☀' : '☾';
    });
    $('.menu-button').addEventListener('click', (event) => { const nav = $('.mobile-nav'); const open = nav.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(open)); event.currentTarget.textContent = open ? '×' : '☰'; });
  }

  function footer() {
    $('#site-footer').innerHTML = `<footer class="site-footer"><div class="container footer-grid"><div><a class="brand" href="/index.html"><span class="brand-mark">SE</span><span class="brand-name">Saint Eresia</span></a><p class="meta">Plateforme francophone consacrée aux Light Novels, Web Novels et patchs français pour œuvres narratives.</p></div><div><strong>Explorer</strong><div class="footer-links"><a href="/novels.html">Novels</a><a href="/patchs.html">Patchs VN</a><a href="/equipe.html">Équipe</a>${STATIC ? `` : `<a href="/favorites.html">Favoris</a>`}</div></div>${STATIC ? `` : `<div><strong>Compte</strong><div class="footer-links"><a href="/profile.html">Profil</a><a href="/reading-list.html">Liste de lecture</a><a href="/history.html">Historique</a></div></div>`}<div><strong>Informations</strong><div class="footer-links"><a href="/legal.html">Mentions légales</a><a href="/privacy.html">Confidentialité</a><a href="/terms.html">Conditions</a><a href="/copyright.html">Droits d’auteur</a><a href="/report.html">Signaler</a></div></div></div><div class="container footer-bottom">© 2026 Saint Eresia. Les œuvres originales appartiennent à leurs ayants droit. Nous encourageons leur achat.</div></footer>`;
  }

  const badge = (type) => `<span class="badge ${type === 'Patch VN' ? 'warning' : ''}">${esc(type)}</span>`;
  function novelCard(novel) { return `<article class="work-card"><a href="/novel.html?slug=${encodeURIComponent(novel.slug)}"><div class="cover"><img src="${esc(novel.cover)}" alt="${esc(novel.title)}" loading="lazy" width="360" height="480"></div><div class="card-body">${badge(novel.type)}<h3 title="${esc(novel.title)}">${esc(novel.title)}</h3><div class="meta"><span>${esc(novel.workStatus)}</span>${novel.rating ? `<span>•</span><span class="rating">★ ${esc(novel.rating)}</span>` : ``}</div><div class="meta">Mis à jour ${date(novel.updatedAt)}</div></div></a></article>`; }
  const AXIS_LABELS = { translation: 'Traduction', images: 'Images', technical: 'Technique', proofreading: 'Relecture' };
  // Un axe à null est sans objet pour ce patch (pas d'image à retoucher, par exemple) :
  // on ne l'affiche pas du tout plutôt que de montrer une barre vide trompeuse.
  function axisRows(patch) { const axes = patch.axes || {}; return `<dl class="axes">${Object.entries(AXIS_LABELS).filter(([key]) => axes[key] !== null && axes[key] !== undefined).map(([key, label]) => { const value = Math.max(0, Math.min(100, Number(axes[key]) || 0)); return `<div class="axis" data-axis="${key}" data-complete="${value === 100}"><dt>${label}</dt><dd class="progress slim"><span style="width:${value}%"></span></dd><dd class="axis-value">${value}%</dd></div>`; }).join('')}</dl>`; }
  function patchCard(patch) { return `<article class="work-card"><a href="/patch.html?slug=${encodeURIComponent(patch.slug)}"><div class="cover"><img src="${esc(patch.cover)}" alt="${esc(patch.title)}" loading="lazy" width="360" height="480"></div><div class="card-body">${badge('Patch VN')}<h3 title="${esc(patch.title)}">${esc(patch.title)}</h3><div class="meta">${patch.currentVersion ? `<span>v${esc(patch.currentVersion)}</span><span>•</span>` : ``}<span>${esc(patch.status)}</span></div><div class="meta">${esc(patch.platform)}</div><div class="meta" style="justify-content:space-between"><span>Avancement</span><span class="axis-value">${patch.progress}%</span></div><div class="progress" title="Avancement global : ${patch.progress}%"><span style="width:${patch.progress}%"></span></div></div></a></article>`; }
  function pageHead(title, description, crumb = title) { return `<section class="page-head"><div class="container"><div class="breadcrumbs"><a href="/index.html">Accueil</a> / ${esc(crumb)}</div><h1>${esc(title)}</h1><p class="meta">${esc(description)}</p></div></section>`; }

  async function loadCatalogs() {
    const [novels, patches] = await Promise.all([api('/api/novels?limit=24'), api('/api/patches?limit=24')]);
    state.novels = novels.items; state.patches = patches.items;
  }

  async function renderHome() {
    await loadCatalogs();
    const chapters = state.novels.flatMap((n) => n.volumes?.flatMap((v) => v.chapters.map((c) => ({ ...c, novel:n, volume:v }))) || []).filter((c) => c.status === 'Publié').slice(0,4);
    const inProgress = state.patches.filter((p) => p.progress < 100);
    const released = state.patches.filter((p) => p.versions && p.versions.length);
    let resume = '';
    if (state.user) {
      const progress = await api('/api/users/me/reading-progress');
      if (progress.length) {
        const current = progress[0], novel = state.novels.find((n) => n.id === current.novelId);
        const currentChapter = novel && novel.volumes.flatMap((v) => v.chapters).find((c) => c.id === current.chapterId);
        if (novel) resume = `<section><div class="block-title"><h2>Reprendre la lecture</h2></div><a class="list-row" href="/reader.html?novel=${encodeURIComponent(novel.slug)}&chapter=${encodeURIComponent(currentChapter ? currentChapter.slug : ``)}"><img class="list-cover" src="${esc(novel.cover)}" alt=""><div><h3>${esc(novel.title)}</h3><div class="progress slim"><span style="width:${current.percent}%"></span></div></div><span class="meta">${current.percent}%</span></a></section>`;
      }
    }
    const progressCard = (p) => `<article class="progress-card"><img src="${esc(p.cover)}" alt="" loading="lazy" width="92" height="123"><div><h3><a href="/patch.html?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h3><div class="meta">${esc(p.status)}</div><div class="overall"><strong>${p.progress}%</strong><span class="meta">au total</span></div>${axisRows(p)}</div></article>`;
    $('#main').innerHTML = `<div class="container home-layout">
      <div class="home-main">
        <section class="panel flat">
          <div class="panel-head"><h1>Traduction de visual novels et de light novels en français</h1></div>
          <div class="panel-body">
            <p>Saint Eresia traduit des visual novels et des light novels japonais vers le français. Nos patchs sont gratuits et ne contiennent jamais les fichiers du jeu d’origine : il faut posséder le jeu pour les utiliser.</p>
            <p>La liste complète se trouve sur la <a href="/patchs.html">page des patchs</a>, et nos traductions de romans dans le <a href="/novels.html">catalogue</a>. L’avancement des projets en cours est détaillé plus bas, axe par axe.</p>
          </div>
        </section>
        ${released.length ? `<section>
          <div class="block-title"><h2>Patchs disponibles</h2><a href="/patchs.html">Tout voir →</a></div>
          <div class="card-grid">${released.map(patchCard).join('')}</div>
        </section>` : ``}
        ${inProgress.length ? `<section>
          <div class="block-title"><h2>Avancement des projets</h2></div>
          <div class="progress-grid">${inProgress.map(progressCard).join('')}</div>
          <p class="note">Mis à jour par l’équipe au fil du travail.</p>
        </section>` : ``}
        ${resume}
        ${state.novels.length ? `<section>
          <div class="block-title"><h2>Romans traduits</h2><a href="/novels.html">Tout voir →</a></div>
          <div class="card-grid">${state.novels.map(novelCard).join('')}</div>
        </section>` : ``}
      </div>
      <aside class="home-side">
        ${COMMUNITY.discord ? `<div class="side-block">
          <h2>Discord</h2>
          <p>Pour suivre les projets, poser une question ou participer aux bêta-tests.</p>
          <a class="btn" href="${esc(COMMUNITY.discord)}" rel="noopener noreferrer">Rejoindre</a>
        </div>` : ``}
        <div class="side-block">
          <h2>Avant de télécharger</h2>
          <ul style="margin:0 0 12px;padding-left:18px;font-size:13.5px;color:hsl(var(--muted-fg))"><li>Le jeu d’origine doit être acheté légalement.</li><li>Sauvegardez vos fichiers avant d’appliquer un patch.</li><li>Vérifiez la version du jeu indiquée sur la fiche.</li></ul>
          <a class="btn" href="/patchs.html">Voir les fiches</a>
        </div>
        ${chapters.length ? `<div class="side-block">
          <h2>Derniers chapitres</h2>
          <div class="mini-list">${chapters.map((c) => `<a class="mini-row" href="/reader.html?novel=${encodeURIComponent(c.novel.slug)}&chapter=${encodeURIComponent(c.slug)}"><img src="${esc(c.novel.cover)}" alt="" loading="lazy"><div><strong>${esc(c.novel.title)}</strong><span>Volume ${c.volume.number} · Chapitre ${c.number} — ${esc(c.status)}</span></div></a>`).join('')}</div>
        </div>` : ``}
      </aside>
    </div>`;
  }

  function syncUrl(form) { const next = new URLSearchParams(new FormData(form)); [...next.entries()].forEach(([k,v]) => { if (!v) next.delete(k); }); history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`); }
  async function renderCatalog(kind) {
    const isNovel = kind === 'novels'; const query = new URLSearchParams(location.search); query.set('limit','8');
    const data = await api(`/api/${isNovel ? 'novels' : 'patches'}?${query}`);
    $('#main').innerHTML = `${pageHead(isNovel ? 'Catalogue des novels' : 'Patchs français pour Visual Novels', isNovel ? 'Parcourez les Light Novels et Web Novels disponibles.' : 'Téléchargez uniquement des fichiers de traduction autorisés — jamais les jeux complets.')}${isNovel ? `<section class="section" style="padding-bottom:0"><div class="container">${DISCLAIMER}</div></section>` : ``}<section class="section"><div class="container"><form class="filters" id="catalog-filters"><div class="field"><label for="search">Recherche</label><input class="input" id="search" name="search" value="${esc(params.get('search') || '')}" placeholder="Titre, auteur, équipe…"></div><div class="field"><label for="type">${isNovel ? 'Type' : 'Plateforme'}</label><select class="select" id="type" name="${isNovel ? 'type' : 'platform'}"><option value="">Tous</option>${(isNovel ? ['Light Novel','Web Novel'] : ['Windows','Linux','macOS']).map((v)=>`<option ${[...params.values()].includes(v)?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="status">Statut</label><select class="select" id="status" name="status"><option value="">Tous</option>${(isNovel ? ['En cours','Terminé','En pause','Abandonné','Licencié'] : ['En développement','Alpha','Bêta','Stable','Terminé','Obsolète','Abandonné']).map((v)=>`<option ${params.get('status')===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="sort">Trier</label><select class="select" id="sort" name="sort"><option value="updated">Récemment mis à jour</option><option value="${isNovel?'popular':'downloads'}">${isNovel?'Plus populaires':'Plus téléchargés'}</option><option value="rating">Mieux notés</option><option value="alpha">Ordre alphabétique</option>${isNovel?``:`<option value="progress">Traduction la plus avancée</option>`}<option value="published">Date de publication</option></select></div><button class="btn" type="reset">Réinitialiser</button></form><div class="filter-meta"><span>${data.pagination.total} résultat${data.pagination.total > 1 ? 's' : ''}</span><span>Page ${data.pagination.page} sur ${data.pagination.pages || 1}</span></div><div class="card-grid" id="catalog-results">${data.items.length ? data.items.map(isNovel ? novelCard : patchCard).join('') : '<div class="empty">Aucun contenu ne correspond à ces critères.</div>'}</div><div class="pagination">${Array.from({length:data.pagination.pages},(_,i)=>`<button data-page="${i+1}" class="${i+1===data.pagination.page?'active':''}">${i+1}</button>`).join('')}</div></div></section>`;
    const form = $('#catalog-filters'); let timer;
    const refresh = () => { syncUrl(form); location.reload(); };
    form.addEventListener('change', refresh); form.addEventListener('reset', () => setTimeout(() => { history.replaceState(null,'',location.pathname); location.reload(); },0));
    $('#search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 350); });
    $$('.pagination button').forEach((button) => button.addEventListener('click', () => { const url = new URL(location.href); url.searchParams.set('page', button.dataset.page); location.assign(url); }));
  }

  async function renderNovel() {
    const novel = await api(`/api/novels/${encodeURIComponent(params.get('slug') || '')}`);
    const first = novel.volumes.flatMap((v) => v.chapters).find((c) => c.imported);
    const byVolume = novel.readingUnit === `volume`; // un tome = une seule entrée lisible
    // On n’affiche que ce qui existe vraiment : l’ossature des tomes à venir reste masquée.
    const available = novel.volumes
      .map((v) => ({ ...v, chapters: v.chapters.filter((c) => c.imported) }))
      .filter((v) => v.chapters.length);
    const shown = available.length ? available : [];
    $('#main').innerHTML = `<section class="detail-hero"><div class="container detail-grid"><img class="detail-cover" src="${esc(novel.cover)}" alt="${esc(novel.title)}"><div class="detail-info"><div class="breadcrumbs"><a href="/novels.html">Novels</a> / ${esc(novel.title)}</div>${badge(novel.type)}<h1>${esc(novel.title)}</h1><p class="meta">${esc(novel.originalTitle)} · ${esc(novel.alternativeTitles.join(', '))}</p><p class="synopsis">${esc(novel.synopsis)}</p><div class="actions"><a class="btn btn-primary" href="/reader.html?novel=${novel.slug}&chapter=${first?.slug || ''}">Commencer la lecture</a>${STATIC ? `` : `<button class="btn js-favorite" data-type="novel" data-id="${novel.id}">♡ Ajouter aux favoris</button>`}${STATIC ? `` : `<button class="btn js-list" data-id="${novel.id}">＋ Ajouter à la liste</button>`}<button class="btn js-share">Partager</button></div></div></div></section><section class="section" style="padding-bottom:0"><div class="container">${DISCLAIMER}</div></section><section class="section"><div class="container content-layout"><div>${novel.translationNote ? `<p class="note-block">${esc(novel.translationNote)}</p>` : ``}<div class="section-head"><h2>Volumes et chapitres</h2></div>${!shown.length ? `<div class="empty">Aucun tome n’est encore disponible. La traduction est en cours.</div>` : ``}${shown.map((v)=>`<details class="volume" open><summary>Volume ${v.number}${v.title ? ` — ${esc(v.title)}` : ``} <span class="meta">${byVolume ? `à lire d’un bloc` : `${v.chapters.length} chapitres`}</span></summary><div class="list">${v.chapters.map((c)=>`<div class="chapter-row"><div><strong>${byVolume ? `Tome ${v.number}` : (c.kind && c.kind !== `chapter` ? esc(c.label) : `Chapitre ${c.number}`)}${c.title && c.title !== c.label ? ` — ${esc(c.title)}` : ``}</strong><small>${date(c.publishedAt)} · ${c.readingTime} min</small></div><span class="badge success">${esc(c.status)}</span><a class="btn" href="/reader.html?novel=${novel.slug}&chapter=${c.slug}">Lire</a>${c.download ? `<a class="btn" href="${esc(c.download.url)}" rel="noopener noreferrer" title="Télécharger le fichier hébergé hors du site">↓ ${esc(c.download.label)}</a>` : ``}</div>`).join('')}</div></details>`).join('')}</div><aside><div class="panel"><h2>Informations</h2><dl class="facts"><div class="fact"><dt>Auteur</dt><dd>${esc(novel.author)}</dd></div><div class="fact"><dt>Traduction</dt><dd>${esc(novel.translator)}</dd></div><div class="fact"><dt>Langues</dt><dd>${esc(novel.originalLanguage)} → Français</dd></div><div class="fact"><dt>Statut</dt><dd>${esc(novel.workStatus)}</dd></div><div class="fact"><dt>Note</dt><dd>★ ${novel.rating} (${fmt(novel.ratingsCount)})</dd></div><div class="fact"><dt>Lectures</dt><dd>${fmt(novel.views)}</dd></div></dl><div class="meta">${novel.genres.map((g)=>badge(g)).join(' ')}</div></div></aside></div></section><section class="section"><div class="container"><div class="section-head"><h2>Recommandations similaires</h2></div><div class="card-grid">${(await api('/api/novels?limit=4&sort=rating')).items.filter((n)=>n.id!==novel.id).slice(0,4).map(novelCard).join('')}</div></div></section>`;
    bindUserActions();
  }

  // Carrousel des captures : défilement automatique, mise en pause au survol, et agrandissement au clic.
  function setupShots(urls) {
    const rail = $('#shots');
    if (!rail || !urls.length) return;
    const dots = $$('#shot-dots button');
    let current = 0, timer = null;
    const goTo = (index, smooth = true) => {
      current = (index + urls.length) % urls.length;
      const target = rail.children[current];
      if (target) rail.scrollTo({ left: target.offsetLeft - rail.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
      dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
    };
    const start = () => { if (urls.length > 1) timer = setInterval(() => goTo(current + 1), 5000); };
    const stop = () => { clearInterval(timer); timer = null; };
    dots.forEach((dot) => dot.onclick = () => { stop(); goTo(Number(dot.dataset.go)); start(); });
    rail.addEventListener('mouseenter', stop);
    rail.addEventListener('mouseleave', start);
    rail.addEventListener('focusin', stop);
    start();

    // Vue agrandie : clic pour zoomer, flèches pour naviguer, Échap pour fermer.
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `<button class="lb-close" type="button" aria-label="Fermer">✕</button><button class="lb-nav lb-prev" type="button" aria-label="Capture précédente">‹</button><img alt=""><button class="lb-nav lb-next" type="button" aria-label="Capture suivante">›</button>`;
    document.body.appendChild(box);
    const image = box.querySelector('img');
    let shown = 0;
    const show = (index) => { shown = (index + urls.length) % urls.length; image.src = urls[shown]; image.classList.remove('zoomed'); };
    const open = (index) => { show(index); box.classList.add('open'); stop(); document.body.style.overflow = 'hidden'; };
    const close = () => { box.classList.remove('open'); document.body.style.overflow = ''; start(); };
    $$('#shots .shot').forEach((button) => button.onclick = () => open(Number(button.dataset.index)));
    box.querySelector('.lb-close').onclick = close;
    box.querySelector('.lb-prev').onclick = (event) => { event.stopPropagation(); show(shown - 1); };
    box.querySelector('.lb-next').onclick = (event) => { event.stopPropagation(); show(shown + 1); };
    image.onclick = (event) => { event.stopPropagation(); image.classList.toggle('zoomed'); };
    box.onclick = close;
    document.addEventListener('keydown', (event) => {
      if (!box.classList.contains('open')) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') show(shown - 1);
      if (event.key === 'ArrowRight') show(shown + 1);
    });
  }
  async function renderPatch() {
    const patch = await api(`/api/patches/${encodeURIComponent(params.get('slug') || '')}`);
    const shots = (patch.screenshots || []).filter(Boolean);
    const links = [
      { url: patch.repository, label: 'Dépôt du projet' },
      { url: patch.gamebanana, label: 'GameBanana' },
      { url: patch.vndbUrl, label: 'Fiche VNDB' }
    ].filter((link) => link.url);
    const shotsBlock = `<section class="section"><div class="container">
      <div class="block-title"><h2>Captures</h2></div>
      ${shots.length ? `<div class="shots-wrap">
        <div class="shots" id="shots">${shots.map((url, index) => `<button class="shot" type="button" data-index="${index}" aria-label="Agrandir la capture ${index + 1}"><img src="${esc(url)}" alt="" loading="lazy"></button>`).join('')}</div>
        ${shots.length > 1 ? `<div class="shot-dots" id="shot-dots">${shots.map((_, index) => `<button type="button" class="${index ? '' : 'active'}" data-go="${index}" aria-label="Aller à la capture ${index + 1}"></button>`).join('')}</div>` : ``}
      </div>` : `<div class="empty">Les captures du patch s’afficheront ici.</div>`}
    </div></section>`;
    const steamBlock = patch.steamAppId ? `<section class="section" style="padding-top:0"><div class="container">
      <iframe class="steam-widget" src="https://store.steampowered.com/widget/${esc(patch.steamAppId)}/" title="Acheter ${esc(patch.title)} sur Steam" loading="lazy"></iframe>
    </div></section>` : ``;
    const linksBlock = `<section class="section" style="padding-top:0"><div class="container">
      <div class="block-title"><h2>Liens</h2></div>
      ${links.length
        ? `<div class="link-row">${links.map((link) => `<a class="btn" href="${esc(link.url)}" rel="noopener noreferrer">${esc(link.label)}</a>`).join('')}</div>`
        : `<div class="empty">Dépôt du projet, page GameBanana et fiche VNDB s’afficheront ici.</div>`}
    </div></section>`;
    $('#main').innerHTML = `<section class="detail-hero"><div class="container detail-grid"><img class="detail-cover" src="${esc(patch.cover)}" alt="${esc(patch.title)}"><div class="detail-info"><div class="breadcrumbs"><a href="/patchs.html">Patchs VN</a> / ${esc(patch.title)}</div>${badge('Patch VN')}<h1>${esc(patch.title)}</h1><p class="meta">${patch.currentVersion ? `<span>Version ${esc(patch.currentVersion)}</span><span>·</span>` : ``}<span>${esc(patch.status)}</span><span>·</span><span>${patch.progress}%</span></p><p class="synopsis">${esc(patch.synopsis)}</p>${axisRows(patch)}<div class="actions">${patch.downloadUrl || patch.versions.length ? `<button class="btn btn-primary js-download">Télécharger le patch</button>` : `<button class="btn" disabled title="Aucun fichier publié pour le moment.">Patch indisponible</button>`}${STATIC ? `` : `<button class="btn js-favorite" data-type="patch" data-id="${patch.id}">♡ Ajouter aux favoris</button>`}<a class="btn" href="/report.html">Signaler un problème</a>${patch.vndbUrl ? `<a class="btn" href="${esc(patch.vndbUrl)}" rel="noopener noreferrer">Consulter sur VNDB</a>` : ``}</div></div></div></section>${shotsBlock}<section class="section"><div class="container content-layout"><div class="panel"><h2>Installation</h2><ol>${patch.instructions.map((x)=>`<li>${esc(x)}</li>`).join('')}</ol><h2>Prérequis</h2><ul>${patch.requirements.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul><h2>Changelog</h2><ul>${patch.changelog.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul><h2>Fichiers disponibles</h2><div class="table-wrap"><table><thead><tr><th>Version</th><th>Date</th><th>Taille</th><th>Fichier</th></tr></thead><tbody>${patch.versions.map((v)=>`<tr><td>${esc(v.version)}</td><td>${date(v.releasedAt)}</td><td>${esc(v.size)}</td><td>${v.url || patch.downloadUrl ? `<a class="btn" href="${esc(v.url || patch.downloadUrl)}" rel="noopener noreferrer">Télécharger</a>` : (v.checksum || patch.checksum ? `<code>${esc(v.checksum || patch.checksum)}</code>` : `—`)}</td></tr>`).join('')||`<tr><td colspan="4">Aucun fichier publié pour le moment.</td></tr>`}</tbody></table></div></div><aside class="panel"><h2>Compatibilité</h2><dl class="facts"><div class="fact"><dt>Plateformes</dt><dd>${esc(patch.platform)}</dd></div><div class="fact"><dt>Version du jeu</dt><dd>${esc(patch.gameVersion)}</dd></div><div class="fact"><dt>Moteur</dt><dd>${esc(patch.engine)}</dd></div><div class="fact"><dt>Équipe</dt><dd>${esc(patch.team)}</dd></div><div class="fact"><dt>Taille</dt><dd>${esc(patch.fileSize)}</dd></div><div class="fact"><dt>Téléchargements</dt><dd>${fmt(patch.downloads)}</dd></div></dl></aside></div></section>${steamBlock}${linksBlock}<div class="modal" id="download-modal" role="dialog" aria-modal="true" aria-labelledby="download-title"><div class="modal-card"><h2 id="download-title">Confirmer le téléchargement</h2><p>Vous allez télécharger uniquement un patch de traduction. Le jeu original n’est pas inclus.</p><ul><li>Jeu requis : ${esc(patch.gameVersion)}</li><li>Système : ${esc(patch.platform)}</li><li>Taille : ${esc(patch.fileSize)}</li><li>Langue : ${esc(patch.patchLanguage)}</li>${patch.warnings.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul><label class="checkbox"><input id="download-confirm" type="checkbox"> Je possède légalement le jeu et j’ai vérifié sa compatibilité.</label><div class="actions"><button class="btn js-close-modal">Annuler</button><button class="btn btn-primary js-confirm-download" disabled>Confirmer</button></div></div></div>`;
    bindUserActions(); setupShots(shots); const modal = $('#download-modal'); const release = patch.versions[0]; const trigger = $('.js-download'); if (trigger) trigger.onclick=()=>modal.classList.add('open'); $('.js-close-modal').onclick=()=>modal.classList.remove('open'); $('#download-confirm').onchange=(e)=>$('.js-confirm-download').disabled=!e.target.checked; $('.js-confirm-download').onclick=async()=>{ if(patch.downloadUrl){ window.open(patch.downloadUrl, `_blank`, `noopener`); modal.classList.remove(`open`); return; } try{ await api(`/api/patch-versions/${release.id}/download`,{method:'POST'}); modal.classList.remove('open'); toast('Téléchargement de démonstration enregistré.','success'); }catch(e){toast(e.message,'error');} };
  }

  function bindUserActions() {
    $$('.js-favorite').forEach((button)=>button.addEventListener('click', async()=>{ if(!state.user) return location.assign('/login.html'); try{ await api('/api/users/me/favorites',{method:'POST',body:JSON.stringify({itemType:button.dataset.type,itemId:Number(button.dataset.id)})}); button.textContent='♥ Dans les favoris'; toast('Favori ajouté.','success'); }catch(e){toast(e.message,'error');} }));
    $$('.js-list').forEach((button)=>button.addEventListener('click',async()=>{if(!state.user)return location.assign('/login.html');try{await api('/api/users/me/reading-list',{method:'PUT',body:JSON.stringify({novelId:Number(button.dataset.id),category:'À lire'})});button.textContent='✓ Dans la liste';toast('Liste de lecture mise à jour.','success');}catch(e){toast(e.message,'error');}}));
    $$('.js-share').forEach((button)=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('Lien copié.','success');}catch{toast('Copie impossible.','error');}}));
  }

  async function renderLibrary(type) {
    if (!state.user) return renderLoginRequired();
    if (type === 'favorites') { const data=await api('/api/users/me/favorites'); const favoriteCard=(item,kind)=>`<div class="favorite-item">${kind==='novel'?novelCard(item):patchCard(item)}<button class="btn btn-danger js-remove-favorite" data-id="${item.favoriteId}" style="width:100%;margin-top:7px">Retirer</button></div>`; $('#main').innerHTML=`${pageHead('Favoris','Vos novels et patchs enregistrés.')}<section class="section"><div class="container"><div class="section-head"><h2>Novels favoris</h2></div><div class="card-grid">${data.novels.length?data.novels.map((x)=>favoriteCard(x,'novel')).join(''):'<div class="empty">Aucun novel favori.</div>'}</div><div class="section-head" style="margin-top:34px"><h2>Patchs favoris</h2></div><div class="card-grid">${data.patches.length?data.patches.map((x)=>favoriteCard(x,'patch')).join(''):'<div class="empty">Aucun patch favori.</div>'}</div></div></section>`; $$('.js-remove-favorite').forEach((button)=>button.onclick=async()=>{try{await api(`/api/users/me/favorites/${button.dataset.id}`,{method:'DELETE'});button.closest('.favorite-item').remove();toast('Favori retiré.','success');}catch(error){toast(error.message,'error');}}); }
    if (type === 'reading-list') { const data=await api('/api/users/me/reading-list'); $('#main').innerHTML=`${pageHead('Liste de lecture','Organisez vos prochaines lectures.')}<section class="section"><div class="container"><div class="tabs reading-tabs">${['Toutes','À lire','En cours','Terminé','En pause','Abandonné'].map((x,i)=>`<button class="tab ${i===0?'active':''}" data-category="${x}">${x}</button>`).join('')}</div><div class="list">${data.length?data.map((x)=>`<div class="list-row reading-entry" data-category="${esc(x.category)}"><img class="list-cover" src="${x.novel.cover}" alt=""><div><h3>${esc(x.novel.title)}</h3><div class="meta">${esc(x.category)} · Dernière activité récemment</div><div class="progress"><span style="width:42%"></span></div></div><a class="btn" href="/novel.html?slug=${x.novel.slug}">Continuer</a></div>`).join(''):'<div class="empty">Votre liste de lecture est vide.</div>'}</div></div></section>`; $$('.reading-tabs .tab').forEach((button)=>button.onclick=()=>{$$('.reading-tabs .tab').forEach((x)=>x.classList.remove('active'));button.classList.add('active');$$('.reading-entry').forEach((row)=>row.hidden=button.dataset.category!=='Toutes'&&row.dataset.category!==button.dataset.category);}); }
    if (type === 'history') { const data=await api('/api/users/me/history'); $('#main').innerHTML=`${pageHead('Historique','Retrouvez vos consultations et téléchargements récents.')}<section class="section"><div class="container"><div class="section-head"><h2>Activité récente</h2><button class="btn btn-danger js-clear">Tout effacer</button></div><div class="list">${data.length?data.map((x)=>`<div class="list-row"><div class="list-cover"></div><div><h3>${esc(x.itemType)}</h3><span class="meta">${date(x.viewedAt)}</span></div><button class="btn" data-delete="${x.id}">Supprimer</button></div>`).join(''):'<div class="empty">Aucune activité enregistrée.</div>'}</div></div></section>`; $('.js-clear').onclick=async()=>{await api('/api/users/me/history/all',{method:'DELETE'});location.reload();}; $$('[data-delete]').forEach((button)=>button.onclick=async()=>{await api(`/api/users/me/history/${button.dataset.delete}`,{method:'DELETE'});button.closest('.list-row').remove();}); }
  }

  function renderLoginRequired(){ $('#main').innerHTML=`${pageHead('Connexion requise','Cette section est synchronisée avec votre compte.')}<section class="section"><div class="container empty"><p>Connectez-vous pour accéder à cette page.</p><a class="btn btn-primary" href="/login.html">Se connecter</a></div></section>`; }

  function renderAuth(mode) {
    const isLogin=mode==='login', isRegister=mode==='register', isForgot=mode==='forgot';
    $('#main').innerHTML=`<div class="auth-wrap"><section class="auth-card"><p class="eyebrow">Saint Eresia</p><h1>${isLogin?'Connexion':isRegister?'Créer un compte':'Mot de passe oublié'}</h1><p class="meta">${isLogin?'Reprenez votre lecture là où vous l’avez laissée.':isRegister?'Créez votre bibliothèque personnelle.':'Recevez une procédure de réinitialisation.'}</p><form class="form-stack" id="auth-form">${isRegister?'<div class="field"><label for="username">Nom d’utilisateur</label><input class="input" id="username" name="username" required minlength="3" autocomplete="username"></div>':''}<div class="field"><label for="email">Adresse e-mail</label><input class="input" id="email" name="email" type="email" required autocomplete="email"></div>${!isForgot?'<div class="field"><label for="password">Mot de passe</label><input class="input" id="password" name="password" type="password" required minlength="10" autocomplete="current-password"></div>':''}<div class="form-message" aria-live="polite"></div><button class="btn btn-primary" type="submit">${isLogin?'Se connecter':isRegister?'S’inscrire':'Envoyer'}</button></form><p class="meta">${isLogin?'<a class="link" href="/forgot-password.html">Mot de passe oublié ?</a> · <a href="/register.html">Créer un compte</a>':isRegister?'<a href="/login.html">Déjà inscrit ? Se connecter</a>':'<a href="/login.html">Retour à la connexion</a>'}</p></section></div>`;
    $('#auth-form').addEventListener('submit',async(e)=>{e.preventDefault();const message=$('.form-message');const body=Object.fromEntries(new FormData(e.currentTarget));try{const data=await api(`/api/auth/${isLogin?'login':isRegister?'register':'forgot-password'}`,{method:'POST',body:JSON.stringify(body)});if(data.csrfToken)state.csrf=data.csrfToken;message.className='form-message success';message.textContent=data.message||'Connexion réussie.';if(data.resetUrl){const link=document.createElement('a');link.className='link';link.href=data.resetUrl;link.textContent=' Ouvrir le lien de développement.';message.append(link);}if(!isForgot)setTimeout(()=>location.assign('/profile.html'),700);}catch(error){message.textContent=error.message;}});
  }

  async function renderProfile(){ if(!state.user)return renderLoginRequired(); $('#main').innerHTML=`${pageHead('Mon profil','Gérez votre compte et vos préférences de lecture.')}<section class="section"><div class="container profile-grid"><nav class="side-nav panel"><a class="active" href="#profile">Profil</a><a href="/favorites.html">Favoris</a><a href="/reading-list.html">Liste de lecture</a><a href="/history.html">Historique</a>${state.user.role==='ADMIN'?'<a href="/admin/">Administration</a>':''}<button class="btn js-logout">Déconnexion</button></nav><form class="panel form-stack" id="profile-form"><h2>Informations personnelles</h2><div class="field"><label for="name">Nom affiché</label><input class="input" id="name" name="name" value="${esc(state.user.name)}"></div><div class="field"><label for="email">E-mail</label><input class="input" id="email" value="${esc(state.user.email)}" disabled></div><div class="field"><label for="bio">Présentation</label><textarea class="textarea" id="bio" name="bio">${esc(state.user.bio||'')}</textarea></div><h2>Préférences du lecteur</h2><div class="field"><label for="theme">Thème par défaut</label><select class="select" id="theme"><option>Sombre</option><option>Clair</option><option>Sépia</option></select></div><button class="btn btn-primary">Enregistrer</button></form></div></section>`; $('.js-logout').onclick=async()=>{await api('/api/auth/logout',{method:'POST'});location.assign('/index.html');};$('#profile-form').onsubmit=async(e)=>{e.preventDefault();try{await api('/api/users/me/profile',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast('Profil enregistré.','success');}catch(error){toast(error.message,'error');}}; }

  async function renderAdmin(){ if(!state.user||!['ADMIN','MODERATOR'].includes(state.user.role))return renderLoginRequired();const stats=await api('/api/admin/dashboard');$('#main').innerHTML=`${pageHead('Administration','Pilotez les publications et les comptes autorisés.')}<section class="section"><div class="container admin-grid"><nav class="side-nav panel"><a class="active" href="/admin/">Vue d’ensemble</a><a href="/admin/novels.html">Novels</a><a href="/admin/chapters.html">Chapitres</a><a href="/admin/patches.html">Patchs VN</a><a href="/admin/users.html">Utilisateurs</a><a href="/admin/media.html">Médias</a><a href="/admin/settings.html">Réglages</a></nav><div><div class="kpis"><div class="kpi"><strong>${stats.novels}</strong>Novels</div><div class="kpi"><strong>${stats.chapters}</strong>Chapitres</div><div class="kpi"><strong>${stats.patches}</strong>Patchs</div><div class="kpi"><strong>${stats.users}</strong>Utilisateurs</div></div><div class="panel" style="margin-top:18px"><h2>Actions récentes</h2>${stats.recentAudit.length?stats.recentAudit.map(x=>`<p class="meta">${esc(x.action)} · ${esc(x.entity)} #${x.entityId}</p>`).join(''):'<p class="empty">Aucune action récente.</p>'}</div></div></div></section>`; }

  async function init() {
    try { const me=await api('/api/auth/me'); state.user=me.user; state.csrf=me.csrfToken; } catch {}
    header(); footer();
    try {
  const SOCIAL_ICONS = {
    github: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.84.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.02 4.13H5.05l12.03 15.64Z"/></svg>',
    bluesky: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M12 10.8c-.9-1.8-3.4-5.1-5.7-6.7C4.1 2.6 3.2 2.9 2.6 3.2 1.9 3.6 1.8 4.6 1.8 5.2c0 .6.3 5.2.6 6 .8 2.4 3.4 3.2 5.7 3-3.4.5-6.4 1.7-2.5 6.1 4.3 4.4 5.9-1 6.4-3.8.5 2.8 1.5 8 6.3 3.8 3.7-3.8 1-5.6-2.4-6.1 2.4.2 4.9-.6 5.7-3 .3-.8.6-5.4.6-6 0-.6-.1-1.6-.8-2-.6-.3-1.5-.6-3.7 1-2.3 1.7-4.8 5-5.7 6.8Z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M19.3 5.4A16.6 16.6 0 0 0 15.2 4l-.3.6c1.4.3 2.6.9 3.7 1.6a13.4 13.4 0 0 0-11.3 0c1.1-.7 2.4-1.3 3.7-1.6L10.8 4c-1.5.2-3 .7-4.1 1.4C4.6 8.7 4 11.9 4.3 15c1.5 1.1 3 1.8 4.4 2.3l.9-1.5c-.5-.2-1-.5-1.5-.8l.4-.3a9.6 9.6 0 0 0 8 0l.4.3c-.5.3-1 .6-1.5.8l.9 1.5c1.4-.5 2.9-1.2 4.4-2.3.4-3.6-.6-6.8-2.4-9.6ZM9.5 13.3c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm5 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z"/></svg>',
    site: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>'
  };
  // Icônes monochromes du dossier /assets/iconwebsite : colorées par masque CSS, donc elles suivent le thème.
  SOCIAL_ICONS.youtube = '/assets/iconwebsite/youtube.svg';
  SOCIAL_ICONS.gamebanana = '/assets/iconwebsite/gamebanana.svg';
  SOCIAL_ICONS.linktree = '/assets/iconwebsite/linktree.svg';
  const SOCIAL_LABELS = { github: 'GitHub', twitter: 'X', bluesky: 'Bluesky', discord: 'Discord', youtube: 'YouTube', gamebanana: 'GameBanana', linktree: 'Linktree', site: 'Site' };
  function renderTeam() {
    const initials = (name) => name.trim().slice(0, 1).toUpperCase();
    // Une icône est soit un SVG en ligne, soit un fichier du dossier iconwebsite affiché via masque CSS.
    const socialIcon = (key) => { const icon = SOCIAL_ICONS[key]; return icon.startsWith('/') ? `<span class="icon-mask" style="--icon:url('${esc(icon)}')"></span>` : icon; };
    const memberLinks = (links = {}) => {
      const entries = Object.entries(links).filter(([key, value]) => value && SOCIAL_ICONS[key]);
      if (!entries.length) return ``;
      return `<div class="member-links">${entries.map(([key, value]) => `<a href="${esc(value)}" rel="noopener noreferrer" title="${esc(SOCIAL_LABELS[key] || key)}" aria-label="${esc(SOCIAL_LABELS[key] || key)} de ce membre">${socialIcon(key)}</a>`).join('')}</div>`;
    };
    const cards = TEAM.map((member) => `<article class="member">
      <div class="member-top">
        ${member.avatar ? `<img class="member-avatar" src="${esc(member.avatar)}" alt="" loading="lazy" width="200" height="200">` : `<div class="avatar member-avatar">${esc(initials(member.name))}</div>`}
        <div class="member-id">
          <h3>${esc(member.name)}</h3>
          ${member.roles && member.roles.length ? `<div class="role-tags">${member.roles.map((role) => `<span class="role-tag">${esc(role)}</span>`).join('')}</div>` : ``}
        </div>
        ${memberLinks(member.links)}
      </div>
      ${member.projects && member.projects.length ? `<div class="member-projects"><strong>Projets</strong><ul>${member.projects.map((project) => `<li>${esc(project)}</li>`).join('')}</ul></div>` : ``}
    </article>`).join('');
    $('#main').innerHTML = `${pageHead('L’équipe', 'Les personnes derrière les traductions de Saint Eresia.')}<section class="section"><div class="container">
      <div class="panel" style="margin-bottom:22px"><p style="margin:0">Saint Eresia est une équipe de fantraduction bénévole. Chaque projet réunit des personnes qui traduisent, relisent, retouchent les images ou s’occupent de la partie technique. Les traductions signées par d’autres équipes sont créditées sur la fiche du projet concerné.</p></div>
      ${TEAM.length ? `<div class="team-grid">${cards}</div>` : `<div class="empty">La composition de l’équipe sera publiée prochainement.</div>`}
    </div></section>`;
  }
      if(page==='home')await renderHome(); else if(page==='equipe')renderTeam(); else if(page==='novels'||page==='patchs')await renderCatalog(page); else if(page==='novel')await renderNovel(); else if(page==='patch')await renderPatch(); else if(['favorites','reading-list','history'].includes(page))await renderLibrary(page); else if(['login','register','forgot'].includes(page))renderAuth(page); else if(page==='profile')await renderProfile(); else if(page==='admin')await renderAdmin();
    } catch(error) { $('#main').innerHTML=`<section class="section"><div class="container empty"><h1>Contenu indisponible</h1><p>${esc(error.message)}</p><a class="btn" href="/index.html">Retour à l’accueil</a></div></section>`; }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
