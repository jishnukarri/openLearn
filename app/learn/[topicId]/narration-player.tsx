"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { activeWord, sentenceIndexes, splitWords } from "@/lib/audio-timing";

export function narrationUrl(audioId: string): string {
  return `/api/lesson-audio/${encodeURIComponent(audioId)}`;
}

const playClass =
  "mb-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// The section's explanation, read aloud. One Play button on top; while it
// plays, the sentence being spoken and the word being spoken are highlighted
// right in the text, like lyrics. The words on screen are the script the voice
// read, so text and audio always match. The recording was made when the lesson
// was created and warmed when it opened, so Play starts straight away.
export function NarratedExplanation({
  audioId,
  script,
  starts,
}: {
  audioId: string;
  script: string;
  starts?: number[] | null;
}) {
  const el = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [word, setWord] = useState(-1);
  const [failed, setFailed] = useState(false);

  const words = splitWords(script);
  const sentences = sentenceIndexes(words);
  // The highlight only follows along when there is one timing per word.
  const followable = starts?.length === words.length;

  useEffect(() => {
    const node = el.current;
    return () => node?.pause();
  }, []);

  // Smooth word tracking while the voice plays (timeupdate alone is too coarse).
  useEffect(() => {
    if (!playing || !followable || !starts) return;
    let raf = 0;
    const tick = () => {
      const node = el.current;
      if (node) setWord(activeWord(starts, node.currentTime * 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, followable, starts]);

  async function toggle() {
    const node = el.current;
    if (!node) return;
    if (playing) {
      node.pause();
      return;
    }
    try {
      await node.play();
      setStarted(true);
    } catch {
      setFailed(true);
    }
  }

  const current = word >= 0 ? sentences[word] : -1;
  return (
    <div>
      {!failed && (
        <>
          <audio
            ref={el}
            src={narrationUrl(audioId)}
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setStarted(false); setWord(-1); }}
            onError={() => setFailed(true)}
          />
          <button type="button" className={playClass} onClick={toggle} aria-label={playing ? "Pause the voiceover" : "Listen to this explanation"}>
            {playing ? <Pause className="size-4" strokeWidth={2} aria-hidden="true" /> : <Play className="size-4" strokeWidth={2} aria-hidden="true" />}
            {playing ? "Pause" : started ? "Resume" : "Listen"}
          </button>
        </>
      )}
      <p className="mt-0 max-w-[65ch] text-lg leading-relaxed text-foreground">
        {words.map((w, i) => {
          const inLine = followable && started && sentences[i] === current;
          const here = inLine && i === word;
          return (
            <span
              key={i}
              className={
                here
                  ? "rounded bg-primary/30 px-0.5 font-semibold text-foreground"
                  : inLine
                    ? "bg-primary/10 px-0.5"
                    : followable && started && current >= 0
                      ? "px-0.5 text-muted"
                      : "px-0.5"
              }
            >
              {w}{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}
