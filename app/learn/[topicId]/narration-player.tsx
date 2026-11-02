"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";

const buttonClass =
  "inline-flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40";

export function narrationUrl(audioId: string): string {
  return `/api/lesson-audio/${encodeURIComponent(audioId)}`;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Play, pause and stop for a section's pre-recorded voiceover. The file is
// loaded as soon as the step shows (and was warmed when the lesson opened), so
// Play starts straight away.
export function NarrationPlayer({ audioId }: { audioId: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

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
  }

  if (failed) return null;
  return (
    <div role="group" aria-label="Listen to a quick explanation" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <audio
        ref={el}
        src={narrationUrl(audioId)}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); }}
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
    </div>
  );
}
