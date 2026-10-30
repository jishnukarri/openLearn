import { BookOpen, Flag, Presentation, ShieldBan, Settings2, Users } from "lucide-react";
import { requireRole } from "@/lib/appwrite/session";
import { SidebarNav } from "@/components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/admin/subjects", label: "Subjects", icon: <BookOpen /> },
  { href: "/admin/users", label: "Accounts", icon: <Users /> },
  { href: "/admin/reports", label: "Reports", icon: <Flag /> },
  { href: "/admin/blocklist", label: "Blocklist", icon: <ShieldBan /> },
  { href: "/admin/settings", label: "AI Settings", icon: <Settings2 /> },
  { href: "/admin/presentation", label: "Presentation", icon: <Presentation /> },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");

  return (
    <div data-fluid className="flex w-full flex-col sm:flex-row">
      <SidebarNav items={NAV_ITEMS} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
