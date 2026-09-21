"use server";

import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireAnyRole, requireRole } from "@/lib/appwrite/session";
import {
  createUploadSession,
  getUploadSession,
  addUploadedFiles,
  getSignedImageUrls,
} from "@/lib/supabase/practice-uploads";

// Starts a hand-off session and returns a QR code (as a data: URL) pointing
// a second device at the upload page for it. Called directly from a client
// component (not a <form>) — Server Actions work as plain RPCs too.
export async function createPracticeUploadSessionAction(input: {
  topicId: string;
  questionId: string;
}): Promise<{ uploadId: string; qrDataUrl: string; url: string }> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);

  const uploadId = await createUploadSession({
    studentId: profile.id,
    topicId: input.topicId,
    questionId: input.questionId,
  });

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const url = `${proto}://${host}/practice/${input.topicId}/upload/${uploadId}`;

  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
  return { uploadId, qrDataUrl, url };
}

// Polled from the desktop tab (direct RPC call, not a form) to find out
// once the phone has uploaded something.
export async function getPracticeUploadStatusAction(
  uploadId: string
): Promise<{ status: "pending" | "ready"; imagePaths: string[]; imageUrls: string[] } | null> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const session = await getUploadSession(uploadId);
  if (!session || session.studentId !== profile.id) return null;

  const imageUrls = await getSignedImageUrls(session.imagePaths);
  return { status: session.status, imagePaths: session.imagePaths, imageUrls };
}

export type UploadPageState = { message?: string; success?: boolean } | undefined;

const ALLOWED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB per file

// The upload page's own submit — works standalone (same device, no QR) or
// as the phone side of a hand-off. Returns a state (via useActionState) so
// the page can show a clean confirmation without a full navigation.
export async function uploadPracticeImagesAction(
  _state: UploadPageState,
  formData: FormData
): Promise<UploadPageState> {
  const { profile } = await requireRole("student");
  const uploadId = formData.get("uploadId");
  if (typeof uploadId !== "string") return { message: "Missing upload session." };

  const session = await getUploadSession(uploadId);
  if (!session || session.studentId !== profile.id) {
    return { message: "Upload session not found." };
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { message: "Choose at least one photo or PDF." };

  for (const file of files) {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return { message: "Only JPEG, PNG, WEBP, HEIC, or PDF files are allowed." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { message: "Each file must be under 20MB." };
    }
  }

  await addUploadedFiles(uploadId, files);
  return { success: true };
}
