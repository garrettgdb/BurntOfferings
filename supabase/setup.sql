-- Run this ONCE in Supabase: SQL Editor > New query > paste > Run.

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}'
);
create table public.artworks (
  id bigint generated always as identity primary key,
  title text not null,
  mediums text[] not null default '{}',
  image text not null,
  material text not null default '',
  description text not null default '',
  placeholder boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Anyone can read. Only a signed-in user (you) can change things.
alter table public.site_settings enable row level security;
alter table public.artworks enable row level security;
create policy "public read settings" on public.site_settings for select using (true);
create policy "editor writes settings" on public.site_settings for all to authenticated using (true) with check (true);
create policy "public read artworks" on public.artworks for select using (true);
create policy "editor writes artworks" on public.artworks for all to authenticated using (true) with check (true);

-- Photo storage
insert into storage.buckets (id, name, public) values ('artwork', 'artwork', true);
create policy "public read photos" on storage.objects for select using (bucket_id = 'artwork');
create policy "editor adds photos" on storage.objects for insert to authenticated with check (bucket_id = 'artwork');
create policy "editor changes photos" on storage.objects for update to authenticated using (bucket_id = 'artwork');
create policy "editor removes photos" on storage.objects for delete to authenticated using (bucket_id = 'artwork');

-- Starting content (same as the sample site)
insert into public.site_settings (id, settings) values (1, '{"siteName": "Burnt Offerings Art", "tagline": "Artist · Maker", "heroTitle": "Burnt Offerings Art", "heroDescription": "Art by Brittany Hunter, across woodburning, acrylic painting, pastels, mixed media, illustration, and more.", "aboutTitle": "A practice made of curiosity.", "aboutText": "Explore Brittany Hunter’s work across five disciplines. This space brings together artwork, materials and notes on the creative process. A personal artist biography will be added here.", "contactEmail": "", "contactText": "Custom orders, commissions, prints, and other questions.", "imageDisplaySeconds": 3, "textSizePercent": 100, "backgroundColor": "#efe9d7", "headerBackgroundColor": "#291f30", "textColor": "#291f30", "headerTextColor": "#efe9d7", "mediums": ["Mixed Media", "Acrylic Painting", "Woodburning", "Pastels", "Illustration"]}'::jsonb);
insert into public.artworks (title, mediums, image, material, description, placeholder, position) values
  ('Understory', array['Mixed Media'], '/images/sample-understory.jpg', 'Mixed media study', 'A sample study of layered color and botanical forms. Generated placeholder artwork.', true, 1),
  ('Poppy at Noon', array['Acrylic Painting'], '/images/sample-poppy.jpg', 'Acrylic study', 'A bright floral study in red and gold. Generated placeholder artwork.', true, 2),
  ('Fern & Fable', array['Woodburning'], '/images/sample-fern.jpg', 'Woodburning study', 'Botanical lines on a warm wood surface. Generated placeholder artwork.', true, 3),
  ('A Little Wild', array['Pastels'], '/images/sample-wild.jpg', 'Pastel study', 'A meadow study with soft color and texture. Generated placeholder artwork.', true, 4),
  ('Mushroom Season', array['Illustration'], '/images/sample-mushroom.jpg', 'Illustration study', 'A woodland-inspired drawing study. Generated placeholder artwork.', true, 5);
