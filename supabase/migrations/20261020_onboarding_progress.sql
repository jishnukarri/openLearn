-- Per-user checklist of introductory walkthroughs ("pieces"). Existing users
-- see the same invitations as new ones. Only the service-role key (the app
-- server) can touch it.
create table if not exists public.onboarding_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  piece text not null,
  completed_at timestamptz not null default now(),
  primary key (profile_id, piece)
);

alter table public.onboarding_progress enable row level security;
-- No policies: anon/authenticated are denied; service role bypasses RLS.
