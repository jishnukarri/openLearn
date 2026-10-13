-- Admin blocklist: emails (exact address or whole domain) and name words/phrases
-- that may not be used at signup or when changing a name. Only the
-- service-role key (the app server) can touch it.
create table if not exists public.blocklist_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'name')),
  pattern text not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (kind, pattern)
);

alter table public.blocklist_entries enable row level security;
