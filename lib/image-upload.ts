// Server-side check for teacher-uploaded lesson images. Declared MIME types
// are client-controlled, so the file's leading bytes must agree with them.
// SVG is refused: it can carry script when opened directly from storage.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  "image/webp": (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

export function validateImageUpload(type: string, size: number, head: Uint8Array): string | null {
  if (size <= 0) return "No image provided.";
  if (size > MAX_IMAGE_BYTES) return "Image must be under 10 MB.";
  const sig = SIGNATURES[type.toLowerCase()];
  if (!sig) return "Use a PNG, JPEG, GIF or WebP image.";
  if (!sig(head)) return "That file is not a valid image of the type it claims to be.";
  return null;
}
