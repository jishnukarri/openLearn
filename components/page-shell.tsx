import { cn } from "@/lib/utils";

// Page width roles. Pick by the task, not by habit:
//   focus   - one decision at a time (a single form, a confirmation)
//   form    - a form or list with room for a side panel
//   content - reading and lesson-style pages
//   wide    - dashboards, tables, grids
const SIZES = {
  focus: "max-w-xl",
  form: "max-w-4xl",
  content: "max-w-5xl",
  wide: "max-w-6xl",
} as const;

// Standard page frame. With `aside`, desktop gets a two-column composition
// (main + sticky side panel) so wide screens carry useful context instead of
// empty margin; below lg the aside stacks under the main content.
export function PageShell({
  size = "content",
  aside,
  children,
  className,
}: {
  size?: keyof typeof SIZES;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto w-full px-6 py-10 lg:py-14", SIZES[size], className)}>
      {aside ? (
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 flex-col gap-8">{children}</div>
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24">{aside}</aside>
        </div>
      ) : (
        <div className="flex flex-col gap-8">{children}</div>
      )}
    </main>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-slide-up flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-[60ch] text-base text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// Flat side-panel section: a rule and a heading, not another card.
export function AsideBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-muted">{children}</div>
    </section>
  );
}
