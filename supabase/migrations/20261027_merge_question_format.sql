-- Atomic jsonb merge into questions.format, so concurrent writers (hints and
-- remediation on different instances) can't clobber each other's keys.
-- A null format is treated like the app does: { "type": "extended" }.
create or replace function public.merge_question_format(p_id uuid, p_patch jsonb)
returns jsonb
language sql
security definer
set search_path = public
as $$
  update public.questions
     set format = coalesce(format, '{"type":"extended"}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
   where id = p_id
   returning format;
$$;

revoke all on function public.merge_question_format(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_question_format(uuid, jsonb) to service_role;
