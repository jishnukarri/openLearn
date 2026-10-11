import { requireSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId } from "@/lib/supabase/profiles";
import { roleHome } from "@/lib/roles";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/button";
import { BrandMark } from "@/components/brand-mark";
import { Rise, Stagger } from "@/components/motion";
import { Check, Hourglass, LayoutDashboard } from "lucide-react";

export default async function PendingApprovalPage() {
  const session = await requireSession();
  const profile = await getProfileByAppwriteId(session.userId);

  // If they've been approved (or are any other role), send them home.
  if (!profile || profile.role !== "pending_teacher") {
    redirect(roleHome(profile?.role));
  }

  const steps = [
    { Icon: Check, title: "Request received", body: "Your teacher account is set up and waiting.", state: "done" },
    { Icon: Hourglass, title: "Admin review", body: "An admin looks over your request.", state: "now" },
    { Icon: LayoutDashboard, title: "Teacher dashboard", body: "Once approved, you get access to it.", state: "next" },
  ] as const;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-6 py-12">
      <Stagger className="grid w-full gap-x-20 gap-y-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex flex-col items-start gap-6">
          <Rise>
            <BrandMark size={44} />
          </Rise>
          <Rise>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-foreground lg:text-5xl lg:leading-[1.1]">
              Waiting for approval
            </h1>
          </Rise>
          <Rise>
            <p className="max-w-[56ch] text-base text-muted">
              Your teacher account is pending admin review. You&apos;ll receive access once an admin approves your request. Check back soon.
            </p>
          </Rise>
          <Rise>
            <form action={logout}>
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </Rise>
        </div>

        <Rise>
          <ol className="relative flex flex-col gap-9 py-2">
            <span aria-hidden className="absolute bottom-6 left-[19px] top-6 w-px bg-border" />
            {steps.map(({ Icon, title, body, state }) => (
              <li key={title} className="relative flex gap-5">
                <span
                  aria-hidden
                  className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border ${
                    state === "done"
                      ? "border-primary bg-primary text-white"
                      : state === "now"
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted"
                  }`}
                >
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <div className="pt-1.5">
                  <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                    {title}
                  </p>
                  <p className="mt-1 max-w-[40ch] text-sm text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Rise>
      </Stagger>
    </main>
  );
}
