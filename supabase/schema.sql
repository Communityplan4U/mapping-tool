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
-- one of the predefined sites), tagged with a topic — see
-- mapCommentTopics in js/config.js for the topic list. Comments are
-- threaded by "address" (reverse-geocoded client-side when a marker is
-- placed): multiple residents can each add their own comment at the same
-- address, similar to how multiple submissions can share one site_id.
-- address is nullable — older rows predating this column, or a submission
-- where reverse geocoding failed, fall back to grouping by lat/lng.
create table if not exists map_comments (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  address text,
  topic text not null,
  comment text not null,
  voter_token text not null,
  created_at timestamptz not null default now()
);
alter table map_comments add column if not exists address text;

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
-- visitor, not just their own.
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
