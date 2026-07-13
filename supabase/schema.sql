-- Community Land Use Mapping Tool — Supabase schema
--
-- Run this in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run). Safe to re-run any
-- time the project adds a new table/policy — everything below is
-- idempotent (tables use "if not exists"; policies are dropped and
-- recreated so re-running never errors on "policy already exists").
--
-- The per-site ranking feature was removed; its `submissions` and
-- `upvotes` tables are no longer created or used. If your project still
-- has them from an earlier version they're harmless orphans — drop them
-- manually if you like: `drop table if exists upvotes, submissions;`

create extension if not exists "pgcrypto";

-- Free-form feedback left by clicking anywhere on the map, tagged with a
-- theme — see themes in js/config.js (the "topic" column name predates
-- that rename; kept as-is to avoid an unnecessary column rename). Comments
-- are threaded by "address" (reverse-geocoded client-side when a marker is
-- placed): multiple residents can each add their own comment at the same
-- address. address is nullable — older rows, or a comment where reverse
-- geocoding failed, fall back to grouping by lat/lng.
-- sentiment is what *kind* of feedback this is (losing/concern/working/
-- idea — see feedbackTypes in js/config.js), separate from its topic.
-- Required in the app, but nullable here so rows predating the column stay
-- valid (Postgres won't add a NOT NULL column to a table with existing
-- rows without a default).
-- name and contact are both optional. name is shown publicly alongside the
-- comment. contact is NOT shown anywhere in the public app — only in
-- admin.html's reporting table and CSV export, for a neighbourhood
-- organizer to follow up. It's still readable by anyone with the anon key
-- querying the table directly (reads are public below), so it's "not shown
-- in the UI," not access-controlled at the database level.
-- year_last_there is optional and only meaningful for the "losing"
-- feedback type (askYear in feedbackTypes) — the year the place was last
-- there. Shown publicly next to the sentiment label.
-- photo_url is an optional photo of the place. For pasted links it's an
-- external URL; for uploads it's the public URL of a file in the
-- feedback-photos Storage bucket (see below). Only http(s) URLs are
-- rendered (isHttpUrl in js/app.js).
create table if not exists map_comments (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  address text,
  topic text not null,
  sentiment text not null,
  year_last_there integer,
  comment text not null,
  name text,
  contact text,
  photo_url text,
  voter_token text not null,
  created_at timestamptz not null default now()
);
alter table map_comments add column if not exists address text;
alter table map_comments add column if not exists sentiment text;
alter table map_comments add column if not exists name text;
alter table map_comments add column if not exists contact text;
alter table map_comments add column if not exists year_last_there integer;
alter table map_comments add column if not exists photo_url text;

-- Up/down votes on individual map_comments rows. One row per (comment,
-- voter) — direction is 1 (up) or -1 (down); changing your vote deletes the
-- old row and inserts a new one rather than updating in place.
create table if not exists map_comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references map_comments(id) on delete cascade,
  voter_token text not null,
  direction smallint not null check (direction in (1, -1)),
  created_at timestamptz not null default now(),
  unique (comment_id, voter_token)
);

create index if not exists map_comments_topic_idx on map_comments (topic);
create index if not exists map_comments_address_idx on map_comments (address);
create index if not exists map_comment_votes_comment_id_idx
  on map_comment_votes (comment_id);

alter table map_comments enable row level security;
alter table map_comment_votes enable row level security;

-- RLS policies (below) control *which rows* anon/authenticated can see or
-- change; these grants control whether they can touch the table *at all*.
-- Supabase projects normally set this up automatically for new tables, but
-- re-stating it explicitly means this schema doesn't depend on that — if
-- you ever hit "permission denied for table X", re-running just this block
-- fixes it. Safe to re-run; re-granting is a no-op in Postgres.
grant usage on schema public to anon, authenticated;
grant select, insert on map_comments to anon, authenticated;
grant select, insert, delete on map_comment_votes to anon, authenticated;

