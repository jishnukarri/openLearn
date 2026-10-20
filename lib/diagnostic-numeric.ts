// Numeric diagnostic questions are stored as `fill_blank` rows whose content
// carries an extra `numeric` block, so existing databases (and any check
// constraint on the `type` column) keep working with no migration.
export type NumericMeta = {
  unit?: string;
  tolerancePercent?: number;
  sigFigs?: number;
};

export type NumericGenFields = {
  type: string;
  blankAnswer: string;
  numericUnit?: string;
  tolerancePercent?: number;
  sigFigs?: number;
};

// Fields the AI schema adds for the "numeric" generation type.
export const NUMERIC_SCHEMA_PROPS = {
  numericUnit: { type: "string" },
  tolerancePercent: { type: "number" },
  sigFigs: { type: "integer" },
} as const;

export const NUMERIC_PROMPT_NOTE =
  `Any question that needs a number worked out (moles, concentrations, ` +
  `speeds, areas, percentages, solving for x...) MUST be type "numeric", ` +
  `never "mcq": put the correct value as plain digits in "blankAnswer" ` +
  `(e.g. "0.25"), the unit in "numericUnit" (e.g. "mol", or "" if none), ` +
  `the relative tolerance in "tolerancePercent" (usually 1) and "sigFigs" ` +
  `(0 if not required); 1-2 marks. Use "mcq" only for recall and concept ` +
  `questions.`;

export function numericMetaFrom(q: NumericGenFields): NumericMeta {
  return {
    ...(q.numericUnit ? { unit: q.numericUnit } : {}),
    ...(q.tolerancePercent ? { tolerancePercent: q.tolerancePercent } : {}),
    ...(q.sigFigs ? { sigFigs: q.sigFigs } : {}),
  };
}

export function readNumericMeta(content: unknown): NumericMeta | null {
  const n = (content as { numeric?: NumericMeta } | null)?.numeric;
  return n && typeof n === "object" ? n : null;
}
