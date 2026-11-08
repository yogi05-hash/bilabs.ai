import { sb } from "@/lib/leads";
import type { Admin } from "@/lib/adminAuth";

/* Audit trail and settings.
 *
 * The audit log records who changed what, and is deliberately append-only from
 * the application's point of view — nothing in this codebase updates or
 * deletes a row in it. It stores the shape of a change, not its contents: a
 * note's text or an exported person's details are not copied in, because a log
 * of sensitive data is just a second place to leak it from.
 */

export type AuditAction =
  | "lead.status"
  | "lead.notes"
  | "lead.owner"
  | "lead.followup"
  | "lead.merge"
  | "lead.delete"
  | "lead.export"
  | "evaluation.retry"
  | "evaluation.status"
  | "followup.create"
  | "followup.complete"
  | "settings.update"
  | "admin.role"
  | "billing.reconcile"
  | "business.status"
  | "business.publish"
  | "business.recheck";

export async function audit(
  admin: Admin,
  action: AuditAction,
  target: { type: string; id: string } | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  await sb("bilabs_audit_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor: admin.email,
      role: admin.role,
      action,
      target_type: target?.type ?? null,
      target_id: target?.id ?? null,
      detail: detail ?? null,
    }),
  });
}

/* ------------------------------------------------------------ settings */

export type Settings = {
  /** Hashed IPs whose traffic is marked internal and kept out of metrics. */
  internalIpHashes: string[];
  /** Honour Do Not Track / Global Privacy Control by not recording at all. */
  respectDnt: boolean;
  /** Days after which raw visitor and event rows are purged. 0 = keep. */
  retentionDays: number;
  /** Who gets the operational alerts. */
  notify: {
    newLead: boolean;
    newCustomer: boolean;
    evaluationFailures: boolean;
    emailFailures: boolean;
    to: string;
  };
  /** How long after an evaluation a later payment is still credited to it. */
  attributionWindowDays: number;
};

export const DEFAULT_SETTINGS: Settings = {
  internalIpHashes: [],
  respectDnt: true,
  retentionDays: 0,
  notify: {
    newLead: true,
    newCustomer: true,
    evaluationFailures: true,
    emailFailures: true,
    to: "hello@bilabs.ai",
  },
  attributionWindowDays: 30,
};

const KEY = "dashboard";

export async function getSettings(): Promise<Settings> {
  const rows = await sb<{ value: Partial<Settings> }[]>(
    `bilabs_settings?key=eq.${KEY}&select=value&limit=1`,
  );
  const stored = rows?.[0]?.value ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    notify: { ...DEFAULT_SETTINGS.notify, ...(stored.notify ?? {}) },
  };
}

export async function saveSettings(admin: Admin, patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = {
    ...current,
    ...patch,
    notify: { ...current.notify, ...(patch.notify ?? {}) },
  };
  await sb("bilabs_settings", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({
      key: KEY,
      value: next,
      updated_at: new Date().toISOString(),
      updated_by: admin.email,
    }),
  });
  // keys only — a settings diff should not copy excluded IP hashes into the log
  await audit(admin, "settings.update", null, { keys: Object.keys(patch) });
  return next;
}

/* -------------------------------------------------------- email logging */

export async function logEmail(row: {
  contactId?: string | null;
  email: string | null;
  kind: string;
  subject?: string | null;
  resendId?: string | null;
  ok: boolean;
  error?: string | null;
}): Promise<void> {
  await sb("bilabs_email_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      contact_id: row.contactId ?? null,
      email: row.email,
      kind: row.kind,
      subject: row.subject ?? null,
      resend_id: row.resendId ?? null,
      status: row.ok ? "sent" : "failed",
      error: row.error ? String(row.error).slice(0, 400) : null,
    }),
  });
}
