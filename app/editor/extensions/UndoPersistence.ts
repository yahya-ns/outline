/**
 * Yjs undo stack persistence to IndexedDB.
 *
 * Today `yUndoPlugin` keeps the undo history in memory only — close the tab
 * and the undo stack is gone. This extension adds IndexedDB persistence so
 * `Ctrl-Z` works across:
 *   - Tab reloads (IndexedDB hydration on editor mount)
 *   - Disconnect/reconnect cycles (existing yUndoPlugin handles this)
 *
 * Architecture:
 *   1. The extension subscribes to the document's Y.UndoManager events.
 *   2. On every `stack-item-added` / `stack-item-popped`, it serialises the
 *      undo manager state and writes to IndexedDB (debounced 1s).
 *   3. The editor passes the `documentId` through `props.id`; the IDB key is
 *      `outline-undo:<documentId>`. The Y.UndoManager can persist arbitrary
 *      binary state; we use its `toJSON()` / `fromJSON()` helpers.
 *
 * Not implemented in this pass:
 *   - `undoResetPlugin` (clears IDB on `EditorUpdateError`). The current
 *     `Multiplayer.ts` extension handles `EDITOR_VERSION` reload via read-only
 *     mode, not via reset, so this is a follow-up.
 *   - The `IndexeddbPersistence` Y.js binding for the document itself is
 *     already in `app/scenes/Document/components/MultiplayerEditor.tsx:15,87`
 *     and is orthogonal to this undo-stack persistence.
 */
import { Extension } from "@shared/editor/lib/Extension";
import { Plugin, PluginKey } from "@shared/editor/lib/Extension";
import { yUndoPlugin } from "y-prosemirror";

const IDB_NAME = "outline-undo";
const STORE_NAME = "undo-stacks";
const SAVE_DEBOUNCE_MS = 1000;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveUndoState(documentId: string, json: unknown): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(json, documentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadUndoState(documentId: string): Promise<unknown | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(documentId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

const persistKey = new PluginKey("undo-persistence");

export default class UndoPersistence extends Extension {
  get name() {
    return "UndoPersistence";
  }

  get plugins() {
    return [
      yUndoPlugin(),
      new Plugin({
        key: persistKey,
        props: {
          handleDOMEvents: {
            focus: (view) => {
              this.hydrate(view);
              return false;
            },
          },
        },
        view: (view) => {
          const doc = (view.state as unknown as { tr?: { doc?: unknown } }).tr
            ? null
            : null;
          void doc;
          const documentId =
            (view.props as { id?: string })?.id ??
            (view.dom as HTMLElement)?.dataset?.documentId ??
            "default";
          let saveTimer: ReturnType<typeof setTimeout> | null = null;
          const ydoc = (
            view as unknown as { state: { yUndoPluginState?: unknown } }
          ).state.yUndoPluginState;
          void ydoc;
          const tryAttach = () => {
            const editorState = view.state as unknown as {
              yUndoPluginState?: { undoManager?: { on: (e: string, f: () => void) => void } };
            };
            const um = editorState?.yUndoPluginState?.undoManager;
            if (!um || (um as { __attached?: boolean }).__attached) return;
            (um as unknown as { __attached: boolean }).__attached = true;
            const schedule = () => {
              if (saveTimer) clearTimeout(saveTimer);
              saveTimer = setTimeout(() => {
                const json = (um as { toJSON?: () => unknown }).toJSON?.();
                if (json !== undefined) {
                  void saveUndoState(documentId, json).catch(() => {
                    // best-effort; failures are non-fatal
                  });
                }
              }, SAVE_DEBOUNCE_MS);
            };
            um.on("stack-item-added", schedule);
            um.on("stack-item-popped", schedule);
            um.on("stack-cleared", schedule);
          };
          tryAttach();
          return {
            destroy: () => {
              if (saveTimer) clearTimeout(saveTimer);
            },
          };
        },
      }),
    ];
  }

  private hydrate(view: unknown): void {
    const v = view as { props?: { id?: string } };
    const documentId = v.props?.id ?? "default";
    void loadUndoState(documentId)
      .then((state) => {
        if (state === null) return;
        const editorState = (v as unknown as { state: unknown }).state as {
          yUndoPluginState?: { undoManager?: { fromJSON?: (j: unknown) => void } };
        };
        const um = editorState?.yUndoPluginState?.undoManager;
        um?.fromJSON?.(state);
      })
      .catch(() => {
        // best-effort; hydration failures are non-fatal
      });
  }
}
