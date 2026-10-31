/* Studio: sign in, edit artwork and settings. Talks to Supabase with plain fetch. */
(() => {
  'use strict';
  const C = window.SITE_CONFIG || {};
  const BASE = (C.supabaseUrl || '').replace(/\/$/, '');
  const KEY = C.supabaseAnonKey || '';
  const app = document.getElementById('app');
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parse = (t) => { try { return JSON.parse(t); } catch (e) { return null; } };
  const DEF = { siteName: 'Burnt Offerings Art', tagline: 'Artist · Maker', heroTitle: 'Burnt Offerings Art', heroDescription: '', aboutTitle: 'A practice made of curiosity.', aboutText: '', contactText: '', contactEmail: '', imageDisplaySeconds: 3, textSizePercent: 100, backgroundColor: '#efe9d7', headerBackgroundColor: '#291f30', textColor: '#291f30', headerTextColor: '#efe9d7', mediums: ['Mixed Media', 'Acrylic Painting', 'Woodburning', 'Pastels', 'Illustration'] };
  let session = parse(localStorage.getItem('bha_session'));
  const S = { tab: 'art', settings: { ...DEF }, art: [], form: null, note: null };

  /* ----- Supabase calls ----- */
  const keep = (d) => { session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in - 30) * 1000 }; localStorage.setItem('bha_session', JSON.stringify(session)); };
  const auth = async (grant, body) => {
    const r = await fetch(`${BASE}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = parse(await r.text()) || {};
    if (!r.ok) throw new Error(d.error_description || d.msg || 'Sign-in failed.');
    keep(d);
  };
  const token = async () => {
    if (!session) throw new Error('Please sign in again.');
    if (Date.now() > session.expires_at) await auth('refresh_token', { refresh_token: session.refresh_token });
    return session.access_token;
  };
  const api = async (path, { method = 'GET', json, body, headers = {} } = {}) => {
    const h = { apikey: KEY, Authorization: `Bearer ${await token()}`, ...headers };
    if (json !== undefined) { h['Content-Type'] = 'application/json'; h.Prefer = h.Prefer || 'return=representation'; }
    const r = await fetch(BASE + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body });
    const d = parse(await r.text());
    if (!r.ok) throw new Error((d && (d.message || d.error)) || `Request failed (${r.status}).`);
    return d;
  };
  const load = async () => {
    const [s, a] = await Promise.all([api('/rest/v1/site_settings?select=settings&id=eq.1'), api('/rest/v1/artworks?select=*&order=position.asc,id.asc')]);
    S.settings = { ...DEF, ...((s[0] && s[0].settings) || {}) };
    S.art = a;
  };
  const shrink = async (file) => {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Could not read that photo. Try a JPG or PNG.'))), 'image/jpeg', 0.85));
  };
  const upload = async (file, title) => {
    const blob = await shrink(file);
    const slug = String(title || 'art').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'art';
    const name = `${Date.now()}-${slug}.jpg`;
    await api(`/storage/v1/object/artwork/${name}`, { method: 'POST', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
    return `${BASE}/storage/v1/object/public/artwork/${name}`;
  };
  const imgSrc = (p) => (String(p).startsWith('/') ? `..${p}` : p);

  /* ----- views ----- */
  const flash = (text, err) => {
    S.note = text ? { text, err } : null;
    const n = $('#flash'); if (!n) return;
    n.hidden = !text; n.textContent = text || ''; n.className = 'note' + (err ? ' err' : '');
  };
  const field = (l, n, v, x = '') => `<label>${l}<input name="${n}" value="${esc(v)}" ${x}></label>`;
  const area = (l, n, v, r = 3) => `<label>${l}<textarea name="${n}" rows="${r}">${esc(v)}</textarea></label>`;
  const color = (l, n, v) => `<div class="crow"><label>${l}<br><input type="color" name="${n}" value="${esc(v)}"></label><button type="button" data-act="reset" data-field="${n}">Reset</button></div>`;

  const loginView = () => `<h1>Studio</h1><p>Sign in to edit the site.</p><form id="login" class="card">
    <label>Email<input name="email" type="email" autocomplete="username" required></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="primary">Sign in</button></form>`;
  const artList = () => `<p><button class="primary" data-act="new">+ Add artwork</button></p>` + (S.art.length ? S.art.map((a, i) => `
    <div class="row"><img src="${esc(imgSrc(a.image))}" alt=""><div class="grow"><b>${esc(a.title)}</b><br><small>${esc((a.mediums || []).join(' · '))}${a.placeholder ? ' · placeholder' : ''}</small></div>
    <div class="acts"><button data-act="up" data-id="${a.id}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button data-act="down" data-id="${a.id}" aria-label="Move down" ${i === S.art.length - 1 ? 'disabled' : ''}>↓</button>
    <button data-act="edit" data-id="${a.id}">Edit</button><button class="danger" data-act="del" data-id="${a.id}">Delete</button></div></div>`).join('') : '<p>No artwork yet.</p>');
  const artForm = () => {
    const f = S.form; const all = [...new Set([...S.settings.mediums, ...(f.mediums || [])])];
    return `<form id="artform" class="card"><h2>${f.id ? 'Edit' : 'Add'} artwork</h2>
    ${field('Title', 'title', f.title, 'required maxlength="200"')}
    <fieldset><legend>Medium(s)</legend>${all.map((m) => `<label class="chk"><input type="checkbox" name="m" value="${esc(m)}" ${(f.mediums || []).includes(m) ? 'checked' : ''}> ${esc(m)}</label>`).join('')}</fieldset>
    <label>Photo${f.image ? `<img class="thumb" src="${esc(imgSrc(f.image))}" alt="">` : ''}<input name="file" type="file" accept="image/*" ${f.image ? '' : 'required'}></label>
    ${field('Materials line (shown under the title)', 'material', f.material, 'maxlength="500"')}
    ${area('Field note', 'description', f.description, 4)}
    <label class="chk"><input type="checkbox" name="placeholder" ${f.placeholder ? 'checked' : ''}> This is a placeholder image, not real artwork</label>
    <p><button class="primary">Save</button> <button type="button" data-act="cancel">Cancel</button></p></form>`;
  };
  const setForm = () => { const s = S.settings; return `<form id="setform" class="card wide">
    <div id="prev" class="prev"><div>Header band</div><p>Body text on the page background</p></div>
    ${color('Page background', 'backgroundColor', s.backgroundColor)}${color('Header band', 'headerBackgroundColor', s.headerBackgroundColor)}
    ${color('Text color', 'textColor', s.textColor)}${color('Header text color', 'headerTextColor', s.headerTextColor)}
    <p><button type="button" data-act="resetall">Reset all colors to defaults</button></p>
    <label>Text size: <output id="sz">${esc(s.textSizePercent)}</output>%<input type="range" name="textSizePercent" min="80" max="150" value="${esc(s.textSizePercent)}"></label>
    ${field('Seconds each image shows', 'imageDisplaySeconds', s.imageDisplaySeconds, 'type="number" min="1" max="30"')}
    ${field('Site name', 'siteName', s.siteName)}${field('Tagline', 'tagline', s.tagline)}${field('Home page headline', 'heroTitle', s.heroTitle)}
    ${area('Home page intro', 'heroDescription', s.heroDescription)}${field('About page heading', 'aboutTitle', s.aboutTitle)}
    ${area('About page text (blank line between paragraphs)', 'aboutText', s.aboutText, 6)}${area('Contact page text', 'contactText', s.contactText)}
    ${field('Contact email (blank hides it)', 'contactEmail', s.contactEmail, 'type="email"')}
    ${area('Medium tabs, one per line, in order', 'mediums', s.mediums.join('\n'), 6)}
    <small>Renaming a medium here doesn’t rename it on existing artwork. Edit those pieces too.</small>
    <p><button class="primary">Save settings</button></p></form>`; };
  const view = () => {
    if (!/^https?:\/\//.test(BASE) || !KEY) return '<h1>Studio</h1><p class="note err">config.js still needs your Supabase address and public key. See SUPABASE-SETUP.md.</p>';
    if (!session) return `<p id="flash" class="note" hidden></p>${loginView()}`;
    return `<div class="bar"><h1>Studio</h1><span><a class="btn" href="../">View site</a> <button data-act="out">Sign out</button></span></div>
      <p id="flash" class="note" hidden></p>
      <div class="tabs"><button data-act="tab" data-tab="art" class="${S.tab === 'art' ? 'on' : ''}">Artwork</button><button data-act="tab" data-tab="set" class="${S.tab === 'set' ? 'on' : ''}">Site settings</button></div>
      ${S.tab === 'art' ? (S.form ? artForm() : artList()) : setForm()}`;
  };
  const render = () => { app.innerHTML = view(); if (S.note) flash(S.note.text, S.note.err); };
  const guard = async (fn) => { try { await fn(); } catch (e) { flash(e.message, true); } };

  /* ----- actions ----- */
  const move = (id, d) => guard(async () => {
    const i = S.art.findIndex((a) => a.id == id), j = i + d; if (j < 0 || j >= S.art.length) return;
    const arr = [...S.art]; [arr[i], arr[j]] = [arr[j], arr[i]];
    await Promise.all(arr.map((a, k) => (a.position === k + 1 ? null : api(`/rest/v1/artworks?id=eq.${a.id}`, { method: 'PATCH', json: { position: k + 1 } }))));
    await load(); S.note = null; render();
  });
  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const { act, id, tab } = b.dataset;
    if (act === 'reset' || act === 'resetall') {
      const f = $('#setform'); if (!f) return;
      (act === 'reset' ? [b.dataset.field] : ['backgroundColor', 'headerBackgroundColor', 'textColor', 'headerTextColor']).forEach((n) => { f.elements[n].value = DEF[n]; f.elements[n].dispatchEvent(new Event('input', { bubbles: true })); });
      flash('Colors reset. Click “Save settings” to keep the change.'); return;
    }
    if (act === 'out') { localStorage.removeItem('bha_session'); session = null; S.note = null; render(); }
    else if (act === 'tab') { S.tab = tab; S.form = null; S.note = null; render(); }
    else if (act === 'new') { S.form = { mediums: [S.settings.mediums[0]] }; S.note = null; render(); }
    else if (act === 'edit') { S.form = { ...S.art.find((a) => a.id == id) }; S.note = null; render(); }
    else if (act === 'cancel') { S.form = null; S.note = null; render(); }
    else if (act === 'up') move(id, -1);
    else if (act === 'down') move(id, 1);
    else if (act === 'del') {
      const a = S.art.find((x) => x.id == id);
      if (confirm(`Delete “${a.title}”? This can’t be undone.`)) guard(async () => { await api(`/rest/v1/artworks?id=eq.${id}`, { method: 'DELETE' }); await load(); flash('Deleted.'); render(); });
    }
  });
  app.addEventListener('input', (e) => {
    const f = e.target.form; if (!f || f.id !== 'setform') return;
    const v = (n) => f.elements[n].value, p = $('#prev'); $('#sz').textContent = v('textSizePercent');
    p.style.background = v('backgroundColor'); p.firstElementChild.style.cssText = `background:${v('headerBackgroundColor')};color:${v('headerTextColor')}`; p.lastElementChild.style.color = v('textColor');
  });
  app.addEventListener('submit', (e) => {
    e.preventDefault(); const f = new FormData(e.target); const id = e.target.id;
    if (id === 'login') guard(async () => { flash('Signing in…'); await auth('password', { email: f.get('email'), password: f.get('password') }); await load(); S.note = null; render(); });
    else if (id === 'artform') guard(async () => {
      const cur = S.form, mediums = f.getAll('m'); if (!mediums.length) throw new Error('Choose at least one medium.');
      flash('Saving…'); let image = cur.image; const file = f.get('file');
      if (file && file.size) image = await upload(file, f.get('title'));
      const row = { title: f.get('title').trim(), mediums, image, material: f.get('material') || '', description: f.get('description') || '', placeholder: !!f.get('placeholder') };
      if (cur.id) await api(`/rest/v1/artworks?id=eq.${cur.id}`, { method: 'PATCH', json: row });
      else await api('/rest/v1/artworks', { method: 'POST', json: { ...row, position: S.art.reduce((m, a) => Math.max(m, a.position), 0) + 1 } });
      S.form = null; await load(); flash('Saved. The live site shows it now.'); render();
    });
    else if (id === 'setform') guard(async () => {
      flash('Saving…');
      const d = { ...S.settings }; ['siteName', 'tagline', 'heroTitle', 'heroDescription', 'aboutTitle', 'aboutText', 'contactText', 'contactEmail', 'backgroundColor', 'headerBackgroundColor', 'textColor', 'headerTextColor'].forEach((k) => { d[k] = String(f.get(k) || '').trim(); });
      d.textSizePercent = Number(f.get('textSizePercent')) || 100; d.imageDisplaySeconds = Math.min(30, Math.max(1, Number(f.get('imageDisplaySeconds')) || 3));
      d.mediums = String(f.get('mediums')).split('\n').map((x) => x.trim()).filter(Boolean);
      await api('/rest/v1/site_settings', { method: 'POST', json: { id: 1, settings: d }, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
      S.settings = d; flash('Settings saved.'); render();
    });
  });

  render();
  if (session && BASE) guard(async () => { await load(); render(); }).then(() => { if (S.note && S.note.err) { session = null; localStorage.removeItem('bha_session'); render(); } });
})();
