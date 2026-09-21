import { requireSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { roleHome } from "@/lib/roles";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/button";

export default async function PendingApprovalPage() {
  const session = await requireSession();
  const profile = await getProfileByAppwriteId(session.userId);

  // If they've been approved (or are any other role), send them home.
  if (!profile || profile.role !== "pending_teacher") {
    redirect(roleHome(profile?.role));
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl">⏳</span>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
            Waiting for approval
          </h1>
          <p className="text-sm text-muted">
            Your teacher account is pending admin review. You&apos;ll receive access once an admin approves your request. Check back soon.
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
