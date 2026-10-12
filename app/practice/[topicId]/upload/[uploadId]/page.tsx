import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUploadSession, isUploadLinkOpen } from "@/lib/supabase/practice-uploads";
import { PageShell, PageHeader } from "@/components/page-shell";
import { UploadForm } from "./upload-form";

// A temporary hand-off link, opened on a phone by scanning the QR code on
// the practice page. It needs no login: the unguessable id is the credential
// and it expires, so it is also kept out of search results.
export const metadata: Metadata = {
  title: "Upload your answer",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PracticeUploadPage({
  params,
}: {
  params: Promise<{ topicId: string; uploadId: string }>;
}) {
  const { uploadId } = await params;

  const session = await getUploadSession(uploadId);
  if (!session) notFound();

  if (!isUploadLinkOpen(session)) {
    return (
      <PageShell size="focus">
        <PageHeader
          title="This link has expired"
          description="Upload links only work for a short time. Go back to the practice page and scan a new QR code."
        />
      </PageShell>
    );
  }

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
