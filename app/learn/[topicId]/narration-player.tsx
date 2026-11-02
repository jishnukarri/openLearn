"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { activeWord, splitWords } from "@/lib/audio-timing";

const buttonClass =
  "inline-flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40";

export function narrationUrl(audioId: string): string {
  return `/api/lesson-audio/${encodeURIComponent(audioId)}`;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Play, pause and stop for a section's pre-recorded voiceover. The file is
// loaded as soon as the step shows (and was warmed when the lesson opened), so
// Play starts straight away.
export function NarrationPlayer({
  audioId,
  script,
  starts,
}: {
  audioId: string;
  script?: string | null;
  starts?: number[] | null;
}) {
  const el = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [showText, setShowText] = useState(false);
  const [word, setWord] = useState(-1);

  const words = script ? splitWords(script) : [];
  // The highlight only follows along when there is one timing per word.
  const followable = words.length > 0 && starts?.length === words.length;

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

  // Leaving the step stops the voice.
  useEffect(() => {
    const node = el.current;
    return () => node?.pause();
  }, []);

  async function play() {
    try {
      await el.current?.play();
    } catch {
      setFailed(true);
    }
  }
  function stop() {
    const node = el.current;
    if (!node) return;
    node.pause();
    node.currentTime = 0;
    setTime(0);
    setWord(-1);
  }

  if (failed) return null;
  return (
    <div role="group" aria-label="Listen to a quick explanation" className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
    <div className="flex flex-wrap items-center gap-3">
      <audio
        ref={el}
        src={narrationUrl(audioId)}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); setWord(-1); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
      <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
        <Volume2 className="size-4 text-primary" strokeWidth={2} aria-hidden="true" /> Listen to a quick explanation
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} onClick={playing ? () => el.current?.pause() : play} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="size-4" strokeWidth={2} aria-hidden="true" /> : <Play className="size-4" strokeWidth={2} aria-hidden="true" />}
        </button>
        <button type="button" className={buttonClass} onClick={stop} aria-label="Stop" disabled={!playing && time === 0}>
          <Square className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <span className="font-[family-name:var(--font-mono)] text-sm text-muted" aria-hidden="true">
        {clock(time)}{duration ? ` / ${clock(duration)}` : ""}
      </span>
      {words.length > 0 && (
        <button
          type="button"
          onClick={() => setShowText((v) => !v)}
          aria-pressed={showText}
          className="ml-auto min-h-11 rounded-full px-3 text-sm font-medium text-primary-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {showText ? "Hide text" : "Follow the text"}
        </button>
      )}
    </div>
    {showText && words.length > 0 && (
      <p className="mt-3 max-w-[65ch] border-t border-border pt-3 text-lg leading-relaxed text-foreground">
        {words.map((w, i) => (
          <span
            key={i}
            className={
              followable && i === word
                ? "rounded bg-primary/25 px-0.5 text-foreground"
                : followable && word >= 0 && i > word
                  ? "px-0.5 text-muted"
                  : "px-0.5"
            }
          >
            {w}{" "}
          </span>
        ))}
      </p>
    )}
    </div>
  );
}
