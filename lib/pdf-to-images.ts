import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

// Rasterizes every page of a PDF to a JPEG via poppler's pdftoppm. A
// student answer-script upload is often one PDF containing every student's
// pages concatenated together — reference-code detection and grouping (see
// paper-marking-grouping.ts) need one image per page to find where each
// student's script starts, not one blob for the whole file. Shells out to
// the system pdftoppm binary rather than a pdfjs-dist render path, since
// pdfjs-dist's worker architecture already doesn't bundle under Turbopack
// (see lib/extract-text.ts).
export async function pdfToImages(bytes: Buffer): Promise<{ bytes: Buffer; contentType: string }[]> {
  const dir = await mkdtemp(join(tmpdir(), "paper-pdf-"));
  try {
    const inputPath = join(dir, "input.pdf");
    await writeFile(inputPath, bytes);
    const outputPrefix = join(dir, "page");
    await execFileAsync("pdftoppm", ["-jpeg", "-r", "200", inputPath, outputPrefix]);

    const files = (await readdir(dir))
      .filter((f) => f.startsWith("page") && f.endsWith(".jpg"))
      .sort();
    return await Promise.all(
      files.map(async (f) => ({
        bytes: await readFile(join(dir, f)),
        contentType: "image/jpeg",
      }))
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
