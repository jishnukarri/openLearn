-- Extend questions with bank metadata and optional image URL.
-- Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS section_index INTEGER,
  ADD COLUMN IF NOT EXISTS bank_position INTEGER,
  ADD COLUMN IF NOT EXISTS verified    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image_url   TEXT;

-- Speed up ordered bank fetches
CREATE INDEX IF NOT EXISTS idx_questions_topic_bank
  ON questions (topic_id, bank_position)
  WHERE bank_position IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_subtopic_bank
  ON questions (subtopic_id, bank_position)
  WHERE bank_position IS NOT NULL AND subtopic_id IS NOT NULL;

-- Practice session tracking
CREATE TABLE IF NOT EXISTS question_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  topic_id     UUID        REFERENCES topics(id)              ON DELETE CASCADE,
  subtopic_id  UUID        REFERENCES subtopics(id)           ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  mastery_exit BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS question_session_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES question_sessions(id) ON DELETE CASCADE,
  question_id  UUID        NOT NULL REFERENCES questions(id)          ON DELETE CASCADE,
  student_id   UUID        REFERENCES profiles(id)                    ON DELETE SET NULL,
  correct      BOOLEAN     NOT NULL,
  is_retry     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE question_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_session_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sessions" ON question_sessions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "own_attempts" ON question_session_attempts
  FOR ALL USING (
    session_id IN (SELECT id FROM question_sessions WHERE student_id = auth.uid())
  );

CREATE POLICY "staff_read_sessions" ON question_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

CREATE POLICY "staff_read_attempts" ON question_session_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );
