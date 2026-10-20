import { redirect } from "next/navigation";
import { getSession } from "@/lib/appwrite/session";
import { PageShell, PageHeader } from "@/components/page-shell";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/button";
import { PasswordForm } from "./password-form";

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  // Not requireSession: this page is the destination for flagged accounts.
  const session = await getSession();
  if (!session) redirect("/login");
  const { required } = await searchParams;
  const forced = session.mustChangePassword || required === "1";

  return (
    <PageShell size="focus">
      <PageHeader
        title={forced ? "Choose a new password" : "Change password"}
        description={
          forced
            ? "An administrator reset your password. Choose a new one to continue."
            : "You stay signed in on this device after changing it."
        }
      />
      <section className="flex max-w-md flex-col gap-5">
        <PasswordForm forced={forced} />
        {forced ? (
          <form action={logout}>
            <Button type="submit" variant="secondary" size="compact" className="min-h-11">
              Log out instead
            </Button>
          </form>
        ) : (
          <a href="/account" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Back to account settings
          </a>
        )}
      </section>
    </PageShell>
  );
}
