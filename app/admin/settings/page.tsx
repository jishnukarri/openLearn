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

export default async function AdminSettingsPage() {
  const provider = process.env.AI_PROVIDER ?? "ollama";
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  const modelConfig = MODEL_ENV[provider] ?? MODEL_ENV.ollama;
  const model = process.env[modelConfig.env] || modelConfig.fallback;
  const status = provider === "ollama" ? await getOllamaStatus(host) : null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          AI settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Platform default provider, used for every AI request except a
          teacher's own generation, if they've saved a personal key under
          their account (<code className="font-[family-name:var(--font-mono)]">/teacher/settings</code>).
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Provider</span>
          <span className="text-sm text-foreground">
            {PROVIDER_LABELS[provider] ?? provider}
          </span>
        </div>
        {status && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted">Status</span>
            <span
              className={`flex items-center gap-1.5 text-sm ${
                status.ok ? "text-success" : "text-error"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  status.ok ? "bg-success" : "bg-error"
                }`}
              />
              {status.ok ? `Running (v${status.version})` : "Not reachable"}
            </span>
          </div>
        )}
        {provider === "ollama" && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted">Host</span>
            <span className="font-[family-name:var(--font-mono)] text-xs text-foreground">
              {host}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted">Model</span>
          <span className="font-[family-name:var(--font-mono)] text-xs text-foreground">
            {model}
          </span>
        </div>
        {status && !status.ok && (
          <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error">
            Ollama isn&apos;t responding. It doesn&apos;t run as a system
            service in this environment, run{" "}
            <code className="font-[family-name:var(--font-mono)]">
              scripts/start-ollama.sh
            </code>{" "}
            to bring it back up. All AI generation (topics, lessons,
            questions, marking) will fail until it&apos;s running.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground">
          Change provider or model
        </h2>
        <p className="text-xs text-muted">
          Admin AI config is env-only, not editable here, set these in{" "}
          <code className="font-[family-name:var(--font-mono)]">.env.local</code>{" "}
          and restart the app:
        </p>
        <ul className="flex flex-col gap-1 text-xs text-muted">
          <li>
            <code className="font-[family-name:var(--font-mono)] text-foreground">AI_PROVIDER</code>{" "}
           , <code className="font-[family-name:var(--font-mono)]">ollama</code> |{" "}
            <code className="font-[family-name:var(--font-mono)]">openrouter</code> |{" "}
            <code className="font-[family-name:var(--font-mono)]">hackclub</code> |{" "}
            <code className="font-[family-name:var(--font-mono)]">gemini</code>
          </li>
          <li>
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              OLLAMA_HOST
            </code>{" "}
            /{" "}
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              OLLAMA_MODEL
            </code>
          </li>
          <li>
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              OPENROUTER_API_KEY
            </code>{" "}
            /{" "}
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              OPENROUTER_MODEL
            </code>
          </li>
          <li>
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              HACKCLUB_API_KEY
            </code>{" "}
            /{" "}
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              HACKCLUB_MODEL
            </code>
          </li>
          <li>
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              GEMINI_API_KEY
            </code>{" "}
            /{" "}
            <code className="font-[family-name:var(--font-mono)] text-foreground">
              GEMINI_MODEL
            </code>
          </li>
        </ul>
        <p className="text-2xs text-muted">
          Teachers get a per-user key instead, see{" "}
          <code className="font-[family-name:var(--font-mono)]">/teacher/settings</code>.
          Admins don&apos;t, by design; the platform default above is what
          admin-triggered generation always uses.
        </p>
      </section>
    </main>
  );
}
