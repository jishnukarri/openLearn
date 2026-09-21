export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-[calc(100dvh-73px)] items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 blur-[120px]"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/20">
        {children}
      </div>
    </main>
  );
}
