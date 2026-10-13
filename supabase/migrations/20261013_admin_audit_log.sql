-- Audit trail for admin support actions (password reset, sign-out, block,
-- verify). Only the service-role key (the app server) can touch it.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  target_id uuid,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_target_time
  on public.admin_audit_log (target_id, created_at desc);

alter table public.admin_audit_log enable row level security;
