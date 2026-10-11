"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

type Item = { href: string; label: string; icon?: React.ReactNode };

// Section navigation for the admin and teacher areas. Below `sm` it is a
// horizontal strip; from `sm` it is a sticky rail that collapses to icons
// only until `xl` (when items have icons), so pages with a side panel keep
// enough room for their main column.
export function SidebarNav({
  items,
  title,
}: {
  items: Item[];
  title?: string;
}) {
  const pathname = usePathname();
  const hasIcons = items.some((i) => i.icon);

  return (
    <nav
      aria-label={title ?? "Section"}
      className={`flex shrink-0 flex-col border-b border-border bg-surface sm:sticky sm:top-24 sm:m-4 sm:self-start sm:rounded-2xl sm:border ${
        hasIcons ? "sm:w-16 xl:w-56" : "sm:w-56"
      }`}
    >
      {title && (
        <div
          className={`flex items-center gap-2.5 px-4 pt-4 sm:pb-2 ${
            hasIcons ? "sm:justify-center xl:justify-start" : ""
          }`}
        >
          <BrandMark size={28} />
          <span
            className={`font-[family-name:var(--font-display)] text-lg font-semibold text-foreground ${
              hasIcons ? "sm:sr-only xl:not-sr-only" : ""
            }`}
          >
            {title}
          </span>
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto p-3 sm:flex-col sm:overflow-visible sm:p-3 xl:p-4">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                hasIcons ? "sm:justify-center xl:justify-start" : ""
              } ${
                active
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {item.icon && <span aria-hidden className="shrink-0 [&_svg]:size-5">{item.icon}</span>}
              <span className={item.icon ? "sm:sr-only xl:not-sr-only" : ""}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
