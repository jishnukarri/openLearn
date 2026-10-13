"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/appwrite/session";
import { addBlocklistEntry, removeBlocklistEntry } from "@/lib/supabase/blocklist";
import { logAdminAction } from "@/lib/supabase/admin-audit";

export type BlocklistFormState = { ok: boolean; message: string } | undefined;

async function audit(adminId: string, targetId: string, action: string, reason: string) {
  try {
    await logAdminAction({ adminId, targetId, action, reason });
  } catch (err) {
    console.warn("[blocklist] audit log failed:", err);
  }
}

export async function addBlocklistEntryAction(
  _state: BlocklistFormState,
  formData: FormData
): Promise<BlocklistFormState> {
  const { profile } = await requireRole("admin");

  const kind = formData.get("kind");
  const pattern = String(formData.get("pattern") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);

  if (kind !== "email" && kind !== "name") {
    return { ok: false, message: "Choose whether to block an email or a name." };
  }
  if (pattern.length < 2 || pattern.length > 200) {
    return { ok: false, message: "Enter between 2 and 200 characters." };
  }
  if (kind === "email" && /\s/.test(pattern)) {
    return { ok: false, message: "Emails and domains can't contain spaces." };
  }

  try {
    const entry = await addBlocklistEntry({
      kind,
      pattern: kind === "email" ? pattern.toLowerCase() : pattern,
      note,
      createdBy: profile.id,
    });
    await audit(profile.id, entry.id, "blocklist_add", `${kind}: ${pattern}`);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") return { ok: false, message: "That is already on the blocklist." };
    return { ok: false, message: "Could not save. Has the blocklist migration been applied?" };
  }

  revalidatePath("/admin/blocklist");
  return { ok: true, message: "Added to the blocklist." };
}

export async function removeBlocklistEntryAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "");
  if (!id) return;
  await removeBlocklistEntry(id);
  await audit(profile.id, id, "blocklist_remove", label);
  revalidatePath("/admin/blocklist");
}
