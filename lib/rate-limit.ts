import "server-only";
import { headers } from "next/headers";

// In-memory sliding window limiter. Resets on process restart and is
// per-instance only — fine for a single-server deployment, not for a
// multi-instance one (would need a shared store like Redis there).
const attempts = new Map<string, number[]>();

function consume(key: string, limit: number, windowMs: number): boolean {
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
export function checkKeyRateLimit(bucket: string, key: string, limit: number, windowMs: number): boolean {
  return consume(`${bucket}:key:${key.toLowerCase()}`, limit, windowMs);
}
