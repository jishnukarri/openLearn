"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: "/dashboard/add-subjects",
    label: "Subjects",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    href: "/onboarding/diagnostic",
    label: "Diagnostic",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "Account",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide during lesson/practice/flashcard fullscreen routes.
  const isFullscreen =
    pathname.startsWith("/learn/") ||
    pathname.startsWith("/practice/") ||
    pathname.startsWith("/flashcards/") ||
    pathname.startsWith("/onboarding/diagnostic/");

  if (isFullscreen) return null;

  return (
    <>
      {/* Spacer so the last of the page is never hidden behind the fixed bar. */}
      <div aria-hidden className="h-[calc(4.25rem+env(safe-area-inset-bottom))] shrink-0 sm:hidden" />
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] border-t border-border bg-background/90 backdrop-blur-md sm:hidden">
      <div className="flex items-stretch">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                active ? "text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              <span className={active ? "text-primary" : "text-muted"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
