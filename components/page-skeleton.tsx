// Generic shimmer skeleton for route loading.tsx boundaries, most of the
// app's "stickiness" on navigation was routes with no loading.tsx at all,
// so every click blocked on the full server fetch before painting anything.
// This renders instantly while the real page streams in behind it.
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div className="h-8 w-2/5 animate-pulse rounded-lg bg-surface" />
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
    </main>
  );
}
