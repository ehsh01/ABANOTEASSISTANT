import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { noteGenerationAuditTable, type InsertNoteGenerationAudit } from "@workspace/db/schema";

/** Stable SHA-256 of the generation context so identical inputs are traceable across attempts. */
export function hashNoteGenerationContext(ctx: unknown): string {
  return createHash("sha256").update(JSON.stringify(ctx)).digest("hex");
}

/**
 * Best-effort append to `note_generation_audit`. Audit persistence must never block or fail the
 * note-generation response, so all errors are logged and swallowed.
 */
export async function writeNoteGenerationAudit(entry: InsertNoteGenerationAudit): Promise<void> {
  try {
    await db.insert(noteGenerationAuditTable).values(entry);
  } catch (err) {
    console.error(
      `[notes/generate] audit write failed (status=${entry.finalStatus} clientId=${entry.clientId}):`,
      err,
    );
  }
}
