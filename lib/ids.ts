// Pure id/cursor validators for values that arrive from URLs and forms.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

// Activity-feed cursor: only a strict ISO-8601 timestamp is passed on to the
// database filter (Date.parse accepts things like "1" that Postgres rejects).
const ISO_TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

export function safeCursor(value: string | null | undefined): string | null {
  if (!value || !ISO_TS.test(value) || Number.isNaN(Date.parse(value))) return null;
  return value;
}
