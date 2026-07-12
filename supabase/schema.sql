-- Community Land Use Mapping Tool — Supabase schema
--
-- Run this in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run). Safe to re-run any
-- time the project adds a new table/policy — everything below is
-- idempotent (tables use "if not exists"; policies are dropped and
-- recreated so re-running never errors on "policy already exists").

create extension if not exists "pgcrypto";

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  nickname text,
  rankings jsonb not null,
  comment text,
  voter_token text not null,
  created_at timestamptz not null default now()
);

create table if not exists upvotes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  voter_token text not null,
  created_at timestamptz not null default now(),
  unique (submission_id, voter_token)
);

-- Free-form feedback left by clicking anywhere on the map (not tied to
-- one of the predefined sites), tagged with a theme — see themes in
-- js/config.js for the list (the "topic" column name predates that
-- rename; kept as-is to avoid an unnecessary column rename). Comments are
-- threaded by "address" (reverse-geocoded client-side when a marker is
-- placed): multiple residents can each add their own comment at the same
-- address, similar to how multiple submissions can share one site_id.
-- address is nullable — older rows predating this column, or a submission
-- where reverse geocoding failed, fall back to grouping by lat/lng.
-- sentiment is what *kind* of feedback this is (losing/concern/working/
-- idea — see feedbackTypes in js/config.js), separate from its topic.
-- Required in the app, but nullable here: existing rows predating this
-- column have no value, and Postgres won't let a NOT NULL column be added
-- to a table that already has rows without one.
-- name and contact are both optional and both provided by the person
-- leaving feedback, not required for anonymous use. name is shown
-- publicly alongside the comment (same as nickname on submissions).
-- contact is NOT shown anywhere in the public app — only in admin.html's
-- reporting table and CSV export, for a neighbourhood organizer to follow
-- up. It's still readable by anyone with the anon key querying the table
-- directly (see RLS policies below — reads are public on this table like
-- every other one here), so it's "not shown in the UI," not encrypted or
-- access-controlled at the database level.
-- year_last_there is optional and only meaningful for the "losing"
-- feedback type (see askYear in feedbackTypes, js/config.js) — the year
-- the person believes the place was last there. Shown publicly next to
-- the sentiment label, since it's part of the displacement record the
-- "losing" type exists to build.
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
  voter_token text not null,
  created_at timestamptz not null default now()
);
alter table map_comments add column if not exists address text;
alter table map_comments add column if not exists sentiment text;
alter table map_comments add column if not exists name text;
alter table map_comments add column if not exists contact text;
alter table map_comments add column if not exists year_last_there integer;

-- Up/down votes on individual map_comments rows (distinct from the
-- upvote-only "support" mechanic on site submissions). One row per
-- (comment, voter) — direction is 1 (up) or -1 (down); changing your vote
-- deletes the old row and inserts a new one rather than updating in place.
create table if not exists map_comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references map_comments(id) on delete cascade,
  voter_token text not null,
  direction smallint not null check (direction in (1, -1)),
  created_at timestamptz not null default now(),
  unique (comment_id, voter_token)
);

create index if not exists submissions_site_id_idx on submissions (site_id);
create index if not exists upvotes_submission_id_idx on upvotes (submission_id);
create index if not exists map_comments_topic_idx on map_comments (topic);
create index if not exists map_comments_address_idx on map_comments (address);
create index if not exists map_comment_votes_comment_id_idx
  on map_comment_votes (comment_id);

alter table submissions enable row level security;
alter table upvotes enable row level security;
alter table map_comments enable row level security;
alter table map_comment_votes enable row level security;

-- RLS policies (below) control *which rows* anon/authenticated can see or
-- change; these grants control whether they can touch the table *at all*.
-- Supabase projects normally get this set up automatically for new tables,
-- but re-stating it explicitly means this schema doesn't depend on that —
-- if you ever hit "permission denied for table X", re-running just this
-- block fixes it. Safe to re-run any time; re-granting an already-granted
-- privilege is a no-op in Postgres.
grant usage on schema public to anon, authenticated;
grant select, insert on submissions to anon, authenticated;
grant select, insert, delete on upvotes to anon, authenticated;
grant select, insert on map_comments to anon, authenticated;
grant select, insert, delete on map_comment_votes to anon, authenticated;

-- Anyone using the public anon key can read all submissions, upvotes, map
-- comments, and their votes — results need to be visible to every
-- visitor, not just their own. This includes map_comments.contact:
-- the app's UI never displays it outside admin.html, but that's a
-- front-end convention, not real access control — this app has no
-- login system, so admin.html reads with the exact same public anon
-- key as the main map. Anyone who queries this table directly with
-- that key (which is not secret — it's embedded in js/config.js) can
-- read contact info too. If that's not an acceptable risk for real
-- contact details, this needs real access control (e.g. Supabase Auth
-- gating admin.html) before launch, not just hiding it in the UI.
drop policy if exists "Public read submissions" on submissions;
create policy "Public read submissions" on submissions
  for select using (true);

drop policy if exists "Public read upvotes" on upvotes;
create policy "Public read upvotes" on upvotes
  for select using (true);

drop policy if exists "Public read map_comments" on map_comments;
create policy "Public read map_comments" on map_comments
  for select using (true);

drop policy if exists "Public read map_comment_votes" on map_comment_votes;
create policy "Public read map_comment_votes" on map_comment_votes
  for select using (true);

-- Anyone can add a submission, upvote, map comment, or comment vote.
-- There are no update policies on submissions/map_comments, so comment
-- text can't be edited once posted — moderation (removing spam or
-- off-topic entries) is done from the Supabase dashboard with the
-- service role key, not from the app itself.
drop policy if exists "Public insert submissions" on submissions;
create policy "Public insert submissions" on submissions
  for insert with check (true);

drop policy if exists "Public insert upvotes" on upvotes;
create policy "Public insert upvotes" on upvotes
  for insert with check (true);

drop policy if exists "Public insert map_comments" on map_comments;
create policy "Public insert map_comments" on map_comments
  for insert with check (true);

drop policy if exists "Public insert map_comment_votes" on map_comment_votes;
create policy "Public insert map_comment_votes" on map_comment_votes
  for insert with check (true);

-- Upvotes and comment votes can be removed, so someone can change or
-- retract their vote. Because this app has no login system, this is NOT
-- scoped to "your own" vote at the database level — any anon visitor
-- could technically delete any vote row. That's an acceptable tradeoff
-- for a low-stakes community tool; see README.md for how to harden this
-- with Supabase Auth if you need it.
drop policy if exists "Public delete upvotes" on upvotes;
create policy "Public delete upvotes" on upvotes
  for delete using (true);

drop policy if exists "Public delete map_comment_votes" on map_comment_votes;
create policy "Public delete map_comment_votes" on map_comment_votes
  for delete using (true);

-- One-time migration: the topic/theme id list was reworked to align with
-- the Little Jamaica Community Development Action Plan's 5 focus areas
-- (plus 3 added categories). Existing map_comments rows using the old ids
-- are remapped so they keep displaying with a real label instead of
-- falling back to showing their raw (now-unrecognized) id. Safe to re-run
-- — after the first run no rows match the old ids, so these become no-ops.
update map_comments set topic = 'commercial-nonprofit' where topic = 'retail';
update map_comments set topic = 'parks-public-realm'
  where topic in ('public-realm', 'parks-green-spaces');
update map_comments set topic = 'cultural-identity'
  where topic = 'heritage-community-identity';
-- 'housing' and 'transportation' ids are unchanged, no migration needed.
