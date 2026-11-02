-- Teachers no longer bring their own AI key; the admin controls AI through the
-- server environment. Dropping the table also removes the stored teacher API keys.
drop table if exists teacher_ai_settings;
