import { AuthShowcase } from "./auth-showcase";
import { BrandMark } from "./brand-mark";

// Desktop: a two-panel split, the product's marking promise on the left and
// the form on the right. Mobile: just the form under the brand mark.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[calc(100dvh-73px)] lg:grid-cols-2">
      <section className="relative hidden items-center justify-center overflow-hidden border-r border-border bg-surface p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-primary/15 blur-[120px]"
        />
        <div className="relative">
          <AuthShowcase />
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-14">
        <div className="animate-fade-slide-up w-full max-w-sm">
          <BrandMark size={40} className="mb-8 lg:hidden" />
          {children}
        </div>
      </section>
    </main>
  );
}
