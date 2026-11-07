-- Flashcards as decks. Every card lives in one table, linked to a deck:
--   standard  one per lesson, made with the lesson, the same for every student
--   personal  a student's own regenerated deck (can be shared by link, copied)
--   remedial  an extra set for a student who is struggling with a lesson
-- A student's choice of deck for a lesson sits in student_deck_choice; with no
-- choice they use the lesson's standard deck. The old flashcard_sets table is
-- left in place (no longer written) until the new tables are verified.
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete cascade,
  kind text not null check (kind in ('standard', 'personal', 'remedial')),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text,
  source_deck_id uuid references public.flashcard_decks(id) on delete set null,
  share_token text unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'standard' and owner_id is null) or (kind <> 'standard' and owner_id is not null))
);

-- One live standard deck per lesson (topic lesson or subtopic lesson).
create unique index if not exists flashcard_decks_one_standard_idx
  on public.flashcard_decks (topic_id, coalesce(subtopic_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where kind = 'standard' and archived_at is null;
create index if not exists flashcard_decks_owner_idx on public.flashcard_decks (owner_id) where owner_id is not null;
create index if not exists flashcard_decks_lesson_idx on public.flashcard_decks (topic_id, subtopic_id, kind);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  position int not null,
  front text not null,
  back text not null,
  created_at timestamptz not null default now(),
  unique (deck_id, position)
);

create table if not exists public.student_deck_choice (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists student_deck_choice_one_idx
  on public.student_deck_choice (student_id, topic_id, coalesce(subtopic_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.lessons
  add column if not exists deck_id uuid references public.flashcard_decks(id) on delete set null;

-- Server-only tables: RLS on with no policies, like the other app tables.
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.student_deck_choice enable row level security;

-- Convert what exists. A deck reuses the id of the flashcard_sets row it comes
-- from, so this is safe to run again. Only the newest set per lesson becomes
-- the standard deck; rows pointing at a deleted topic or subtopic are skipped.
insert into public.flashcard_decks (id, topic_id, subtopic_id, kind, created_at)
select distinct on (s.topic_id, coalesce(s.subtopic_id, '00000000-0000-0000-0000-000000000000'::uuid))
  s.id, s.topic_id, s.subtopic_id, 'standard', s.created_at
from public.flashcard_sets s
join public.topics t on t.id = s.topic_id
left join public.subtopics st on st.id = s.subtopic_id
where (s.subtopic_id is null or st.id is not null)
order by s.topic_id, coalesce(s.subtopic_id, '00000000-0000-0000-0000-000000000000'::uuid), s.created_at desc
on conflict do nothing;

insert into public.flashcards (deck_id, position, front, back)
select d.id, (e.ord - 1)::int, btrim(e.card ->> 'front'), btrim(e.card ->> 'back')
from public.flashcard_decks d
join public.flashcard_sets s on s.id = d.id
cross join lateral jsonb_array_elements(s.cards) with ordinality as e(card, ord)
where d.kind = 'standard'
  and coalesce(btrim(e.card ->> 'front'), '') <> ''
  and coalesce(btrim(e.card ->> 'back'), '') <> ''
  and not exists (select 1 from public.flashcards f where f.deck_id = d.id)
on conflict do nothing;

update public.lessons l
set deck_id = d.id
from public.flashcard_decks d
where d.kind = 'standard' and d.archived_at is null
  and d.topic_id = l.topic_id
  and d.subtopic_id is not distinct from l.subtopic_id
  and l.class_id is null
  and l.deck_id is null;
