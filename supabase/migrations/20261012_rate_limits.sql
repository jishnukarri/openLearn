-- Shared rate limiting so limits survive restarts and apply across
-- instances. Only the service-role key (the app server) can touch these.
create table if not exists public.rate_limit_hits (
  bucket_key text not null,
  hit_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_time
  on public.rate_limit_hits (bucket_key, hit_at desc);

alter table public.rate_limit_hits enable row level security;

-- Returns true and records a hit when the key is under its limit for the
-- window, false otherwise. The advisory lock makes check-then-insert atomic
-- per key.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));

  delete from rate_limit_hits
   where bucket_key = p_key
     and hit_at < now() - make_interval(secs => p_window_ms / 1000.0);

  select count(*) into cnt from rate_limit_hits where bucket_key = p_key;
  if cnt >= p_limit then
    return false;
  end if;

  insert into rate_limit_hits (bucket_key) values (p_key);
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
