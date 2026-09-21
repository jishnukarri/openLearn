import { requireRole } from "@/lib/appwrite/session";
import { SidebarNav } from "@/components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/users", label: "Accounts" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "AI Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col sm:flex-row">
      <SidebarNav items={NAV_ITEMS} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
