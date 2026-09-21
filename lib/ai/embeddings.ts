import "server-only";

// Embeddings always use the platform's own Gemini key regardless of which
// text provider a teacher has configured — same reasoning as image
// generation in lib/ai/images.ts: this needs one specific capability
// (text-embedding-004), not whatever chat model is configured. Returns
// null (never throws) with no key set — RAG features degrade gracefully
// to "no reference material" rather than blocking generation.
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });
    return response.embeddings?.[0]?.values ?? null;
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return null;
  }
}
