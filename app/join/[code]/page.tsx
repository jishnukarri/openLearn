import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { requireRole } from "@/lib/appwrite/session";
import { getClassByInviteCode, joinClass } from "@/lib/supabase/classes";
import { Button } from "@/components/button";
import { PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

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
      <PageShell size="focus" className="lg:py-24">
        <Stagger className="flex flex-col gap-4">
          <Rise>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-4xl">
              That invite link doesn&apos;t match a class
            </h1>
          </Rise>
          <Rise>
            <p className="max-w-[60ch] text-base text-muted">
              Check the link with your teacher, or study on your own from the dashboard.
            </p>
          </Rise>
          <Rise>
            <Link href="/dashboard" className="text-base font-medium text-primary hover:underline">
              Go to dashboard
            </Link>
          </Rise>
        </Stagger>
      </PageShell>
    );
  }

  await joinClass({ classId: cls.id, studentId: profile.id });

  return (
    <PageShell size="focus" className="lg:py-24">
      <Stagger className="flex flex-col items-start gap-6">
        <Rise>
          <CircleCheck className="size-10 text-success" strokeWidth={1.75} aria-hidden />
        </Rise>
        <Rise>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl">
            You&apos;ve joined {cls.name}
          </h1>
        </Rise>
        <Rise>
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        </Rise>
      </Stagger>
    </PageShell>
  );
}
