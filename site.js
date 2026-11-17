/* Burnt Offerings Art — loads content/settings.json and content/artworks.json
   and fills in the page. No build step, no dependencies. */
(() => {
  'use strict';

  const ROOT = new URL('.', document.currentScript.src);
  const $ = (sel, el = document) => el.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  const imageUrl = (path) => {
    if (!path) return '';
    if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
    return new URL(path.replace(/^\/+/, ''), ROOT).href; // works at a domain root or a sub-folder
  };
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  const clean = (v, fallback) => (typeof v === 'string' && v.trim() ? v : fallback);
  const hex = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : fallback);
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => node.append(k));
    return node;
  };
  const arrow = (dir) => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', dir === 'left' ? 'M19 12H5m7 7-7-7 7-7' : 'M5 12h14m-7-7 7 7-7 7');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.5');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
    return svg;
  };

  /* ---------- data ---------- */
  const getJson = async (file) => {
    const res = await fetch(new URL(file, ROOT), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Couldn’t load ${file} (${res.status}).`);
    return res.json();
  };


  const cfg = window.SITE_CONFIG || {};
  const fromSupabase = async () => {
    const base = String(cfg.supabaseUrl).replace(/\/+$/, '');
    const headers = { apikey: cfg.supabaseAnonKey };
    if (String(cfg.supabaseAnonKey).startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.supabaseAnonKey}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    try {
      const [s, a] = await Promise.all([
        fetch(`${base}/rest/v1/site_settings?select=settings&id=eq.1`, { headers, signal: ctl.signal }),
        fetch(`${base}/rest/v1/artworks?select=*&order=position.asc`, { headers, signal: ctl.signal }),
      ]);
      if (!s.ok || !a.ok) throw new Error('Supabase request failed');
      const [settingsRows, artworkRows] = await Promise.all([s.json(), a.json()]);
      if (!settingsRows.length) throw new Error('No settings row');
      return [settingsRows[0].settings, artworkRows];
    } finally { clearTimeout(timer); }
  };
  // Live content from Supabase when configured; otherwise (or if it's down) the saved copy in content/.
  const loadData = async () => {
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      try { return await fromSupabase(); } catch (err) { console.warn('Using saved copy of the content.', err); }
    }
    return Promise.all([getJson('content/settings.json'), getJson('content/artworks.json')]);
  };

  const DEFAULTS = {
    siteName: 'Burnt Offerings Art',
    tagline: 'Artist · Maker',
    heroTitle: 'Burnt Offerings Art',
    heroDescription: '',
    aboutTitle: 'A practice made of curiosity.',
    aboutText: '',
    contactEmail: '',
    contactText: 'Custom orders, commissions, prints, and other questions.',
    imageDisplaySeconds: 3,
    textSizePercent: 100,
    backgroundColor: '#efe9d7',
    headerBackgroundColor: '#291f30',
    textColor: '#291f30',
    headerTextColor: '#efe9d7',
    activeColor: '#873b42',
    mediums: ['Mixed Media', 'Acrylic Painting', 'Woodburning', 'Pastels', 'Illustration'],
  };

  const normalize = ([rawSettings, rawArtworks]) => {
    const s = { ...DEFAULTS, ...(rawSettings || {}) };
    s.imageDisplaySeconds = Math.min(30, Math.max(1, Number(s.imageDisplaySeconds) || 3));
    s.textSizePercent = Math.min(150, Math.max(80, Number(s.textSizePercent) || 100));
    s.mediums = (Array.isArray(s.mediums) ? s.mediums : []).map((m) => String(m).trim()).filter(Boolean);
    const artworks = (Array.isArray(rawArtworks) ? rawArtworks : [])
      .filter((a) => a && a.image)
      .map((a, i) => ({
        id: String(a.id != null ? a.id : i + 1),
        title: clean(a.title, 'Untitled'),
        mediums: (Array.isArray(a.mediums) ? a.mediums : [a.mediums]).filter(Boolean).map((m) => String(m).trim()),
        image: a.image,
        material: a.material || '',
        description: a.description || '',
        placeholder: Boolean(a.placeholder),
      }));
    // Any medium used by an artwork but missing from the tab list still gets a tab.
    const seen = new Set(s.mediums.map((m) => m.toLowerCase()));
    artworks.forEach((a) => a.mediums.forEach((m) => {
      if (!seen.has(m.toLowerCase())) { seen.add(m.toLowerCase()); s.mediums.push(m); }
    }));
    if (!s.mediums.length) s.mediums = [...DEFAULTS.mediums];
    return { settings: s, artworks };
  };

  /* ---------- theme + shared page chrome ---------- */
  const applyShell = ({ settings: s, artworks }) => {
    const root = document.documentElement.style;
    root.setProperty('--paper', hex(s.backgroundColor, DEFAULTS.backgroundColor));
    root.setProperty('--header-background', hex(s.headerBackgroundColor, DEFAULTS.headerBackgroundColor));
    root.setProperty('--ink', hex(s.textColor, DEFAULTS.textColor));
    root.setProperty('--header-text', hex(s.headerTextColor, DEFAULTS.headerTextColor));
    root.setProperty('--active', hex(s.activeColor, DEFAULTS.activeColor));
    root.setProperty('--text-scale', String(s.textSizePercent / 100));

    const name = clean(s.siteName, DEFAULTS.siteName);
    const tagline = clean(s.tagline, DEFAULTS.tagline);
    document.querySelectorAll('[data-site-name]').forEach((n) => { n.textContent = name; });
    document.querySelectorAll('[data-tagline]').forEach((n) => { n.textContent = tagline.toUpperCase(); });
    document.querySelectorAll('[data-tagline-plain]').forEach((n) => { n.textContent = `${tagline}.`; });
    document.querySelectorAll('[data-count]').forEach((n) => { n.textContent = pad(artworks.length); });

    const page = document.body.dataset.page;
    const pageName = { artwork: 'Artwork', about: 'About The Artist', contact: 'Contact' }[page];
    if (pageName) document.title = `${name} — ${pageName} | Brittany Hunter`;
    const descriptions = {
      artwork: s.heroDescription,
      about: s.aboutText,
      contact: s.contactText,
    };
    const desc = (descriptions[page] || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (desc) {
      [['meta[name="description"]'], ['meta[property="og:description"]'], ['meta[name="twitter:description"]']]
        .forEach(([sel]) => { const m = $(sel); if (m) m.content = desc; });
    }
  };

  /* ---------- status blocks ---------- */
  const errorBlock = (message, retry) => el('section', { className: 'page-state is-error', role: 'alert' },
    el('span', { className: 'overline', textContent: 'The archive is momentarily quiet' }),
    el('h2', { textContent: 'Couldn’t load this page.' }),
    el('p', { textContent: message || 'Please check your connection and try again.' }),
    el('button', { className: 'action-button', type: 'button', textContent: 'Retry', onclick: retry }));

  /* ---------- Artwork page ---------- */
  const initArtwork = (data) => {
    const { settings: s, artworks } = data;
    $('#hero-title').textContent = clean(s.heroTitle, s.siteName);
    $('#hero-tagline').textContent = s.tagline;
    $('#hero-deck').textContent = s.heroDescription;

    const specimen = $('#specimen');
    const list = $('#materials');
    const state = { medium: s.mediums[0], index: 0, paused: reducedMotion, note: false };
    let timer = 0;
    let loadToken = 0;

    const group = () => artworks.filter((a) => a.mediums.some((m) => m.toLowerCase() === state.medium.toLowerCase()));
    const countFor = (m) => artworks.filter((a) => a.mediums.some((x) => x.toLowerCase() === m.toLowerCase())).length;

    const renderList = () => {
      list.replaceChildren(
        el('div', { className: 'list-caption' }, 'OPEN AN ENTRY ', el('span', { 'aria-hidden': 'true', textContent: '↘' })),
        ...s.mediums.map((m, i) => el('button', {
          className: `material${m === state.medium ? ' is-active' : ''}`,
          type: 'button',
          onclick: () => { state.medium = m; state.index = 0; state.note = false; renderAll(); },
        },
        el('span', { className: 'material-index', textContent: pad(i + 1) }),
        el('span', { className: 'material-name', textContent: m }),
        el('span', { className: 'material-count', textContent: pad(countFor(m)) }))),
      );
      [...list.querySelectorAll('.material')].forEach((b, i) => b.setAttribute('aria-pressed', String(s.mediums[i] === state.medium)));
    };

    // Cross-fade to a new image. The new image is only added to the page once it has fully
    // loaded, and every earlier image is retired at that moment, so nothing can get stuck.
    const showImage = (stage, work) => {
      const url = imageUrl(work.image);
      const shown = stage.querySelector('img.artwork-current');
      const token = ++loadToken; // any slower, older request is now cancelled
      if (shown && shown.dataset.src === url) { shown.alt = work.title; return; }
      const img = new Image();
      img.decoding = 'async';
      img.alt = work.title;
      img.dataset.src = url;
      img.onload = async () => {
        try { await img.decode(); } catch (e) { /* still usable */ }
        if (token !== loadToken || !stage.isConnected) return;
        stage.querySelectorAll('img.artwork-current, img.artwork-outgoing').forEach((old) => {
          old.classList.remove('artwork-current');
          old.classList.add('artwork-outgoing');
          old.alt = '';
          old.setAttribute('aria-hidden', 'true');
          setTimeout(() => old.remove(), 500);
        });
        img.className = 'artwork-current fade-in';
        stage.prepend(img);
      };
      img.src = url;
    };

    const preloadNext = (items, i) => {
      if (items.length > 1) new Image().src = imageUrl(items[(i + 1) % items.length].image);
    };

    const go = (delta) => {
      const items = group();
      if (!items.length) return;
      state.index = (state.index + delta + items.length) % items.length;
      state.note = false;
      renderSpecimen();
    };

    const schedule = () => {
      clearTimeout(timer);
      if (group().length < 2 || state.paused || state.note) return;
      timer = setTimeout(() => go(1), s.imageDisplaySeconds * 1000);
    };

    const renderSpecimen = () => {
      const items = group();
      if (!artworks.length) {
        specimen.replaceChildren(el('div', { className: 'empty-box' },
          el('span', { className: 'overline', textContent: 'A space left open' }),
          el('h2', { textContent: 'Nothing on display just yet.' }),
          el('p', { textContent: 'New entries will appear here when they are added to the atlas.' })));
        return;
      }
      if (!items.length) {
        specimen.replaceChildren(el('div', { className: 'empty-box' },
          el('span', { className: 'overline', textContent: state.medium }),
          el('h2', { textContent: 'Nothing under this heading yet.' }),
          el('p', { textContent: 'New entries will appear here when they are added to the atlas.' })));
        return;
      }
      state.index = Math.min(state.index, items.length - 1);
      const work = items[state.index];

      let stage = $('.art-stage', specimen);
      if (!stage) {
        specimen.replaceChildren(
          el('div', { className: 'specimen-top', id: 'specimen-top' }),
          el('div', { className: 'art-stage', id: 'stage' }, el('a', { className: 'stage-link' })),
          el('div', { className: 'specimen-caption', id: 'specimen-caption' }),
          el('p', { className: 'placeholder-note', id: 'placeholder-note', hidden: true }),
        );
        stage = $('.art-stage', specimen);
      }
      specimen.setAttribute('aria-live', state.paused || state.note ? 'polite' : 'off');
      const link = $('.stage-link', stage);
      link.href = new URL(`artwork/?id=${encodeURIComponent(work.id)}`, ROOT).href;
      link.setAttribute('aria-label', `View ${work.title} in detail`);

      // top bar
      const noteBtn = el('button', {
        className: 'note-toggle', type: 'button',
        onclick: () => { state.note = !state.note; renderSpecimen(); },
      }, state.note ? 'Close field note ' : 'Read field note ', el('b', { textContent: state.note ? '−' : '+' }));
      noteBtn.setAttribute('aria-expanded', String(state.note));
      $('#specimen-top').replaceChildren(
        el('span', {}, `ENTRY ${pad(state.index + 1)} `, el('i'), ` ${state.medium.toUpperCase()}`), noteBtn);

      // stage overlays (the images themselves are handled by showImage)
      stage.querySelectorAll('.image-index, .specimen-stamp, .image-caption, .fieldnote').forEach((n) => n.remove());
      stage.append(
        el('span', { className: 'image-index' }, pad(state.index + 1), ' ', el('b', { textContent: '/' }), ` ${pad(items.length)}`),
        el('span', { className: 'specimen-stamp' }, 'FIELD', el('br'), 'SPECIMEN'),
        el('span', { className: 'image-caption', textContent: work.placeholder ? 'GENERATED PLACEHOLDER · NOT VERIFIED ARTWORK' : 'A WORK IN THE ATLAS' }),
      );
      if (state.note) {
        stage.append(el('div', { className: 'fieldnote', id: 'field-note' },
          el('span', { textContent: `FIELD NOTE / ${state.medium.toUpperCase()}` }),
          el('p', { textContent: work.description || work.material || work.title })));
      }
      showImage(stage, work);

      // caption + controls
      const prev = el('button', { type: 'button', onclick: () => go(-1) }, arrow('left'));
      prev.setAttribute('aria-label', 'Previous artwork');
      const next = el('button', { type: 'button', onclick: () => go(1) }, arrow('right'));
      next.setAttribute('aria-label', 'Next artwork');
      const controls = el('div', { className: 'specimen-controls' }, prev);
      if (items.length > 1) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('d', state.paused ? 'm8 5 11 7-11 7Z' : 'M6 5h4v14H6zm8 0h4v14h-4z');
        svg.append(p);
        const pause = el('button', { type: 'button', title: state.paused ? 'Resume slideshow' : 'Pause slideshow', onclick: () => { state.paused = !state.paused; renderSpecimen(); } }, svg);
        pause.setAttribute('aria-label', state.paused ? 'Resume slideshow' : 'Pause slideshow');
        controls.append(pause);
      }
      controls.append(next);
      $('#specimen-caption').replaceChildren(
        el('div', {},
          el('span', { className: 'overline', textContent: work.mediums.join(' · ') }),
          el('h2', {}, work.title, el('span', { textContent: '.' })),
          el('p', { textContent: work.material })),
        controls);

      const note = $('#placeholder-note');
      note.hidden = !work.placeholder;
      note.textContent = work.placeholder ? 'This image is a generated placeholder, not a verified original artwork by Brittany Hunter.' : '';

      preloadNext(items, state.index);
      schedule();
    };

    // Swipe left/right on the artwork to move between pieces (touch screens).
    let tx = 0, ty = 0, swiped = false;
    specimen.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.art-stage')) return;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    }, { passive: true });
    specimen.addEventListener('touchend', (e) => {
      if (!e.target.closest('.art-stage') || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped = true; setTimeout(() => { swiped = false; }, 400);
        go(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
    specimen.addEventListener('click', (e) => { if (swiped && e.target.closest('.stage-link')) e.preventDefault(); });

    const renderAll = () => { renderList(); renderSpecimen(); };
    renderAll();
  };

  /* ---------- About / Contact ---------- */
  const paragraphs = (text) => text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
    .map((t) => el('p', { className: 'interior-copy', textContent: t }));

  const initAbout = ({ settings: s }) => {
    const box = $('#content');
    box.replaceChildren(
      el('span', { className: 'overline', textContent: '02 / About the artist' }),
      el('h1', { textContent: s.aboutTitle }),
      ...(s.aboutText.trim() ? paragraphs(s.aboutText) : [el('div', { className: 'empty-copy', textContent: 'Artist information has not been added yet.' })]),
      el('div', { className: 'interior-ornament' }));
  };

  const initContact = ({ settings: s }) => {
    const box = $('#content');
    const email = (s.contactEmail || '').trim();
    box.replaceChildren(
      el('span', { className: 'overline', textContent: '03 / Contact' }),
      el('h1', { textContent: 'Contact the artist' }),
      el('div', { className: 'contact-quiet' },
        el('p', { textContent: clean(s.contactText, DEFAULTS.contactText) }),
        ...(isEmail(email) ? [el('a', { className: 'contact-email', href: `mailto:${email}`, textContent: email })] : [])));
  };

  /* ---------- Artwork detail page ---------- */
  const initDetail = ({ settings: s, artworks }) => {
    const box = $('#content');
    const id = new URLSearchParams(location.search).get('id');
    const work = artworks.find((a) => a.id === id);
    const back = el('a', { className: 'detail-back', href: new URL('./', ROOT).href, textContent: '← All artwork' });
    if (!work) {
      box.replaceChildren(back, el('div', { className: 'empty-box' },
        el('h2', { textContent: 'We couldn’t find that piece.' }),
        el('p', { textContent: 'It may have been removed or renamed.' })));
      return;
    }
    document.title = `${work.title} — ${clean(s.siteName, DEFAULTS.siteName)}`;
    const full = imageUrl(work.image);
    const note = (work.description || '').trim();
    box.replaceChildren(
      back,
      el('figure', { className: 'detail-figure' },
        el('a', { href: full, target: '_blank', rel: 'noopener', title: 'Open full size' }, el('img', { src: full, alt: work.title }))),
      el('div', { className: 'detail-body' },
        el('span', { className: 'overline', textContent: work.mediums.join(' · ') }),
        el('h1', { textContent: work.title }),
        ...(work.material ? [el('p', { className: 'detail-material', textContent: work.material })] : []),
        ...(note ? [el('div', { className: 'detail-note' },
          el('span', { className: 'overline', textContent: 'Field notes' }),
          ...note.split(/\n\s*\n/).map((t) => el('p', { textContent: t.trim() })))] : []),
        ...(work.placeholder ? [el('p', { className: 'placeholder-note', textContent: 'This image is a generated placeholder, not a verified original artwork by Brittany Hunter.' })] : [])));
  };

  /* ---------- boot ---------- */
  const boot = async () => {
    const page = document.body.dataset.page;
    const target = page === 'artwork' ? $('#specimen') : $('#content');
    try {
      const data = normalize(await loadData());
      applyShell(data);
      if (page === 'artwork') initArtwork(data);
      else if (page === 'about') initAbout(data);
      else if (page === 'contact') initContact(data);
      else if (page === 'detail') initDetail(data);
    } catch (err) {
      console.error(err);
      if (target) target.replaceChildren(errorBlock(err.message, boot));
    }
  };
  boot();
})();
