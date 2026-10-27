// Per-process guard so a double-clicked "Regenerate" can't start two paid AI
// generations for the same target. A stale entry (a generation that hung)
// expires after `ttlMs` so the button can never stay locked forever.
const running = new Map<string, number>();

export class InFlightError extends Error {
  constructor(message = "That is already being generated. Give it a minute, then refresh.") {
    super(message);
    this.name = "InFlightError";
  }
}

export async function withInFlight<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 5 * 60_000,
  now: () => number = Date.now
): Promise<T> {
  const started = running.get(key);
  if (started !== undefined && now() - started < ttlMs) throw new InFlightError();
  const mine = now();
  running.set(key, mine);
  try {
    return await fn();
  } finally {
    // Only release our own claim — an expired one may have been re-taken.
    if (running.get(key) === mine) running.delete(key);
  }
}

export function isInFlight(key: string): boolean {
  return running.has(key);
}
