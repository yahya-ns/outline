# Use Yjs (via Hocuspocus) for collaborative editing

## Prerequisites

Architecture decision record.

## Status

Accepted (2024-01-01, the date Outline adopted the Yjs-based editor).

## Context

Outline's editor is collaborative. Multiple users in the same document see each other's cursors, edits, and selections within roughly 100 ms. The persistence layer must be durable so the document survives server restarts and tab reloads. Conflict resolution must be automatic — there is no "your edit vs mine" choice for the user.

Two technical consequences fall out of these requirements:

- The transport is a CRDT, not an operational transform. Operations merge without a central ordering authority, so the server can be unreachable for short windows without losing work.
- The state representation is binary and grows monotonically with edit history. The server persists the whole document on every flush rather than replaying individual operations.

The ProseMirror schema is defined in `shared/editor/lib/ExtensionManager.ts` and consumed unchanged by the React app and by the server-side editor helper. Any CRDT binding must integrate with that schema without forking it.

## Decision

Use [Yjs](https://github.com/yjs/yjs) as the document state. Yjs is a CRDT library whose `Y.Doc` is the single source of truth for a document's content.

- Transport: [Hocuspocus](https://tiptap.dev/docs/hocuspocus/introduction) is the WebSocket server. It implements the y-protocols sync and awareness messages and exposes a small extension surface for persistence, authentication, throttling, and the editor-version check.
- Binding: [y-prosemirror](https://github.com/yjs/y-prosemirror) wires the `Y.Doc` into the ProseMirror schema so that ProseMirror transactions become Yjs updates and vice versa. The client registers `ySyncPlugin`, `yCursorPlugin`, and `yUndoPlugin` (see `app/editor/extensions/Multiplayer.ts`).
- Persistence: the server-side `PersistenceExtension` (`server/collaboration/PersistenceExtension.ts`) hooks `onStoreDocument` (debounced 3 s server-side in `server/services/collaboration.ts`) and writes the full Yjs `state` BLOB into the `Document.state` column. The BLOB is the durable record of the document; the ProseMirror JSON `content` column is derived from it.

The `Y.Doc` is also kept locally via `IndexeddbPersistence` so the document is readable while the server is unreachable. Awareness — the presence protocol for cursors and selections — is built into Yjs and surfaced on the client through `DocumentPresenceStore`.

Two `patch-package` patches are required to keep `y-prosemirror` and its transitive `prosemirror-math` dependency working with the current ProseMirror types:

- `patches/y-prosemirror+1.3.7.patch` backports `restoreRelativeSelection`, `getRelativeSelection`, and `relativePositionStore` from PR #182 so `CellSelection` and other custom selection types round-trip through Yjs.
- `patches/@benrbray+prosemirror-math+0.2.2.patch` fixes the `katex.ParseError` import path: the upstream uses a named export, but the bundled `katex` only exposes the namespace.

## Consequences

- (+) Automatic conflict resolution. Two clients typing in the same paragraph merge cleanly; no merge UI is needed and no edit is ever rejected as conflicting.
- (+) Offline-first via `IndexeddbPersistence`. A returning tab loads the last seen Yjs state from IndexedDB before the WebSocket connects, so reads are instant and writes queue until the connection reopens.
- (+) Awareness is built-in. Cursors, selections, names, colours, and scroll positions flow over the same WebSocket without a second channel.
- (+) The persistence seam is the `PersistenceExtension.onStoreDocument` hook, which delegates to the `documentCollaborativeUpdater` command. The command writes the `state` BLOB and emits the `documents.update` event that drives revisions, search indexing, and backlinks.
- (-) The `Document.state` BLOB is large. Yjs state grows with edit history because it carries tombstones for deleted content. A performance optimisation in `BACKEND.md` notes that incremental Yjs update messages would shrink the BLOB; today the full state is written on every flush.
- (-) `EDITOR_VERSION` mismatch (declared in `shared/editor/version.ts` and surfaced as close code 4999 in `shared/collaboration/CloseEvents.ts`) requires the editor to go read-only. The user sees a banner asking for a manual reload — the editor never auto-reloads to avoid clobbering concurrent edits. See `docs/EDITOR.md`.
- (-) Two patches must be carried forward through every `yarn install`. Removing them requires upstream fixes; until then, `patch-package` runs in `postinstall`.
- (-) Browser support inherits Yjs's requirements (modern WebSocket, `ArrayBuffer`, IndexedDB). The browserslist in `package.json` excludes browsers that cannot meet these.

## Alternatives considered

- **Operational Transformation (ShareDB, OT.js).** Older model; requires a central server to order operations, so the server is a hard dependency and offline edits are harder. The ecosystem is also smaller and less active than Yjs.
- **Custom CRDT.** Too much work for a knowledge-base product. Yjs is well-tested in production and its data model maps cleanly onto ProseMirror's tree-shaped schema.
- **Lock-based concurrency.** Bad UX. Users would block each other on every edit, and the round-trip latency would visibly degrade even for non-overlapping edits.

The Yjs + Hocuspocus combination was selected because it is the only option that delivers automatic conflict resolution, offline-first reads, presence, and a ProseMirror binding without requiring Outline to maintain CRDT internals.