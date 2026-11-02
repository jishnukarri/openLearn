import "server-only";
import { uploadFile, getFileUrl } from "@/lib/appwrite/storage";
import { postChat } from "./client";

const HOUSE_STYLE =
  "Clean, flat, friendly educational illustration for a GCSE learning app. " +
  "Soft colors, simple shapes, no embedded text or labels. ";

// Generates one lesson image, stores it, and returns its public URL. Goes
// through the same Hack Club / OpenRouter pair as every other AI call.
// Returns null (never throws) when no key is set or anything fails —
// lessons must not block on images.
export async function generateLessonImage(
  prompt: string,
  topicId: string
): Promise<string | null> {
  try {
    // One retry: the image models intermittently return text only.
    const bytes = (await generateBytes(prompt)) ?? (await generateBytes(prompt));
    if (!bytes) {
      console.error("Lesson image generation returned no image data");
      return null;
    }

    const fileId = await uploadFile({
      bytes,
      filename: `lesson-${topicId}-${Date.now()}.png`,
      contentType: "image/png",
    });
    return getFileUrl(fileId);
  } catch (err) {
    console.error("Lesson image generation failed:", err);
    return null;
  }
}

async function generateBytes(prompt: string): Promise<Buffer | null> {
  // Hack Club first, OpenRouter if it fails: both return the image as a data: URI.
  const { data } = await postChat(() => ({
    model: process.env.HACKCLUB_IMAGE_MODEL || "google/gemini-3.1-flash-lite-image",
    messages: [{ role: "user", content: HOUSE_STYLE + prompt }],
    modalities: ["image", "text"],
    image_config: { aspect_ratio: "16:9" },
    stream: false,
  }));
  const url = (data.choices as { message?: { images?: { image_url?: { url?: string } }[] } }[] | undefined)?.[0]?.message?.images?.[0]?.image_url?.url;
  const base64 = url?.startsWith("data:") ? url.slice(url.indexOf(",") + 1) : undefined;
  return base64 ? Buffer.from(base64, "base64") : null;
}
