import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { exportPersonalData } from "@/lib/supabase/personal-data";
import { checkKeyRateLimit } from "@/lib/rate-limit";

// "Download my data": everything held about the signed-in person, as JSON.
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Not signed in", { status: 401 });
  if (!(await checkKeyRateLimit("data-export", session.userId, 5, 60 * 60_000))) {
    return new Response("Too many downloads. Try again later.", { status: 429 });
  }
  const profile = await getProfileByAppwriteId(session.userId);
  if (!profile) return new Response("No profile found", { status: 404 });
  const data = await exportPersonalData(profile.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="my-open-learn-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
