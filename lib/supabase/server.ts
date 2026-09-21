import { createClient } from "@supabase/supabase-js";

// Server-only client using the service_role key, which bypasses RLS.
// Auth is handled by Appwrite, not Supabase Auth, so every table has RLS
// enabled with no policies — the anon/publishable key cannot read or write
// anything. Never import this file from a "use client" component.
export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
