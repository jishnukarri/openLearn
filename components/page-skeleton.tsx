// Generic shimmer skeleton for route loading.tsx boundaries, so navigation
// paints instantly while the real page streams in. Mirrors the PageShell
// desktop composition (main column + side panel) so the swap doesn't jump.
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 lg:py-14">
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="h-10 w-2/5 animate-pulse rounded-lg bg-surface" />
          <div className="h-4 w-3/5 animate-pulse rounded-lg bg-surface [animation-delay:100ms]" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                style={{ animationDelay: `${150 + i * 80}ms` }}
                className="h-20 w-full animate-pulse rounded-2xl bg-surface"
              />
            ))}
          </div>
        </div>
        <div className="hidden flex-col gap-3 lg:flex">
          <div className="h-5 w-1/2 animate-pulse rounded-lg bg-surface [animation-delay:200ms]" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-surface [animation-delay:280ms]" />
        </div>
      </div>
    </main>
  );
}
