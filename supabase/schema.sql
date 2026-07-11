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
-- mapCommentTopics in js/config.js for the topic list.
create table if not exists map_comments (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  topic text not null,
  comment text not null,
  voter_token text not null,
  created_at timestamptz not null default now()
);

create index if not exists submissions_site_id_idx on submissions (site_id);
create index if not exists upvotes_submission_id_idx on upvotes (submission_id);
create index if not exists map_comments_topic_idx on map_comments (topic);

alter table submissions enable row level security;
alter table upvotes enable row level security;
alter table map_comments enable row level security;

-- Anyone using the public anon key can read all submissions, upvotes, and
-- map comments — results need to be visible to every visitor, not just
-- their own.
drop policy if exists "Public read submissions" on submissions;
create policy "Public read submissions" on submissions
  for select using (true);

drop policy if exists "Public read upvotes" on upvotes;
create policy "Public read upvotes" on upvotes
  for select using (true);

drop policy if exists "Public read map_comments" on map_comments;
create policy "Public read map_comments" on map_comments
  for select using (true);

-- Anyone can add a submission, upvote, or map comment. There are no
-- update policies, so none of these can be edited once posted —
-- moderation (removing spam or off-topic entries) is done from the
-- Supabase dashboard with the service role key, not from the app itself.
drop policy if exists "Public insert submissions" on submissions;
create policy "Public insert submissions" on submissions
  for insert with check (true);

drop policy if exists "Public insert upvotes" on upvotes;
create policy "Public insert upvotes" on upvotes
  for insert with check (true);

drop policy if exists "Public insert map_comments" on map_comments;
create policy "Public insert map_comments" on map_comments
  for insert with check (true);

-- Upvotes can be removed, so someone can un-support an idea. Because this
-- app has no login system, this is NOT scoped to "your own" upvote at the
-- database level — any anon visitor could technically delete any upvote
-- row. That's an acceptable tradeoff for a low-stakes community tool; see
-- README.md for how to harden this with Supabase Auth if you need it.
drop policy if exists "Public delete upvotes" on upvotes;
create policy "Public delete upvotes" on upvotes
  for delete using (true);
