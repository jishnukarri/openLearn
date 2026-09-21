import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getUploadSession } from "@/lib/supabase/practice-uploads";
import { UploadForm } from "./upload-form";

// Standalone photo/PDF upload page for a practice answer, reached by
// scanning the QR code shown on desktop, or directly on the same device.
// Deliberately its own page (not a modal) so it works from a phone camera.
export default async function PracticeUploadPage({
  params,
}: {
  params: Promise<{ topicId: string; uploadId: string }>;
}) {
  const { profile } = await requireRole("student");
  const { uploadId } = await params;

  const session = await getUploadSession(uploadId);
  if (!session || session.studentId !== profile.id) notFound();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          Upload your answer
        </h1>
        <p className="mt-2 text-sm text-muted">
          Take a photo (or attach a PDF) of your handwritten answer. You can
          add more than one page.
        </p>
      </div>

      <UploadForm uploadId={uploadId} />
    </main>
  );
}
