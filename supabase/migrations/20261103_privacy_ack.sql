-- Records that a student has seen the privacy notice, and which version.
-- Bump PRIVACY_VERSION in lib/privacy.ts to ask everyone to read it again.
alter table public.profiles
  add column if not exists privacy_ack_version integer,
  add column if not exists privacy_ack_at timestamptz;
