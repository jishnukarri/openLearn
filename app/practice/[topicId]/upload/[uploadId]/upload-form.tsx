"use client";

import { useActionState } from "react";
import {
  uploadPracticeImagesAction,
  type UploadPageState,
} from "@/app/actions/practice-uploads";
import { Button } from "@/components/button";

export function UploadForm({ uploadId }: { uploadId: string }) {
  const [state, action, pending] = useActionState<UploadPageState, FormData>(
    uploadPracticeImagesAction,
    undefined
  );

  if (state?.success) {
    return (
      <div className="animate-pop-in rounded-2xl border border-success/40 bg-success/10 p-6 text-center">
        <p className="text-lg font-semibold text-success">Uploaded ✓</p>
        <p className="mt-2 text-sm text-muted">
          If you scanned this from your computer, head back there now, your
          photo is already waiting on the practice page.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="uploadId" value={uploadId} />
      <input
        type="file"
        name="files"
        accept="image/*,application/pdf"
        capture="environment"
        multiple
        required
        className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
      />
      {state?.message && <p className="text-sm text-error">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
