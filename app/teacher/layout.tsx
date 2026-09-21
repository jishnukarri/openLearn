import { requireRole } from "@/lib/appwrite/session";
import { SidebarNav } from "@/components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/teacher/subjects", label: "Subjects" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/papers", label: "Papers (in progress)" },
  { href: "/teacher/mark", label: "Mark Paper" },
  { href: "/teacher/settings", label: "AI Settings" },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("teacher");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col sm:flex-row">
      <SidebarNav items={NAV_ITEMS} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
