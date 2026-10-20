"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/components/motion";
import { Button } from "@/components/button";
import {
  markEmailVerified,
  resetPassword,
  setAccountBlocked,
  signOutEverywhere,
  type SupportResult,
} from "@/app/actions/admin-support";

type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  created_at: string;
};

type ActionKey = "reset" | "signout" | "block" | "unblock" | "verify";

const ACTIONS: Record<
  ActionKey,
  { button: string; title: string; explain: string; confirm: string; pending: string }
> = {
  reset: {
    button: "Reset password",
    title: "Reset this student's password?",
    explain:
      "A new temporary password is created and shown to you once. Every device is signed out. The student must sign in with it, then choose a new password before doing anything else. They cannot reuse the temporary one.",
    confirm: "Reset password",
    pending: "Resetting password…",
  },
  signout: {
    button: "Sign out everywhere",
    title: "Sign this account out of every device?",
    explain: "Every active session ends. The student can sign in again with their current password.",
    confirm: "Sign out everywhere",
    pending: "Signing out devices…",
  },
  block: {
    button: "Block account",
    title: "Block this account?",
    explain: "The student is signed out and cannot sign in until you unblock the account. Their data is kept.",
    confirm: "Block account",
    pending: "Blocking account…",
  },
  unblock: {
    button: "Unblock account",
    title: "Unblock this account?",
    explain: "The student will be able to sign in again.",
    confirm: "Unblock account",
    pending: "Unblocking account…",
  },
  verify: {
    button: "Mark email verified",
    title: "Mark this email as verified?",
    explain: "Use this when the student cannot receive the verification email. Only do it after confirming who they are.",
    confirm: "Mark verified",
    pending: "Marking email verified…",
  },
};

const ACTION_LABELS: Record<string, string> = {
  reset_password: "Password reset (student must choose a new password at next login)",
  sign_out_everywhere: "Signed out everywhere",
  block_account: "Account blocked",
  unblock_account: "Account unblocked",
  mark_email_verified: "Email marked verified",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SupportPanel({
  profileId,
  email,
  blocked = false,
  audit,
}: {
  profileId: string;
  email: string;
  blocked?: boolean;
  audit: AuditEntry[];
}) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isBlocked, setIsBlocked] = useState(blocked);
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<ActionKey | null>(null);
  const reduce = useReducedMotion();
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  function openDialog(key: ActionKey) {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setReason("");
    setFormError(null);
    setOpen(key);
  }

  function closeDialog() {
    if (pending) return;
    setOpen(null);
    triggerRef.current?.focus();
  }

  // Focus the reason field on open; trap Tab; close on Escape.
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    el?.querySelector<HTMLElement>("textarea")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDialog();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const f = Array.from(
        el.querySelectorAll<HTMLElement>("button:not([disabled]), textarea, [href]")
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  function confirm() {
    if (!open) return;
    const key = open;
    if (!reason.trim()) {
      setFormError("Add a reason so this can be recorded.");
      return;
    }
    setFormError(null);
    setPendingKey(key);
    startTransition(async () => {
      let result: SupportResult;
      try {
        if (key === "reset") result = await resetPassword(profileId, reason);
        else if (key === "signout") result = await signOutEverywhere(profileId, reason);
        else if (key === "block") result = await setAccountBlocked(profileId, true, reason);
        else if (key === "unblock") result = await setAccountBlocked(profileId, false, reason);
        else result = await markEmailVerified(profileId, reason);
      } catch {
        result = { ok: false, error: "Something went wrong. Nothing was changed." };
      }
      setPendingKey(null);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      if (key === "block") setIsBlocked(true);
      if (key === "unblock") setIsBlocked(false);
      setTempPassword(result.tempPassword ?? null);
      setCopied(false);
      setStatus({ ok: true, text: result.message });
      setOpen(null);
    });
  }

  async function copyPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
    } catch {
      setStatus({ ok: false, text: "Could not copy. Select the password and copy it by hand." });
    }
  }

  const cfg = open ? ACTIONS[open] : null;
  const dur = reduce ? 0 : 0.2;
  const buttons: ActionKey[] = ["reset", "signout", isBlocked ? "unblock" : "block", "verify"];

  return (
    <section aria-labelledby="support-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="support-heading" className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          Support actions
        </h2>
        <p className="text-sm text-muted">
          For {email}. Each action needs a reason and is recorded.
          {isBlocked ? " This account is currently blocked." : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {buttons.map((k) => (
          <Button
            key={k}
            type="button"
            variant="secondary"
            size="compact"
            className="!shadow-none"
            disabled={pending}
            onClick={() => openDialog(k)}
          >
            {ACTIONS[k].button}
          </Button>
        ))}
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        {pending && pendingKey && <p className="text-sm text-muted">{ACTIONS[pendingKey].pending}</p>}
        {status && !pending && (
          <p className={`text-sm ${status.ok ? "text-foreground" : "text-red-600"}`}>{status.text}</p>
        )}
      </div>

      {tempPassword && (
        <div className="flex flex-col gap-2 rounded-lg border border-highlight/40 bg-highlight/10 p-4">
          <p className="text-sm font-medium text-foreground">Temporary password (shown once)</p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-md bg-background px-3 py-2 font-[family-name:var(--font-mono)] text-base tracking-wider text-foreground select-all">
              {tempPassword}
            </code>
            <Button type="button" variant="secondary" size="compact" className="!shadow-none" onClick={copyPassword}>
              {copied ? "Copied" : "Copy password"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              className="!shadow-none"
              onClick={() => setTempPassword(null)}
            >
              Hide
            </Button>
          </div>
          <p className="text-sm text-muted">
            It will not be shown again. At next login the student must choose a new password and cannot reuse this one.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Recent support activity</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-muted">No support actions recorded for this account.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className="font-medium text-foreground">
                  {ACTION_LABELS[a.action] ?? a.action}
                  <span className="ml-2 font-normal text-muted">{formatWhen(a.created_at)}</span>
                </span>
                {a.reason && <span className="text-muted">{a.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {open && cfg && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur, ease: EASE_OUT }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeDialog();
            }}
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
              initial={{ opacity: 0, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : 8 }}
              transition={{ duration: dur, ease: EASE_OUT }}
            >
              <h3 id={titleId} className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                {cfg.title}
              </h3>
              <p id={descId} className="text-sm text-muted">
                {cfg.explain}
              </p>
              <label className="flex flex-col gap-1 text-sm text-foreground">
                Reason (recorded in the audit log)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  disabled={pending}
                  aria-invalid={formError ? true : undefined}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              {formError && (
                <p role="alert" className="text-sm text-red-600">
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="!shadow-none"
                  disabled={pending}
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button type="button" size="compact" className="!shadow-none" disabled={pending} onClick={confirm}>
                  {pending ? cfg.pending : cfg.confirm}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
