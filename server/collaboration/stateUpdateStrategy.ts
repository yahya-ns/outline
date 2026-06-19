/**
 * Strategy for persisting Y.js document state as incremental update messages
 * rather than a single full-state BLOB per write.
 *
 * @status scaffold - not production ready, see `.slim/deepwork/outline-improvements.md` Phase 3 #15.
 *
 * Strategy:
 * - `Document.state` is currently a Y.js BLOB that grows linearly with edit history.
 *   For 10k+ block documents, this is the dominant write cost on every keystroke.
 * - The proposed strategy:
 *   1. Persist `Document.state` as a series of incremental Y.js update messages
 *      (an append-only log) rather than a full BLOB per write.
 *   2. On document open, replay the log to reconstruct the full state.
 *   3. Periodically compact the log into a fresh BLOB (e.g., when it exceeds N entries).
 *
 * The scaffold defines the module surface; the follow-up updates `PersistenceExtension` and
 * `documentCollaborativeUpdater` to use the new strategy behind a feature flag.
 *
 * @remarks SCAFFOLD: replace the throw bodies with real implementation. See `.slim/deepwork/outline-improvements.md` Phase 3 #15.
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
 * Append a single Y.js update message to the per-document update log.
 *
 * @param _log The current log for the document. The new entry is appended in-place.
 * @param _entry The update to persist, with a monotonically increasing version.
 * @returns Promise that resolves once the row is committed.
 *
 * @remarks SCAFFOLD: real implementation appends the update to a
 * `document_state_updates` table (one row per Y.js update message, partitioned
 * by `documentId`). Concurrency is handled with `SELECT ... FOR UPDATE` on the
 * parent `Document` row to assign the next version number atomically.
 */
export async function persistUpdate(
  _log: StateUpdateLog,
  _entry: UpdateEntry
): Promise<void> {
  throw new Error("Not implemented: persistUpdate");
}

/**
 * Load and replay a document's update log to reconstruct its full Y.js state.
 *
 * @param _documentId The document whose log should be replayed.
 * @returns The merged Y.js state bytes (equivalent to `Y.encodeStateAsUpdate`).
 *
 * @remarks SCAFFOLD: real implementation loads the update log, replays the
 * entries in `version` order against a fresh `Y.Doc`, and returns the merged
 * state. If a compacted snapshot exists, replay resumes from the snapshot and
 * only entries newer than the snapshot are applied.
 */
export async function loadAndReplay(_documentId: string): Promise<Uint8Array> {
  throw new Error("Not implemented: loadAndReplay");
}

/**
 * Decide whether the update log is large enough to warrant compaction.
 *
 * @param _log The current log for the document.
 * @returns True if `compact(...)` should run, false otherwise.
 *
 * @remarks SCAFFOLD: real implementation returns true when the log exceeds
 * either a row-count threshold (e.g. >100 entries) or a byte-size threshold
 * (e.g. >1MB). The actual compaction step is `compact(...)` below.
 */
export async function maybeCompact(_log: StateUpdateLog): Promise<boolean> {
  throw new Error("Not implemented: maybeCompact");
}

/**
 * Compact a document's update log into a single fresh BLOB entry.
 *
 * @param _documentId The document whose log should be compacted.
 * @returns The compacted log containing a single entry with a fresh snapshot.
 *
 * @remarks SCAFFOLD: real implementation replays the current log against a
 * fresh `Y.Doc`, encodes it as a single snapshot via `Y.encodeStateAsUpdate`,
 * replaces the existing log with a single entry holding that snapshot, and
 * runs in a transaction so readers never observe an empty log.
 */
export async function compact(_documentId: string): Promise<StateUpdateLog> {
  throw new Error("Not implemented: compact");
}
