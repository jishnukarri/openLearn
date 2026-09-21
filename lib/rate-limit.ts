import "server-only";
import { headers } from "next/headers";

// In-memory sliding window limiter. Resets on process restart and is
// per-instance only — fine for a single-server deployment, not for a
// multi-instance one (would need a shared store like Redis there).
const attempts = new Map<string, number[]>();

export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headerList.get("x-real-ip") ??
    "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  const timestamps = (attempts.get(key) ?? []).filter(
    (t) => now - t < windowMs
  );

  if (timestamps.length >= limit) {
    attempts.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  attempts.set(key, timestamps);
  return true;
}
