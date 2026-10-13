// Postgres text/jsonb columns reject the NUL character (error 22P05,
// "\\u0000 cannot be converted to text"). It shows up in AI output, pasted
// text and OCR, so every write is scrubbed here instead of at each call site.
export function stripNul<T>(value: T): T {
  if (typeof value === "string") return value.replace(/\u0000/g, "") as T;
  if (Array.isArray(value)) return value.map(stripNul) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripNul(v)])) as T;
  }
  return value;
}

