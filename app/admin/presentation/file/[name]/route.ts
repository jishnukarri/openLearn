import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { requireRole } from "@/lib/appwrite/session";

// Private presentation assets live in content/presentation (not public/), so
// they are only served to a signed-in admin. Whitelisted by name — the
// route param is never used to build a path.
const FILES = {
  "demo.mp4": { type: "video/mp4", disposition: "inline" },
  "handout.pdf": { type: "application/pdf", disposition: "attachment" },
} as const;

type FileName = keyof typeof FILES;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  await requireRole("admin");

  const { name } = await params;
  if (!Object.hasOwn(FILES, name)) return new Response("Not found", { status: 404 });
  const meta = FILES[name as FileName];

  const file = path.join(process.cwd(), "content", "presentation", name);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": meta.type,
    "Content-Disposition": `${meta.disposition}; filename="openlearn-${name}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  // Browsers seek video with Range requests; without 206 support the demo
  // can't be scrubbed and Safari refuses to play it at all.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Number(range[2]) : size - 1;
    if (!(start >= 0 && start <= end && end < size)) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    return new Response(
      Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream,
      {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      },
    );
  }

  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}
