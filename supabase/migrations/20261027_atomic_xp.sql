-- Atomic XP award: one UPDATE so concurrent awards can't lose increments.
-- Streak/last_active_date use the UTC date, matching the app's old logic.
create or replace function public.award_xp(p_profile uuid, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_xp int;
begin
  update public.profiles
     set xp = xp + greatest(coalesce(p_amount, 0), 0),
         streak_count = case
           when last_active_date = v_today then streak_count
           when last_active_date = v_today - 1 then streak_count + 1
           else 1
         end,
         last_active_date = v_today
   where id = p_profile
   returning xp into v_xp;
  return v_xp;
end;
$$;

revoke all on function public.award_xp(uuid, int) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, int) to service_role;
