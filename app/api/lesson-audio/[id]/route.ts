import { getSession } from "@/lib/appwrite/session";
import { downloadFileBytes } from "@/lib/appwrite/storage";

// Lesson voiceovers are served from here, not straight from storage: the
// browser gets a normal audio/mpeg response with range support (so seeking and
// Safari work), and the shared storage bucket is never exposed. Only MP3 files
// are served; the bucket also holds students' photographed answers.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Not signed in", { status: 401 });

  const { id } = await params;
  if (!ID.test(id)) return new Response("Not found", { status: 404 });

  let file: { bytes: Buffer; contentType: string };
  try {
    file = await downloadFileBytes(id);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (file.contentType !== "audio/mpeg") return new Response("Not found", { status: 404 });

  const total = file.bytes.length;
  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    // A recording never changes under its id, so the browser can keep it.
    "Cache-Control": "private, max-age=31536000, immutable",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2] || 0));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
    if (start > end || start >= total) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    return new Response(new Uint8Array(file.bytes.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(file.bytes), { headers: { ...headers, "Content-Length": String(total) } });
}
