import Link from "next/link";

export type PathUnit = {
  id: string;
  name: string;
  href: string;
  diagnosticScore?: number | null;
};

const NODE = 64;
const GAP = 108;
const AMPLITUDE = 84;

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// A small horizontal battery bar showing diagnostic strength (0–100%).
// Only rendered when diagnosticScore is not null.
function StrengthBattery({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-success" : pct >= 50 ? "bg-highlight" : "bg-error";
  return (
    <div className="flex items-center gap-1" title={`Diagnostic: ${pct}%`}>
      <div className="relative h-2 w-10 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-4xs text-muted">{pct}%</span>
    </div>
  );
}

// A winding, Duolingo-style unit path: completed units are filled and
// clickable, the next unit up is highlighted and clickable, everything
// after that is locked until the student reaches it.
export function SubjectPath({
  units,
  completedIds,
}: {
  units: PathUnit[];
  completedIds: string[];
}) {
  const completed = new Set(completedIds);
  const firstIncompleteIndex = units.findIndex((u) => !completed.has(u.id));
  const allDone = firstIncompleteIndex === -1;

  const width = AMPLITUDE * 2 + NODE;
  const height = units.length * GAP + NODE;

  const centers = units.map((_, i) => ({
    x: width / 2 + AMPLITUDE * Math.sin(i * 0.9),
    y: i * GAP + NODE / 2,
  }));

  return (
    <div className="relative mx-auto" style={{ width, height: height + (allDone ? GAP : 0) }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {centers.slice(1).map((c, i) => (
          <line
            key={i}
            x1={centers[i].x}
            y1={centers[i].y}
            x2={c.x}
            y2={c.y}
            stroke="var(--border)"
            strokeWidth={6}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {units.map((unit, i) => {
        const isDone = completed.has(unit.id);
        const isCurrent = i === firstIncompleteIndex;
        const isLocked = !isDone && !isCurrent;
        const center = centers[i];

        const node = (
          <div
            style={{
              width: NODE,
              height: NODE,
              left: center.x - NODE / 2,
              top: center.y - NODE / 2,
            }}
            className={`animate-pop-in absolute flex flex-col items-center justify-center rounded-full border-4 text-lg font-bold transition-transform ${
              isDone
                ? "border-success bg-success text-white hover:-translate-y-1"
                : isCurrent
                  ? "border-primary bg-primary text-white shadow-[0_0_0_6px_color-mix(in_srgb,var(--primary)_25%,transparent)] hover:-translate-y-1"
                  : "border-border bg-surface text-muted"
            }`}
          >
            {isDone ? "★" : isLocked ? <LockIcon /> : "▶"}
          </div>
        );

        return (
          <div key={unit.id} className="group absolute" style={{ left: 0, top: 0 }}>
            {isLocked ? (
              node
            ) : (
              <Link href={unit.href} className="absolute" style={{ left: 0, top: 0 }}>
                {node}
              </Link>
            )}
            <div
              style={{
                left: center.x,
                top: center.y + NODE / 2 + 6,
                transform: "translateX(-50%)",
                width: 150,
              }}
              className="absolute flex flex-col items-center gap-1"
            >
              <p
                className={`text-center text-xs font-medium ${
                  isLocked ? "text-muted" : "text-foreground"
                }`}
              >
                {unit.name}
              </p>
              {unit.diagnosticScore != null && (
                <StrengthBattery score={unit.diagnosticScore} />
              )}
            </div>
          </div>
        );
      })}

      {allDone && (
        <div
          style={{
            left: width / 2 - NODE / 2,
            top: units.length * GAP,
          }}
          className="animate-pop-in absolute flex flex-col items-center justify-center gap-1 text-center"
        >
          <div
            style={{ width: NODE, height: NODE }}
            className="flex items-center justify-center rounded-full border-4 border-highlight bg-highlight text-2xl text-white"
          >
            🏆
          </div>
          <p className="text-xs font-medium text-highlight">All units complete</p>
        </div>
      )}
    </div>
  );
}
