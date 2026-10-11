import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

async function getOllamaStatus(host: string) {
  try {
    const res = await fetch(`${host}/api/version`, { cache: "no-store" });
    if (!res.ok) return { ok: false, version: null };
    const data = await res.json();
    return { ok: true, version: data.version as string };
  } catch {
    return { ok: false, version: null };
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Local Ollama",
  openrouter: "OpenRouter",
  hackclub: "Hack Club AI",
  gemini: "Google Gemini",
};

const MODEL_ENV: Record<string, { env: string; fallback: string }> = {
  gemini: { env: "GEMINI_MODEL", fallback: "gemini-2.5-flash" },
  openrouter: { env: "OPENROUTER_MODEL", fallback: "openai/gpt-4o-mini" },
  hackclub: { env: "HACKCLUB_MODEL", fallback: "qwen/qwen3-32b" },
  ollama: { env: "OLLAMA_MODEL", fallback: "qwen2.5:7b-instruct" },
};

const ENV_ROWS: { vars: string[] }[] = [
  { vars: ["OLLAMA_HOST", "OLLAMA_MODEL"] },
  { vars: ["OPENROUTER_API_KEY", "OPENROUTER_MODEL"] },
  { vars: ["HACKCLUB_API_KEY", "HACKCLUB_MODEL"] },
  { vars: ["GEMINI_API_KEY", "GEMINI_MODEL"] },
];

const MONO = "font-[family-name:var(--font-mono)]";

export default async function AdminSettingsPage() {
  const provider = process.env.AI_PROVIDER ?? "ollama";
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  const modelConfig = MODEL_ENV[provider] ?? MODEL_ENV.ollama;
  const model = process.env[modelConfig.env] || modelConfig.fallback;
  const status = provider === "ollama" ? await getOllamaStatus(host) : null;

  return (
    <PageShell
      size="wide"
      aside={
        <>
          <AsideBlock title="Current provider">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <dt>Provider</dt>
                <dd className="text-foreground">{PROVIDER_LABELS[provider] ?? provider}</dd>
              </div>
              {status && (
                <div className="flex items-center justify-between gap-3">
                  <dt>Status</dt>
                  <dd
                    className={`flex items-center gap-1.5 ${status.ok ? "text-success" : "text-error"}`}
                  >
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${status.ok ? "bg-success" : "bg-error"}`}
                    />
                    {status.ok ? `Running (v${status.version})` : "Not reachable"}
                  </dd>
                </div>
              )}
              {provider === "ollama" && (
                <div className="flex items-center justify-between gap-3">
                  <dt>Host</dt>
                  <dd className={`${MONO} break-all text-right text-foreground`}>{host}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt>Model</dt>
                <dd className={`${MONO} break-all text-right text-foreground`}>{model}</dd>
              </div>
            </dl>
          </AsideBlock>
          {status && !status.ok && (
            <AsideBlock title="Ollama is down">
              <p className="text-error">
                Ollama isn&apos;t responding. It doesn&apos;t run as a system service in this
                environment, run <code className={MONO}>scripts/start-ollama.sh</code> to bring it
                back up. All AI generation (topics, lessons, questions, marking) will fail until
                it&apos;s running.
              </p>
            </AsideBlock>
          )}
        </>
      }
    >
      <PageHeader
        title="AI settings"
        description={
          <>
            Platform default provider, used for every AI request except a teacher&apos;s own
            generation, if they&apos;ve saved a personal key under their account (
            <code className={MONO}>/teacher/settings</code>).
          </>
        }
      />

      <Stagger>
        <Rise className="flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            Change provider or model
          </h2>
          <p className="max-w-[65ch] text-sm text-muted">
            Admin AI config is env-only, not editable here, set these in{" "}
            <code className={MONO}>.env.local</code> and restart the app:
          </p>
          <ul className="flex flex-col divide-y divide-border border-y border-border text-sm text-muted">
            <li className="py-2.5">
              <code className={`${MONO} text-foreground`}>AI_PROVIDER</code>, one of{" "}
              {["ollama", "openrouter", "hackclub", "gemini"].map((p, i) => (
                <span key={p}>
                  {i > 0 && " | "}
                  <code className={MONO}>{p}</code>
                </span>
              ))}
            </li>
            {ENV_ROWS.map((row) => (
              <li key={row.vars[0]} className="py-2.5">
                {row.vars.map((v, i) => (
                  <span key={v}>
                    {i > 0 && " / "}
                    <code className={`${MONO} text-foreground`}>{v}</code>
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="max-w-[65ch] text-sm text-muted">
            Teachers get a per-user key instead, see <code className={MONO}>/teacher/settings</code>.
            Admins don&apos;t, by design; the platform default shown here is what admin-triggered
            generation always uses.
          </p>
        </Rise>
      </Stagger>
    </PageShell>
  );
}
