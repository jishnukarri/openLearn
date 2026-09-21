/**
 * Distributes `total` questions across `sectionCount` sections.
 * Remainder goes to the last sections (hardest material gets more practice).
 * distributeQuestions(3, 10) → [3, 3, 4]
 */
export function distributeQuestions(sectionCount: number, total: number): number[] {
  const base = Math.floor(total / sectionCount);
  const remainder = total % sectionCount;
  return Array.from({ length: sectionCount }, (_, i) =>
    i >= sectionCount - remainder ? base + 1 : base
  );
}
