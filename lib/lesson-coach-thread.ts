// Pure helpers for the coach chat, which now persists across lesson steps.
// Each message remembers the step it was sent on; a "Now on step N" divider
// is derived wherever consecutive messages sit on different steps.

export type ThreadItem<M extends { step: number }> =
  | { kind: "divider"; step: number; key: string }
  | { kind: "msg"; msg: M; index: number };

export function threadWithDividers<M extends { step: number }>(
  thread: M[],
  currentStep?: number
): ThreadItem<M>[] {
  const out: ThreadItem<M>[] = [];
  let prev: number | null = null;
  thread.forEach((msg, index) => {
    if (prev !== null && msg.step !== prev) out.push({ kind: "divider", step: msg.step, key: `d${index}` });
    out.push({ kind: "msg", msg, index });
    prev = msg.step;
  });
  // The student moved on without asking anything yet.
  if (prev !== null && currentStep !== undefined && currentStep !== prev) {
    out.push({ kind: "divider", step: currentStep, key: "d-now" });
  }
  return out;
}
