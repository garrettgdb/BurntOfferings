// Saves a copy of the Supabase content into content/*.json and images/synced/
// so the site still works if Supabase is ever unavailable. Also counts as daily database activity.
import { writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_ANON_KEY || '';
if (!url || !key) { console.log('SUPABASE_URL / SUPABASE_ANON_KEY not set; skipping.'); process.exit(0); }
const headers = { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) };
const get = async (p) => { const r = await fetch(url + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const [settingsRows, artworks] = await Promise.all([
  get('/rest/v1/site_settings?select=settings&id=eq.1'),
  get('/rest/v1/artworks?select=*&order=position.asc'),
]);
if (!settingsRows.length) throw new Error('No settings row found in Supabase.');
mkdirSync('images/synced', { recursive: true });
const keep = new Set();
const out = [];
for (const a of artworks) {
  let image = a.image;
  if (/^https?:\/\//.test(image)) {
    const name = image.split('/').pop().split('?')[0];
    const file = `images/synced/${name}`;
    keep.add(name);
    if (!existsSync(file)) {
      const r = await fetch(image);
      if (!r.ok) throw new Error(`Image ${image}: ${r.status}`);
      writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    image = file;
  }
  out.push({ title: a.title, mediums: a.mediums || [], image, material: a.material || '', description: a.description || '', placeholder: !!a.placeholder });
}
for (const f of readdirSync('images/synced')) if (!keep.has(f)) rmSync(`images/synced/${f}`);
writeFileSync('content/settings.json', JSON.stringify(settingsRows[0].settings, null, 2) + '\n');
writeFileSync('content/artworks.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Synced ${out.length} artworks.`);
