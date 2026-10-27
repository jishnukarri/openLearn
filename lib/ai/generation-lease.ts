// Cross-instance lease for lazy AI generation. The instance that wins the
// lease generates and writes; the others poll the cache until the value
// appears or they give up (null = unavailable, retryable).

export const LEASE_WINDOW_MS = 60_000;
export const POLL_INTERVAL_MS = 1_500;
export const POLL_MAX_MS = 25_000;

export function leaseKey(questionId: string, kind: "hints" | "remediation"): string {
  return `${questionId}:${kind}`;
}

export type LeaseDeps<T> = {
  acquire: () => Promise<boolean>;
  generate: () => Promise<T | null>;
  readCached: () => Promise<T | null>;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  maxWaitMs?: number;
};

export async function withGenerationLease<T>(deps: LeaseDeps<T>): Promise<T | null> {
  if (await deps.acquire()) return deps.generate();
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pollMs = deps.pollMs ?? POLL_INTERVAL_MS;
  const maxWaitMs = deps.maxWaitMs ?? POLL_MAX_MS;
  for (let waited = 0; waited < maxWaitMs; waited += pollMs) {
    await sleep(pollMs);
    const hit = await deps.readCached();
    if (hit) return hit;
  }
  return null;
}
