import { BookOpen, FileCheck2, GraduationCap, Settings2, Users } from "lucide-react";
import { requireRole } from "@/lib/appwrite/session";
import { SidebarNav } from "@/components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/teacher/subjects", label: "Subjects", icon: <BookOpen /> },
  { href: "/teacher/classes", label: "Classes", icon: <Users /> },
  { href: "/teacher/papers", label: "Papers (in progress)", icon: <FileCheck2 /> },
  { href: "/teacher/mark", label: "Mark Paper", icon: <GraduationCap /> },
  { href: "/teacher/settings", label: "AI Settings", icon: <Settings2 /> },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("teacher");

  return (
    <div data-fluid className="flex w-full flex-col sm:flex-row">
      <SidebarNav items={NAV_ITEMS} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
