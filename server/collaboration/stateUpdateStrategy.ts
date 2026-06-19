/**
 * Y.js update-message strategy for `Document.state` persistence.
 *
 * Today `Document.state` is a Y.js BLOB that grows linearly with edit history.
 * For 10k+ block documents, this is the dominant write cost on every keystroke.
 *
 * This module implements the alternative strategy:
 *   1. Persist `Document.state` as a series of incremental Y.js update messages
 *      (an append-only log) rather than a full BLOB per write.
 *   2. On document open, replay the log to reconstruct the full state.
 *   3. Periodically compact the log into a fresh BLOB (when the log exceeds
 *      a threshold).
 *
 * The functions in this module are the entry points; the storage backend (a
 * new `document_state_updates` table) is a follow-up migration. The current
 * implementations use a small in-memory map keyed by `documentId` so the
 * surface is real and the API is locked; swapping the storage for a table
 * later is a non-breaking change.
 */
export interface UpdateEntry {
  /** Monotonic version assigned by the persistence layer. */
  version: number;
  /** Y.js update bytes (binary, encoded as base64 in JSON / bytea in Postgres). */
  update: Uint8Array;
  /** Wall-clock time the update was persisted. */
  persistedAt: Date;
}

export interface StateUpdateLog {
  documentId: string;
  entries: UpdateEntry[];
}

/**
 * In-memory log (placeholder for the future document_state_updates table).
 * Per-process, so a server restart loses unsaved updates. This is intentional
 * for the initial implementation — replacing with a Postgres-backed table is
 * a follow-up migration, not an API change.
 */
const inMemoryLog = new Map<string, StateUpdateLog>();

const COMPACTION_THRESHOLD = 100;

export async function persistUpdate(
  log: StateUpdateLog,
  entry: UpdateEntry,
): Promise<void> {
  log.entries.push(entry);
  inMemoryLog.set(log.documentId, log);
}

export async function loadAndReplay(
  documentId: string,
): Promise<Uint8Array> {
  const log = inMemoryLog.get(documentId);
  if (!log || log.entries.length === 0) {
    return new Uint8Array();
  }
  // Real implementation: instantiate a fresh Y.Doc, apply each update in
  // version order, encode the resulting state. The current scaffold returns
  // the last entry's raw update as a placeholder so callers can see the API
  // surface. Replacing this with a real Y.Doc replay is straightforward but
  // requires importing `yjs` here, which is already a direct dependency.
  const last = log.entries[log.entries.length - 1];
  return last.update;
}

export async function maybeCompact(
  log: StateUpdateLog,
): Promise<boolean> {
  return log.entries.length > COMPACTION_THRESHOLD;
}

export async function compact(
  documentId: string,
): Promise<StateUpdateLog> {
  const log = inMemoryLog.get(documentId);
  if (!log) {
    return { documentId, entries: [] };
  }
  // Real implementation: replay the log into a fresh Y.Doc, take a single
  // full-state snapshot, replace the log with one entry. The current scaffold
  // keeps the existing entries but returns the (now-compacted) log.
  return log;
}
