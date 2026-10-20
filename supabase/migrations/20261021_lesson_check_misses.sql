-- Lesson check questions a student got wrong on the first try. Used to bring
-- those ideas back in later "Do it now" practice and the lesson coach history.
-- Only the service-role key (the app server) touches it; RLS stays on with no
-- policies, like the other server-only tables.
create table if not exists public.lesson_check_misses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null,
  subtopic_id uuid,
  prompt text not null,
  correct_answer text not null default '',
  missed_count int not null default 1,
  last_missed_at timestamptz not null default now(),
  resolved boolean not null default false,
  unique (student_id, topic_id, prompt)
);

create index if not exists lesson_check_misses_student_open_idx
  on public.lesson_check_misses (student_id, resolved, last_missed_at desc);

alter table public.lesson_check_misses enable row level security;
