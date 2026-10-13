import "server-only";
import { db } from "./database-client";

export type AdminAuditEntry = {
  id: string;
  admin_id: string | null;
  target_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
};

export async function logAdminAction(entry: {
  adminId: string;
  targetId: string;
  action: string;
  reason: string;
}): Promise<void> {
  const { error } = await db.from("admin_audit_log").insert({
    admin_id: entry.adminId,
    target_id: entry.targetId,
    action: entry.action,
    reason: entry.reason,
  });
  if (error) throw error;
}

export async function listAuditForTarget(targetId: string, limit = 20): Promise<AdminAuditEntry[]> {
  const { data, error } = await db
    .from("admin_audit_log")
    .select("id, admin_id, target_id, action, reason, created_at")
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AdminAuditEntry[];
}
