-- Community Land Use Mapping Tool — Supabase schema
--
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run).

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

create index if not exists submissions_site_id_idx on submissions (site_id);
create index if not exists upvotes_submission_id_idx on upvotes (submission_id);

alter table submissions enable row level security;
alter table upvotes enable row level security;

-- Anyone using the public anon key can read all submissions and upvotes —
-- results need to be visible to every visitor, not just their own.
create policy "Public read submissions" on submissions
  for select using (true);

create policy "Public read upvotes" on upvotes
  for select using (true);

-- Anyone can add a submission or an upvote. There are no update policies,
-- so submissions cannot be edited once posted — moderation (removing spam
-- or off-topic entries) is done from the Supabase dashboard with the
-- service role key, not from the app itself.
create policy "Public insert submissions" on submissions
  for insert with check (true);

create policy "Public insert upvotes" on upvotes
  for insert with check (true);

-- Upvotes can be removed, so someone can un-support an idea. Because this
-- app has no login system, this is NOT scoped to "your own" upvote at the
-- database level — any anon visitor could technically delete any upvote
-- row. That's an acceptable tradeoff for a low-stakes community tool; see
-- README.md for how to harden this with Supabase Auth if you need it.
create policy "Public delete upvotes" on upvotes
  for delete using (true);
