import "server-only";

// pdfjs-dist (bundled in unpdf) calls Math.sumPrecise which landed in V8 ≥13.
// Polyfill it for older Node runtimes so PDF extraction doesn't crash.
const mathWithSumPrecise = Math as unknown as {
  sumPrecise?: (values: Iterable<number>) => number;
};
if (typeof mathWithSumPrecise.sumPrecise !== "function") {
  mathWithSumPrecise.sumPrecise = (values: Iterable<number>): number => {
    let sum = 0;
    for (const v of values) sum += v;
    return sum;
  };
}

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    // pdf-parse (pdfjs-dist's worker architecture) fails under Turbopack's
    // server bundling — "Setting up fake worker failed", can't resolve
    // pdf.worker.mjs relative to the bundled chunk. unpdf is built for
    // exactly this (serverless/Next.js server, no worker thread needed).
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }

  // .txt, .md, or anything else — treat as plain text.
  return buffer.toString("utf-8");
}