-- Anyone using the public anon key can read all map comments and their
-- votes — results need to be visible to every visitor. This includes
-- map_comments.contact: the app's UI never displays it outside admin.html,
-- but that's a front-end convention, not real access control — this app
-- has no login system, so admin.html reads with the exact same public anon
-- key as the main map. Anyone who queries this table directly with that key
-- (which is not secret — it's embedded in js/config.js) can read contact
-- info too. If that's not acceptable for real contact details, this needs
-- real access control (e.g. Supabase Auth gating admin.html) before launch,
-- not just hiding it in the UI.
drop policy if exists "Public read map_comments" on map_comments;
create policy "Public read map_comments" on map_comments
  for select using (true);

drop policy if exists "Public read map_comment_votes" on map_comment_votes;
create policy "Public read map_comment_votes" on map_comment_votes
  for select using (true);

-- Anyone can add a map comment or a comment vote. There's no update policy
-- on map_comments, so comment text can't be edited once posted —
-- moderation (removing spam or off-topic entries) is done from the Supabase
-- dashboard with the service role key, not from the app itself.
drop policy if exists "Public insert map_comments" on map_comments;
create policy "Public insert map_comments" on map_comments
  for insert with check (true);

drop policy if exists "Public insert map_comment_votes" on map_comment_votes;
create policy "Public insert map_comment_votes" on map_comment_votes
  for insert with check (true);

-- Comment votes can be removed, so someone can change or retract their
-- vote. Because this app has no login system, this is NOT scoped to "your
-- own" vote at the database level — any anon visitor could technically
-- delete any vote row. That's an acceptable tradeoff for a low-stakes
-- community tool; see README.md for how to harden this with Supabase Auth.
drop policy if exists "Public delete map_comment_votes" on map_comment_votes;
create policy "Public delete map_comment_votes" on map_comment_votes
  for delete using (true);

-- Areas residents draw and label themselves (the "User Identified" map
-- layer) — a property, a site, a spot they want to point out. geojson
-- holds the polygon geometry (a GeoJSON Polygon); label is what they say
-- it is, description is optional detail. Public read + insert, same open
-- trust model as map_comments (no anon delete — remove a bad one from the
-- Supabase dashboard).
create table if not exists map_areas (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  description text,
  geojson jsonb not null,
  voter_token text not null,
  created_at timestamptz not null default now()
);
alter table map_areas enable row level security;
grant select, insert on map_areas to anon, authenticated;

drop policy if exists "Public read map_areas" on map_areas;
create policy "Public read map_areas" on map_areas
  for select using (true);

drop policy if exists "Public insert map_areas" on map_areas;
create policy "Public insert map_areas" on map_areas
  for insert with check (true);

-- Photo uploads for map feedback go to a PUBLIC Storage bucket, so an
-- uploaded photo can be shown to everyone. anon (no-login) visitors can
-- upload — the same open trust model as the rest of this tool.
-- map_comments.photo_url then holds the uploaded file's public URL.
-- (Deletes are intentionally NOT granted to anon, so a visitor can't wipe
-- others' photos; remove a bad upload from the Storage dashboard.)
insert into storage.buckets (id, name, public)
  values ('feedback-photos', 'feedback-photos', true)
  on conflict (id) do nothing;

drop policy if exists "Public read feedback photos" on storage.objects;
create policy "Public read feedback photos" on storage.objects
  for select using (bucket_id = 'feedback-photos');

drop policy if exists "Public upload feedback photos" on storage.objects;
create policy "Public upload feedback photos" on storage.objects
  for insert with check (bucket_id = 'feedback-photos');

-- One-time migration: the topic/theme id list was reworked to align with
-- the Little Jamaica Community Development Action Plan's focus areas.
-- Existing map_comments rows using the old ids are remapped so they keep
-- displaying with a real label instead of their raw (now-unrecognized) id.
-- Safe to re-run — after the first run no rows match the old ids.
update map_comments set topic = 'commercial-nonprofit' where topic = 'retail';
update map_comments set topic = 'parks-public-realm'
  where topic in ('public-realm', 'parks-green-spaces');
update map_comments set topic = 'cultural-identity'
  where topic = 'heritage-community-identity';
-- 'housing' and 'transportation' ids are unchanged, no migration needed.
