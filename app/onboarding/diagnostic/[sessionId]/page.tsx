import { redirect } from "next/navigation";

// The quiz now lives at /level/0 onward (one question per page), this
// route stays only so old links/bookmarks to the session root still land
// somewhere useful.
export default async function DiagnosticSessionRedirect({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/onboarding/diagnostic/${sessionId}/level/0`);
}
