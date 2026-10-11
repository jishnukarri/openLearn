import { notFound } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getUploadSession } from "@/lib/supabase/practice-uploads";
import { PageShell, PageHeader } from "@/components/page-shell";
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
    <PageShell size="focus">
      <PageHeader
        title="Upload your answer"
        description="Take a photo (or attach a PDF) of your handwritten answer. You can add more than one page."
      />

      <UploadForm uploadId={uploadId} />
    </PageShell>
  );
}
