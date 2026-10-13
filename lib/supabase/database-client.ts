import "server-only";
import { stripNul } from "@/lib/strip-nul";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Auth is handled by Appwrite, not Supabase Auth, so every table has RLS
// enabled with no policies — the anon/publishable key cannot read or write
// anything. Never import this file from a "use client" component.
//
// All Supabase access in this codebase must go through this class instead
// of calling `@supabase/supabase-js` directly, so the underlying provider
// can be swapped later without touching every call site.
const WRITE_METHODS = new Set(["insert", "update", "upsert"]);

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
    const query = this.client.from(table);
    return new Proxy(query, {
      get(target, prop) {
        const value = Reflect.get(target, prop, target);
        if (typeof value !== "function") return value;
        if (WRITE_METHODS.has(String(prop))) {
          return (values: unknown, ...rest: unknown[]) => value.call(target, stripNul(values), ...rest);
        }
        return value.bind(target);
      },
    });
  }

  rpc(fn: string, params?: Record<string, unknown>) {
    return this.client.rpc(fn, params ? stripNul(params) : params);
  }
}

export type DatabaseClient = SupabaseDatabaseClient;

export const db = new SupabaseDatabaseClient();
