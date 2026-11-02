import { Mp3Encoder } from "@breezystack/lamejs";

// 16-bit mono PCM to an MP3 every browser plays. The level is raised to a clear
// speaking volume first, because the model's raw output is on the quiet side:
// gain towards a target loudness, then a soft limiter so peaks never clip.
const TARGET_RMS_DB = -18;
const MAX_GAIN = 4;
const BITRATE_KBPS = 64;
const FRAME = 1152;

export function normalizePcm(samples: Int16Array): Int16Array {
  let sum = 0;
  for (const x of samples) sum += x * x;
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  if (rms < 1) return samples;
  const gain = Math.min(MAX_GAIN, Math.pow(10, (TARGET_RMS_DB - 20 * Math.log10(rms / 32768)) / 20));
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // tanh keeps loud peaks smooth instead of hard clipping.
    out[i] = Math.round(Math.tanh((samples[i] * gain) / 32768) * 32767 * 0.97);
  }
  return out;
}

export function pcm16ToMp3(pcm: Buffer, sampleRate = 24_000): Buffer {
  const n = Math.floor(pcm.length / 2);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) samples[i] = pcm.readInt16LE(i * 2);
  const loud = normalizePcm(samples);
  const encoder = new Mp3Encoder(1, sampleRate, BITRATE_KBPS);
  const parts: Buffer[] = [];
  for (let i = 0; i < loud.length; i += FRAME) {
    const chunk = encoder.encodeBuffer(loud.subarray(i, i + FRAME));
    if (chunk.length) parts.push(Buffer.from(chunk));
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(Buffer.from(tail));
  return Buffer.concat(parts);
}
