# Use Hocuspocus for the collaboration WebSocket server, not a custom Node WS server

## Prerequisites

Architecture decision record.

## Status

Accepted (2024-01-01).

## Context

Yjs needs a transport. The y-protocols messages — sync, awareness, and the custom broadcast frames — must run over a bidirectional channel that survives long-lived connections, scales across processes, and integrates with Outline's existing authentication and persistence story.

Two implementation paths were considered:

1. **Custom `ws` server.** A small Node `ws` server that parses the y-protocols frames, manages the document registry, and runs the persistence hook on debounced flushes. Estimated at two to three weeks of initial work plus ongoing maintenance: y-protocols version drift, awareness bookkeeping, reconnect handling, and per-document fan-out all live in Outline's tree.
2. **Hocuspocus.** A higher-level server that implements the y-protocols transport, debouncing, authentication, persistence hooks, and an extension system out of the box.

Hocuspocus is the Yjs ecosystem's reference server and is maintained by the same team that maintains the editor binding. It is widely deployed and integrates with the same `@hocuspocus/provider` client that Outline already uses on the frontend.

## Decision

Use Hocuspocus. The server is configured in `server/services/collaboration.ts` and registers the following extensions:

- `Redis` (`@hocuspocus/extension-redis`) — required for horizontal scaling; registered only when `REDIS_COLLABORATION_URL` is set.
- `Throttle` (`@hocuspocus/extension-throttle`) — rate limits WebSocket frames per connection; window and threshold come from `RATE_LIMITER_*` env vars.
- `ConnectionLimitExtension` (in-house) — caps concurrent connections per document.
- `EditorVersionExtension` (in-house) — compares `shared/editor/version.ts` against the client's version on connect and closes with code 4999 on mismatch.
- `AuthenticationExtension` (in-house) — validates the `collaborationToken` JWT before admitting a connection.
- `PersistenceExtension` (in-house) — implements `onStoreDocument` (debounced 3 s) and delegates to `server/commands/documentCollaborativeUpdater.ts`, which writes the Yjs `state` BLOB and emits the `documents.update` event.
- `APIUpdateExtension` (in-house) — handles server-pushed updates (e.g. when the API path mutates a document outside the collaboration session).
- `ViewsExtension` (in-house) — records `View` rows when a client opens a document.
- `LoggerExtension` (in-house) — structured logging around connect / disconnect / store events.
- `MetricsExtension` (in-house) — emits the queue-prefixed metrics consumed by the winston / Sentry pipeline.

Debounce is 3 s, idle timeout is 30 s, max debounce is 10 s. These values come from `server/services/collaboration.ts` and match the contract documented in `docs/BACKEND.md`.

## Consequences

- (+) Battle-tested. Hocuspocus has hundreds of production deployments and is the canonical Yjs server, so protocol quirks and edge cases are already handled.
- (+) The extension system is the seam where Outline's policy lives. `PersistenceExtension.onStoreDocument` is the single place where the Yjs BLOB becomes a Postgres write; without Hocuspocus, this code would be Outline's responsibility to keep correct against y-protocols changes.
- (+) Editor version check, authentication, throttling, and metrics all ship as either built-in or ecosystem extensions, so the in-house surface stays small.
- (+) Horizontal scaling via the `Redis` extension is one import away. Self-hosted installs with a single collaboration pod simply omit the env var and the extension is skipped.
- (-) Pinned to Hocuspocus's release cadence. Upgrades require testing the full extension chain — a regression in `Throttle`, for example, would surface as user-visible rate-limiting bugs.
- (-) Hocuspocus pins its own `y-prosemirror` version, which is older than what Outline would otherwise use. This is precisely why `patches/y-prosemirror+1.3.7.patch` exists: to backport `CellSelection` and related fixes from the unreleased upstream. Without Hocuspocus's pin, the patch would be unnecessary.
- (-) The extension chain must be reviewed on every dependency bump. Adding or removing an extension is a behavioural change, not a refactor.

## Alternatives considered

- **Custom `ws` server implementing y-protocols.** Two to three weeks of initial implementation, plus ongoing maintenance for protocol version drift, awareness bookkeeping, and reconnect handling. The amount of code is small but the surface area is wide; every edge case is a bug we own.
- **Liveblocks / Y-Sweet.** Managed, hosted CRDT services. Rejected because Outline is a self-hostable product and a managed service would force a cloud-only collaboration path.
- **Yjs over plain WebSocket via a small shim.** Considered for the simple case where the server only relays messages; rejected because we need the debounce, authentication, persistence hooks, and metrics that Hocuspocus already provides.

The decision is to take the dependency on Hocuspocus in exchange for not reimplementing the transport. The cost is two `patch-package` patches and the upgrade cadence; the benefit is that every y-protocols change is someone else's problem.