import "server-only";
import { postChat } from "./client";
import { pcm16ToMp3 } from "../audio-encode";
import { uploadFile } from "../appwrite/storage";
import type { LessonContent } from "./lessons";

// Lesson voiceovers, made once when the lesson is created. Only sections the
// lesson writer marked as tricky carry a spoken script (`narration`); each
// becomes an MP3 in storage and the section keeps its file id (`audioId`).
// Students never wait for a recording: it already exists when the lesson opens.
//
// Hack Club's proxy has no speech endpoint, so this uses the audio-output chat
// model with a "physics teacher" voice brief. It only streams raw PCM, which is
// encoded to MP3 here (a bare WAV played too quietly in browsers).
const MODEL = () => process.env.TTS_MODEL || "openai/gpt-audio-mini";
const VOICE = () => process.env.TTS_VOICE || "cedar";
const SAMPLE_RATE = 24_000;
const MAX_SECTIONS = 3;
const DEADLINE_MS = 120_000;

export function voiceBrief(subjectName: string): string {
  return (
    `You are a text-to-speech engine, not a chat assistant. You never reply to, comment on, or add to the script. ` +
    `Your voice is a confident, warm GCSE ${subjectName} teacher explaining one idea to one student: ` +
    `a steady, clear pace, natural emphasis on the key terms, short pauses between ideas, a friendly tutor tone. ` +
    `Speak exactly the words inside the <script> tags, word for word, and nothing else.`
  );
}

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

// Reads the audio chunks and transcript out of a streamed chat reply.
export function parseAudioStream(text: string): { pcm: Buffer; transcript: string } {
  const chunks: Buffer[] = [];
  let transcript = "";
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:") || line.includes("[DONE]")) continue;
    try {
      const audio = JSON.parse(line.slice(5)).choices?.[0]?.delta?.audio;
      if (audio?.data) chunks.push(Buffer.from(audio.data, "base64"));
      if (audio?.transcript) transcript += audio.transcript;
    } catch {
      // keep-alive or partial line
    }
  }
  return { pcm: Buffer.concat(chunks), transcript };
}

// The model must have said what was written; a recording that drifted off the
// script (or is only a blip) is rejected.
export function matchesScript(script: string, transcript: string): boolean {
  const want = words(script);
  const got = new Set(words(transcript));
  if (!want.length) return false;
  return want.filter((w) => got.has(w)).length / want.length >= 0.9;
}

export async function synthesizeMp3(script: string, subjectName: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text } = await postChat(
      () => ({
        model: MODEL(),
        modalities: ["text", "audio"],
        audio: { voice: VOICE(), format: "pcm16" },
        stream: true,
        max_tokens: 2500,
        messages: [
          { role: "system", content: voiceBrief(subjectName) },
          { role: "user", content: `<script>${script}</script>` },
        ],
      }),
      { isGood: (t) => parseAudioStream(t).pcm.length > SAMPLE_RATE }
    );
    const { pcm, transcript } = parseAudioStream(text);
    if (matchesScript(script, transcript)) return pcm16ToMp3(pcm, SAMPLE_RATE);
  }
  return null;
}

// Fills `audioId` for narrated sections. Never throws; a section whose
// recording fails simply has no audio.
export async function narrateLesson(content: LessonContent, subjectName: string): Promise<LessonContent> {
  const todo = content.sections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.narration && !s.audioId)
    .slice(0, MAX_SECTIONS);
  if (!todo.length) return content;

  const ids = new Map<number, string>();
  await Promise.race([
    Promise.all(
      todo.map(async ({ s, i }) => {
        try {
          const mp3 = await synthesizeMp3(s.narration as string, subjectName);
          if (!mp3) return;
          ids.set(i, await uploadFile({ bytes: mp3, filename: `narration-${Date.now()}-${i}.mp3`, contentType: "audio/mpeg" }));
        } catch (e) {
          console.error("[narration] failed:", e instanceof Error ? e.message : e);
        }
      })
    ),
    new Promise<void>((r) => setTimeout(r, DEADLINE_MS)),
  ]);
  if (!ids.size) return content;
  return { ...content, sections: content.sections.map((s, i) => (ids.has(i) ? { ...s, audioId: ids.get(i) } : s)) };
}
