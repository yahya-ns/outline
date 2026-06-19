/**
 * @status scaffold - not production ready, see `.slim/deepwork/outline-improvements.md` Phase 3 #14.
 *
 * The extension adds three ProseMirror plugins:
 * 1. `undoPersistencePlugin` — subscribes to the Y.UndoManager's `stack-item-added` / `stack-item-popped`
 *    events and writes the current state of the undo stack to IndexedDB on every change (debounced 1s).
 * 2. `undoRestorePlugin` — on `MultiplayerEditor` mount, hydrates the undo stack from IndexedDB
 *    before the first Yjs sync completes, so Ctrl-Z immediately after open works.
 * 3. `undoResetPlugin` — clears IndexedDB on `EditorUpdateError` (stale schema) so a reload
 *    doesn't replay against a different doc version.
 *
 * The three plugins together make `Ctrl-Z` work across:
 *   - Tab reloads (IndexedDB hydration)
 *   - Disconnect/reconnect cycles (existing yUndoPlugin already handles this)
 *   - Schema upgrades (reset on EditorUpdateError)
 *
 * @remarks SCAFFOLD: replace the throw body in `get plugins()` with the three real plugins.
 * Until then, this extension must NOT be registered in `app/editor/extensions/index.ts`
 * (returning `[yUndoPlugin()]` would silently duplicate the registration already done by
 * `Multiplayer.ts:127`). The throw below is intentional.
 */
import { Extension } from "@shared/editor/lib/Extension";

export default class UndoPersistence extends Extension {
  get name() {
    return "UndoPersistence";
  }

  get plugins() {
    // SCAFFOLD: real implementation returns the three plugins listed in the file header.
    // Throwing prevents accidental registration. If you see this error at runtime,
    // either the extension was wired into `app/editor/extensions/index.ts` too early,
    // or someone is importing `UndoPersistence` directly.
    throw new Error("Not implemented: UndoPersistence plugins");
  }
}


  get plugins() {
    // SCAFFOLD: real implementation wraps yUndoPlugin with three ProseMirror plugins
    // that observe the Y.UndoManager and persist/restore the stack.
    return [yUndoPlugin()];
  }
}
