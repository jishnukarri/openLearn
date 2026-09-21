import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Auth is handled by Appwrite, not Supabase Auth, so every table has RLS
// enabled with no policies — the anon/publishable key cannot read or write
// anything. Never import this file from a "use client" component.
//
// All Supabase access in this codebase must go through this class instead
// of calling `@supabase/supabase-js` directly, so the underlying provider
// can be swapped later without touching every call site.
class SupabaseDatabaseClient {
  private readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  from(table: string) {
    return this.client.from(table);
  }

  rpc(fn: string, params?: Record<string, unknown>) {
    return this.client.rpc(fn, params);
  }
}

export type DatabaseClient = SupabaseDatabaseClient;

export const db = new SupabaseDatabaseClient();
