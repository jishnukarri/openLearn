import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/supabase/database-client";

// Sliding-window limiter. Shared via Postgres when available, with an
// in-memory fallback (per-process, resets on restart).
const attempts = new Map<string, number[]>();

function consumeMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    attempts.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  attempts.set(key, timestamps);
  return true;
}

// Prefers the shared Postgres limiter (supabase/migrations/20261012_rate_limits.sql)
// so limits survive restarts and span instances. If the function isn't
// there yet or the call fails, fall back to the in-memory window and retry
// the database after a minute.
let sharedUnavailableUntil = 0;

async function consume(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (Date.now() >= sharedUnavailableUntil) {
    try {
      const { data, error } = await db.rpc("consume_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_ms: windowMs,
      });
      if (!error && typeof data === "boolean") return data;
    } catch {
      // fall through to memory
    }
    sharedUnavailableUntil = Date.now() + 60_000;
  }
  return consumeMemory(key, limit, windowMs);
}

// Per client IP. Uses the LAST x-forwarded-for entry: that is the address the
// nearest proxy (Caddy) appended, whereas the first entry can be forged by
// the client.
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",").map((p) => p.trim()).filter(Boolean);
  const ip = forwarded?.[forwarded.length - 1] ?? headerList.get("x-real-ip") ?? "unknown";
  return consume(`${bucket}:${ip}`, limit, windowMs);
}

// Per arbitrary key (a user id, or a login email), independent of IP, so
// rotating IPs doesn't reset it. Used for paid AI actions and per-account
// login attempts.
export async function checkKeyRateLimit(bucket: string, key: string, limit: number, windowMs: number): Promise<boolean> {
  return consume(`${bucket}:key:${key.toLowerCase()}`, limit, windowMs);
}
