import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { getClassByInviteCode, joinClass } from "@/lib/supabase/classes";
import { Button } from "@/components/button";

export default async function JoinClassPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { profile } = await requireRole("student");
  const { code } = await params;

  const cls = await getClassByInviteCode(code);
  if (!cls) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-3 px-6 py-16 text-center">
        <p className="text-sm text-error">
          That invite link doesn&apos;t match a class.
        </p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Go to dashboard
        </Link>
      </main>
    );
  }

  await joinClass({ classId: cls.id, studentId: profile.id });

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
        You&apos;ve joined {cls.name}
      </h1>
      <Link href="/dashboard">
        <Button>Go to dashboard</Button>
      </Link>
    </main>
  );
}
