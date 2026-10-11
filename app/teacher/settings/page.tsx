import { requireRole } from "@/lib/appwrite/session";
import { getTeacherAiSettings } from "@/lib/supabase/ai-settings";
import { saveTeacherAiSettingsAction, deleteTeacherAiSettingsAction } from "@/app/actions/ai-settings";
import { Button } from "@/components/button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";

export default async function TeacherAiSettingsPage() {
  const { profile } = await requireRole("teacher");
  const current = await getTeacherAiSettings(profile.id);

  const field =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="How your key is used">
            <p>
              When a key is saved, lessons, questions and marking triggered by your students use it
              instead of the platform default.
            </p>
            <p>Leave this unset and everything keeps using the platform&apos;s AI as normal.</p>
          </AsideBlock>
          <AsideBlock title="Providers">
            <p>Google Gemini, OpenRouter and Hack Club AI take an API key and an optional model name.</p>
            <p>Ollama is self-hosted, so it also needs the host address.</p>
          </AsideBlock>
          <AsideBlock title="Changing or removing">
            <p>To replace a saved key, enter a new one and save. Use Remove to go back to the platform default.</p>
          </AsideBlock>
        </>
      }
    >
      <PageHeader
        title="AI settings"
        description="Optional, bring your own API key so lessons, questions and marking triggered by your students use it instead of the platform default."
      />

      {current && (
        <div
          role="status"
          className="animate-fade-slide-up flex items-center justify-between gap-4 rounded-2xl border border-success/30 bg-success/10 p-4"
        >
          <div>
            <p className="text-base font-medium text-foreground">Using your own key</p>
            <p className="text-sm text-muted">
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

      <form action={saveTeacherAiSettingsAction} className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="provider" className="text-sm font-medium text-foreground">Provider</label>
          <select id="provider" name="provider" defaultValue={current?.provider ?? "gemini"} className={field}>
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="hackclub">Hack Club AI</option>
            <option value="ollama">Ollama (self-hosted)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="apiKey" className="text-sm font-medium text-foreground">API key</label>
          <input
            id="apiKey"
            name="apiKey"
            type="password"
            placeholder={current ? "Enter a new key to replace the saved one" : "sk-..."}
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model" className="text-sm font-medium text-foreground">
            Model <span className="text-muted">(optional)</span>
          </label>
          <input
            id="model"
            name="model"
            defaultValue={current?.model ?? ""}
            placeholder="e.g. gemini-2.5-flash, openai/gpt-4o-mini, qwen/qwen3-32b"
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="host" className="text-sm font-medium text-foreground">
            Host <span className="text-muted">(Ollama only)</span>
          </label>
          <input
            id="host"
            name="host"
            defaultValue={current?.host ?? ""}
            placeholder="http://your-ollama-host:11434"
            className={field}
          />
        </div>

        <Button type="submit" size="compact" className="self-start">
          Save
        </Button>
      </form>
    </PageShell>
  );
}
