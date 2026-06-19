# Glossary

## Prerequisites

Outline terminology used throughout the developer docs and the codebase.

---

This glossary covers project-specific and library terms that recur across [BACKEND.md](BACKEND.md), [FRONTEND.md](FRONTEND.md), [EDITOR.md](EDITOR.md), and the rest of the `docs/` folder but are never explained inline. Each entry is one short paragraph; follow the cross-link at the end of an entry for the full treatment.

## AsyncLocalStorage

A Node API for storing request-scoped context without threading it through every function call. The `server/middlewares/requestContext.ts` middleware uses it to underpin `ctx.context`, and a second instance in `server/storage/database.ts` records connection state so that background work can detect a "socket destroyed" event and abort early.

## cancan

The in-tree authorization engine used by the server's policies layer. It is a TypeScript fork of Ryan Bigg's original [cancan](https://www.npmjs.com/package/cancan) Ruby gem (MIT). Policy files under `server/policies/` call `allow(actor, action, target, condition?)`; the engine may return `true`, `false`, or a `string[]` of membership IDs that the client uses to gate UI affordances.

## fractional-index

A string-based ordering scheme used for collections, documents, and other sortable lists. It replaces integer indexes by encoding position as a short string, so inserting between two items only requires generating a new key between the neighbours — no rewriting of subsequent rows. See the `fractional-index` dependency in `package.json`.

## Hocuspocus

The Yjs WebSocket server that powers collaborative editing. The `collaboration` service in `server/services/index.ts` boots a Hocuspocus instance on `/collaboration`, configured with extensions for auth, persistence, throttling, and metrics. `patches/y-prosemirror+1.3.7.patch` backports `CellSelection` support into `y-prosemirror`.

## MobX

The state-management library used by the React frontend (v4). Stores in `app/stores/` annotate classes with `observable`, `action`, and `computed`; models in `app/models/` are observable objects with lifecycle hooks. `RootStore` registers every per-model store and is injected via the `mobx-react` `Provider` in `app/index.tsx`.

## Nanoid

The ID generator used throughout the project. It produces short, URL-safe random IDs and is the source of primary keys on most models as well as the short tokens embedded in share links.

## PGSSLMODE

The standard PostgreSQL environment variable that controls SSL mode for the database connection (`disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`). The Sequelize config in `server/config/database.js` derives its SSL settings from `PGSSLMODE` when it is set.

## ProseMirror

The schema + state + view library that forms the core of the rich-text editor. Outline assembles a ProseMirror schema through the extension managers in `shared/editor/lib/ExtensionManager.ts`, runs it inside the `Editor` class in `app/editor/index.tsx`, and renders it on the server via `server/editor/`. See [EDITOR.md](EDITOR.md) for the full architecture.

## prosemirror-changeset

The upstream library that ProseMirror uses to describe a transformation from one document to another. A vendored copy lives under `shared/editor/lib/prosemirror-recreate-transform/`; the editor uses it via `ChangesetHelper` to compute diffs across remote-only changes when no local transaction is available.

## throng

The Node library that `server/index.ts` uses to fork one worker process per CPU after the master has run migrations and telemetry. It accepts a `WORKERS` count and a `lifecycle` function that boots the requested services for each fork.

## Umzug

The migration runner wired into server startup. `server/storage/database.ts` configures an Umzug instance over the Sequelize CLI migration folder and auto-executes pending migrations when the master boots; passing `--no-migrate` to the server entry point short-circuits the auto-run.

## Vite (rolldown-vite)

The frontend build tool. The `vite` dependency in `package.json` is aliased to `npm:rolldown-vite@7.3.1` so that `yarn build` uses the Rolldown bundler preview. `vite.config.ts` configures the React entry, the PWA service worker, and an advancedChunks vendor split.

## Vitest

The test runner for the monorepo. `vitest.config.ts` defines four projects — `server` (node), `app` (jsdom), `shared-node` (node), and `shared-jsdom` (jsdom) — each with the babel transform required for legacy decorators and `reflect-metadata`. CI shards the server project across four workers.

## Y.js / Yjs

The CRDT library that backs collaborative editing. A `Y.Doc` is the host document; the editor binds it to ProseMirror via `y-prosemirror`, persists updates locally through the `IndexeddbPersistence` provider, and synchronises them through the `HocuspocusProvider` and the server's Hocuspocus `Persistence` extension. See [EDITOR.md](EDITOR.md) for the multiplayer flow.

## Index by area

A quick lookup of where each term sits in the stack.

**Backend services & runtime**

- [AsyncLocalStorage](#asynclocalstorage) — request-scoped context for `ctx.context` and connection state.
- [cancan](#cancan) — authorization engine; the `string[]` return value drives UI gating.
- [PGSSLMODE](#pgsslmode) — Postgres SSL toggle read by Sequelize config.
- [throng](#throng) — one-process-per-CPU forking used by `server/index.ts`.
- [Umzug](#umzug) — migration runner auto-executed at master startup.

**Data & ordering**

- [fractional-index](#fractional-index) — string-based sortable positions on collections and documents.
- [Nanoid](#nanoid) — short, URL-safe IDs for primary keys and share tokens.

**Frontend & build**

- [MobX](#mobx) — observable stores and models in `app/`.
- [Vite (rolldown-vite)](#vite-rolldown-vite) — aliased bundler used by `yarn build`.
- [Vitest](#vitest) — multi-project test runner with sharded CI execution.

**Editor & collaboration**

- [Hocuspocus](#hocuspocus) — Yjs WebSocket server on `/collaboration`.
- [ProseMirror](#prosemirror) — schema + state + view for the rich-text editor.
- [prosemirror-changeset](#prosemirror-changeset) — vendored for diffing remote-only transforms.
- [Y.js / Yjs](#yjs--yjs) — the CRDT document bound to ProseMirror via `y-prosemirror`.
