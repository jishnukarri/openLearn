import { requireRole } from "@/lib/appwrite/session";
import { getTeacherAiSettings } from "@/lib/supabase/ai-settings";
import { saveTeacherAiSettingsAction, deleteTeacherAiSettingsAction } from "@/app/actions/ai-settings";
import { Button } from "@/components/button";

export default async function TeacherAiSettingsPage() {
  const { profile } = await requireRole("teacher");
  const current = await getTeacherAiSettings(profile.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          AI settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Optional, bring your own API key so lessons, questions and
          marking triggered by your students use it instead of the
          platform default. Leave this unset and everything just uses the
          platform&apos;s AI as normal.
        </p>
      </div>

      {current && (
        <div className="flex items-center justify-between rounded-2xl border border-success/30 bg-success/10 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Using your own key
            </p>
            <p className="text-xs text-muted">
              Provider: {current.provider}
              {current.model ? ` · Model: ${current.model}` : ""}
            </p>
          </div>
          <form action={deleteTeacherAiSettingsAction}>
            <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
              Remove
            </Button>
          </form>
        </div>
      )}

      <form
        action={saveTeacherAiSettingsAction}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Provider</label>
          <select
            name="provider"
            defaultValue={current?.provider ?? "gemini"}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="hackclub">Hack Club AI</option>
            <option value="ollama">Ollama (self-hosted)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">API key</label>
          <input
            name="apiKey"
            type="password"
            placeholder={current ? "Enter a new key to replace the saved one" : "sk-..."}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Model <span className="text-muted">(optional)</span>
          </label>
          <input
            name="model"
            defaultValue={current?.model ?? ""}
            placeholder="e.g. gemini-2.5-flash, openai/gpt-4o-mini, qwen/qwen3-32b"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Host <span className="text-muted">(Ollama only)</span>
          </label>
          <input
            name="host"
            defaultValue={current?.host ?? ""}
            placeholder="http://your-ollama-host:11434"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <Button type="submit" size="compact" className="self-start">
          Save
        </Button>
      </form>
    </main>
  );
}
