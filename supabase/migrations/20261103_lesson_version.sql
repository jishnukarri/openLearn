-- Which version of the lesson format a stored lesson was generated with.
-- Lessons older than LESSON_VERSION (lib/lesson-version.ts) are regenerated the
-- next time someone opens them. Existing rows start at 1.
alter table public.lessons
  add column if not exists version integer not null default 1;
