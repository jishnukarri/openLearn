-- The part of the exam specification a lesson was written against. Exam
-- questions and flashcards made for the same topic read it back, so everything
-- is grounded in the same wording.
alter table public.lessons
  add column if not exists spec_excerpt text;
