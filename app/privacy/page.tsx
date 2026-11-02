import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Privacy notice" };

const H2 = "font-[family-name:var(--font-display)] text-xl font-semibold text-foreground";
const P = "max-w-[65ch] text-base leading-relaxed text-foreground";
const LI = "max-w-[65ch] text-base leading-relaxed text-foreground";

// Plain-English notice for students (UK GDPR Articles 13 and 14). It describes
// what the app really does; change it whenever the data or the AI providers change.
export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <PageShell size="content">
      <PageHeader title="Privacy notice" description="What this platform keeps about you, why, and what you can do about it." />

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-2">
          <h2 className={H2}>Who runs this</h2>
          <p className={P}>
            Open Learn is a GCSE revision platform run by your school or teacher group (the &ldquo;controller&rdquo; of your data).
            {contact ? (
              <> Questions or requests: <a className="font-medium text-primary hover:underline" href={`mailto:${contact}`}>{contact}</a>.</>
            ) : (
              <> Ask your teacher or the platform administrator for anything in this notice.</>
            )}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={H2}>What we keep</h2>
          <ul className="list-disc pl-5">
            <li className={LI}>Your name, email address and role, and your password (stored only as a protected hash by our login provider).</li>
            <li className={LI}>Your learning record: subjects you study, lessons and topics completed, XP and streak, quick-check and practice answers, marks, and the ideas you tend to get wrong.</li>
            <li className={LI}>Photos of handwritten answers you choose to upload for marking.</li>
            <li className={LI}>Classes you join, and anything your teacher records about your class work.</li>
            <li className={LI}>Reports you send about a problem with lesson content.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={H2}>Why, and on what basis</h2>
          <p className={P}>
            To give you lessons, practice and marking, and to show your teacher how the class is doing. For a school this is normally
            the school&apos;s public task or legitimate interests, not your consent. We do not use your data for advertising and we do
            not sell it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={H2}>AI services</h2>
          <p className={P}>
            Lessons, hints, the study coach and marking are written by AI services run by other companies. When you use them, the
            text you type (such as a coach question or a practice answer), the lesson or question it relates to, and any photo you
            upload for marking are sent to the AI provider configured for the platform, and to the model companies behind it. Your name and email are not
            included in those requests. Please do not type personal details about yourself or others into the coach or an answer.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={H2}>Cookies and device storage</h2>
          <p className={P}>
            One cookie keeps you logged in. If you try the starter quiz before signing up, a second temporary cookie (two days) links you to that quiz. The site cannot work without them, so they are set without asking. Your browser also remembers
            display choices (light or dark theme, whether the study coach panel is open) on your own device. There are no advertising or
            tracking cookies.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={H2}>How long we keep it</h2>
          <p className={P}>
            Until you delete your account, or your school asks us to. Deleting your account removes your profile, your learning record
            and your uploaded answer photos. Copies in routine backups expire on the hosting provider&apos;s normal schedule.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={H2}>Your rights</h2>
          <p className={P}>
            You can see your data, get a copy, correct it, ask for it to be deleted, and object to how it is used. In your{" "}
            <a className="font-medium text-primary hover:underline" href="/account">account settings</a> you can{" "}
            <a className="font-medium text-primary hover:underline" href="/account/export">download your data</a>, change your name and
            delete your account. For anything else, contact the person named above. You can also complain to the Information
            Commissioner&apos;s Office (ico.org.uk).
          </p>
        </section>
      </div>
    </PageShell>
  );
}
