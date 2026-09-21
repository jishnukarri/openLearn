import "server-only";
import { Client, Storage, ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

// Single shared bucket for every file this app stores (lesson images,
// photographed practice answers, teacher-uploaded reference documents) —
// already created in the Appwrite console as "user-upload". Files are
// distinguished by their generated file id, not by bucket.
const BUCKET_ID = "user-upload";

function createClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY environment variables"
    );
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
}

function storage() {
  return new Storage(createClient());
}

// Uploads a browser/server File (or raw bytes) and returns its file id —
// store this, it's what every other helper below takes.
export async function uploadFile(
  file: File | { bytes: Buffer; filename: string; contentType: string }
): Promise<string> {
  const input =
    file instanceof File
      ? InputFile.fromBuffer(Buffer.from(await file.arrayBuffer()), file.name)
      : InputFile.fromBuffer(file.bytes, file.filename);

  const created = await storage().createFile({
    bucketId: BUCKET_ID,
    fileId: ID.unique(),
    file: input,
  });
  return created.$id;
}

// A directly-fetchable URL for the file (view, not forced download) — safe
// to hand to <img src> or fetch() from the client. Relies on the bucket's
// own Appwrite console permissions (already configured for this app).
export function getFileUrl(fileId: string): string {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  return `${endpoint}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${projectId}`;
}

export async function downloadFileBytes(
  fileId: string
): Promise<{ bytes: Buffer; contentType: string }> {
  const [result, file] = await Promise.all([
    storage().getFileDownload({ bucketId: BUCKET_ID, fileId }),
    storage().getFile({ bucketId: BUCKET_ID, fileId }),
  ]);
  return { bytes: Buffer.from(result as ArrayBuffer), contentType: file.mimeType };
}

export async function deleteFile(fileId: string): Promise<void> {
  await storage().deleteFile({ bucketId: BUCKET_ID, fileId });
}
