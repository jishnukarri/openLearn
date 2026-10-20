import "server-only";
import { uploadFile, getFileUrl } from "@/lib/appwrite/storage";
import { hackClubFetch } from "./client";

const HOUSE_STYLE =
  "Clean, flat, friendly educational illustration for a GCSE learning app. " +
  "Soft colors, simple shapes, no embedded text or labels. ";

// Generates one lesson image ("nano banana" — gemini-2.5-flash-image),
// stores it in the public `lesson-images` bucket, and returns its public
// URL. Follows the platform provider: when AI_PROVIDER=hackclub the image
// goes through the Hack Club AI proxy (OpenAI-compatible), otherwise the
// direct Gemini API — whichever of the two has a key wins as fallback.
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
  const hackclubKey = process.env.HACKCLUB_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const preferHackClub = process.env.AI_PROVIDER === "hackclub";

  if (preferHackClub && hackclubKey) return generateViaHackClub(prompt, hackclubKey);
  if (geminiKey) return generateViaGemini(prompt, geminiKey);
  if (hackclubKey) return generateViaHackClub(prompt, hackclubKey);
  return null;
}

async function generateViaGemini(
  prompt: string,
  apiKey: string
): Promise<Buffer | null> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
    contents: HOUSE_STYLE + prompt,
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data
  );
  return part?.inlineData?.data
    ? Buffer.from(part.inlineData.data, "base64")
    : null;
}

// Hack Club's proxy is OpenRouter-shaped: image models return their output
// in message.images[].image_url.url as a data: URI.
async function generateViaHackClub(
  prompt: string,
  apiKey: string
): Promise<Buffer | null> {
  const response = await hackClubFetch(
    "https://ai.hackclub.com/proxy/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:
          process.env.HACKCLUB_IMAGE_MODEL || "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: HOUSE_STYLE + prompt }],
        modalities: ["image", "text"],
        image_config: { aspect_ratio: "16:9" },
        stream: false,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Hack Club image request failed (${response.status}): ${await response.text()}`
    );
  }

  const data = await response.json();
  const url: string | undefined =
    data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const base64 = url?.startsWith("data:")
    ? url.slice(url.indexOf(",") + 1)
    : undefined;
  return base64 ? Buffer.from(base64, "base64") : null;
}
