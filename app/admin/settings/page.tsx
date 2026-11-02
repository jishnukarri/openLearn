import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { requireRole } from "@/lib/appwrite/session";
import { platformDefault, providerOrder } from "@/lib/ai/client";
import { cheapModel, cheapProvider, CHEAP_DEFAULT_MODEL } from "@/lib/ai/cheap-model";

const MONO = "font-[family-name:var(--font-mono)]";

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: "OpenRouter",
  hackclub: "Hack Club AI",
};

type Row = { role: string; used: string; env: string; value: string; note?: string };

// Reads the live process environment. Values are read-only here: changing
// them means editing .env.local and restarting the server.
function currentRows(): Row[] {
  const base = platformDefault();
  const env = process.env;
  return [
    { role: "Study coach chat and other general calls", used: "Every chat turn, topics, diagnostics, marking", env: "HACKCLUB_MODEL", value: base.model ?? "" },
    { role: "Lesson and exam-question writing", used: "Written once, then shared", env: "HACKCLUB_GEN_MODEL", value: env.HACKCLUB_GEN_MODEL || `${base.model ?? ""} (same as chat)` },
    { role: "Exam-question hints", used: "Hint button on practice questions", env: "HINT_MODEL", value: env.HINT_MODEL || `${cheapModel()} (scene model)` },
    { role: "Animated worked-example scenes", used: "Generated with each lesson", env: "SCENE_MODEL", value: `${cheapModel()}${env.SCENE_MODEL ? "" : ` (default ${CHEAP_DEFAULT_MODEL})`}`, note: `via ${PROVIDER_LABELS[cheapProvider()]}` },
    { role: "Lesson images", used: "Only generated when they will be shown", env: "HACKCLUB_IMAGE_MODEL", value: env.HACKCLUB_IMAGE_MODEL || "google/gemini-3.1-flash-lite-image (default)" },
    { role: "Reading scanned papers", used: "Paper marking and extraction", env: "HACKCLUB_VISION_MODEL", value: env.HACKCLUB_VISION_MODEL || "google/gemini-2.5-flash (default)" },
  ];
}

function keyStatus(): { name: string; set: boolean }[] {
  return ["HACKCLUB_API_KEY", "OPENROUTER_API_KEY"].map((name) => ({ name, set: !!process.env[name] }));
}

export default async function AdminSettingsPage() {
  await requireRole("admin");
  const base = platformDefault();
  const rows = currentRows();
  const keys = keyStatus();
  const order = providerOrder();
  const fallback = order[1];
  const activeKey = base.provider === "openrouter" ? "OPENROUTER_API_KEY" : "HACKCLUB_API_KEY";
  const activeKeySet = keys.find((k) => k.name === activeKey)?.set ?? false;

  return (
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="Active provider">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <dt>Provider</dt>
                <dd className="text-foreground">{PROVIDER_LABELS[base.provider]}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Fallback</dt>
                <dd className={fallback ? "text-foreground" : "text-error"}>{fallback ? PROVIDER_LABELS[fallback] : "None (no second key)"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>API key</dt>
                <dd className={activeKeySet ? "text-success" : "text-error"}>{activeKeySet ? "Set" : "Missing"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Usage logging</dt>
                <dd className="text-foreground">{process.env.AI_LOG_USAGE ? "On" : "Off"}</dd>
              </div>
            </dl>
          </AsideBlock>
          <AsideBlock title="Changing anything">
            <p>
              These are read from the server&apos;s environment. Edit <code className={MONO}>.env.local</code> and
              restart the server; this page then shows the new values.
            </p>
            <p>Teachers and students cannot see or change AI settings.</p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title="AI settings"
        description="The live AI configuration for the whole platform. Read-only: set it in the environment and restart."
      />

      <Stagger>
        <Rise className="flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Which model does what</h2>
          <ul className="flex flex-col divide-y divide-border border-y border-border text-sm">
            {rows.map((r) => (
              <li key={r.env} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{r.role}</span>
                  <code className={`${MONO} break-all text-foreground`}>{r.value}</code>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-muted">
                  <span>{r.used}{r.note ? `. ${r.note}` : ""}</span>
                  <code className={MONO}>{r.env}</code>
                </div>
              </li>
            ))}
          </ul>
        </Rise>

        <Rise className="mt-8 flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Keys on this server</h2>
          <p className="max-w-[65ch] text-sm text-muted">Only whether a key exists is shown, never its value.</p>
          <ul className="flex flex-col divide-y divide-border border-y border-border text-sm">
            {keys.map((k) => (
              <li key={k.name} className="flex items-center justify-between gap-3 py-2.5">
                <code className={`${MONO} text-foreground`}>{k.name}</code>
                <span className={k.set ? "text-success" : "text-muted"}>{k.set ? "Set" : "Not set"}</span>
              </li>
            ))}
          </ul>
          <p className="max-w-[65ch] text-sm text-muted">
            Hack Club AI is tried first and OpenRouter takes over automatically if it fails, using the same models.
            Set <code className={MONO}>AI_PROVIDER=openrouter</code> to swap the order.
          </p>
        </Rise>
      </Stagger>
    </PageShell>
  );
}
