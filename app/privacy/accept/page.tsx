import { redirect } from "next/navigation";
import { getSession } from "@/lib/appwrite/session";
import { getProfileByAppwriteId, getPrivacyAckVersion } from "@/lib/supabase/profiles";
import { privacyAcknowledged } from "@/lib/privacy";
import { roleHome } from "@/lib/roles";
import { acceptPrivacyAction } from "@/app/actions/privacy";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Button } from "@/components/button";

export default async function AcceptPrivacyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await getProfileByAppwriteId(session.userId);
  if (!profile) redirect("/login");
  const stored = await getPrivacyAckVersion(profile.id);
  if (profile.role !== "student" || stored === "unavailable" || privacyAcknowledged(stored)) {
    redirect(roleHome(profile.role));
  }

  return (
    <PageShell size="focus">
      <PageHeader title="Before you start" description="A quick look at how this platform uses your information." />
      <div className="flex flex-col gap-4">
        <ul className="flex max-w-[65ch] list-disc flex-col gap-2 pl-5 text-base leading-relaxed text-foreground">
          <li>We keep your name, email and study progress so your lessons and marks work.</li>
          <li>What you type to the study coach, and photos you upload for marking, go to AI services. Your name and email do not.</li>
          <li>You can download your data or delete your account at any time from Account settings.</li>
        </ul>
        <p className="text-sm text-muted">
          The full details are in the{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">privacy notice</a>.
        </p>
        <form action={acceptPrivacyAction}>
          <Button type="submit">I have read this, continue</Button>
        </form>
      </div>
    </PageShell>
  );
}
