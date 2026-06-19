# Developer documentation

Outline is a fast, collaborative knowledge base built for teams. The repository is a TypeScript monorepo with a React + MobX frontend, a Koa + Sequelize backend, a real-time collaboration layer over Y.js and Hocuspocus, and a ProseMirror-based editor shared between the app and the server. It is designed to be self-hosted on a single Linux box or deployed to the cloud, and ships with a first-class plugin system for auth providers, search backends, and outbound integrations.

This README is the index for the docs in this folder. The repository's project root `README.md` is the user-facing introduction — start there if you only want to know what Outline is. The docs in this folder are the developer reference for working on the codebase.

## Where to start

Each audience has a short path through the docs. Follow the row that matches the task in front of you.

| If you are… | Read these first |
| --- | --- |
| A first-time contributor | [`CONTRIBUTING.md`](CONTRIBUTING.md) (start here), [`README.md`](README.md) (this index), [`DEVELOPMENT.md`](DEVELOPMENT.md), [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Debugging an issue | [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) (recipes for common failures) |
| Looking up a term | [`GLOSSARY.md`](GLOSSARY.md) (project-specific and library terms) |
| Reviewing a design decision | [`ADRS/`](ADRS/) (architecture decision records) |
| A backend developer or SRE | [`BACKEND.md`](BACKEND.md), [`DATA_MODEL.md`](DATA_MODEL.md), [`SECURITY_MODEL.md`](SECURITY_MODEL.md), [`BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md), [`CI.md`](CI.md), [`SERVICES.md`](SERVICES.md) |
| A frontend developer | [`FRONTEND.md`](FRONTEND.md), [`EDITOR.md`](EDITOR.md), [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Writing a plugin | [`PLUGINS.md`](PLUGINS.md); also [`EDITOR.md`](EDITOR.md) if the plugin extends the editor, [`DATA_MODEL.md`](DATA_MODEL.md) if it subscribes to events |
| Authoring an MCP client | [`MCP.md`](MCP.md) |
| Releasing or running the platform | [`CI.md`](CI.md), [`BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md), [`SECURITY_MODEL.md`](SECURITY_MODEL.md) |

## All docs in this folder

Every document in `docs/`, in one line each.

### Existing

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — high-level folder map for the monorepo.
- [`SERVICES.md`](SERVICES.md) — runtime service topology (web, worker, collaboration, websockets, admin, cron) and operational flags.
- [`SECURITY.md`](SECURITY.md) — vulnerability disclosure policy (unmodified; the security model is in `SECURITY_MODEL.md`).
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — community guidelines.
- [`TRANSLATION.md`](TRANSLATION.md) — translator-facing notes for Crowdin.

### New

- [`README.md`](README.md) — this index.
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — local development setup, daily commands, IDE configuration, migrations, i18n, and patches.
- [`BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md) — build pipeline, Docker, Heroku, environment variables, and the release process.
- [`CI.md`](CI.md) — GitHub Actions workflows, the release pipeline, Dependabot, and bundle-size checks.
- [`BACKEND.md`](BACKEND.md) — server architecture: process model, request lifecycle, data layer, API surface, queues, middlewares, presenters, and SSR.
- [`DATA_MODEL.md`](DATA_MODEL.md) — entities, the ERD, the document lifecycle state diagram, the event bus, and the permissions and sharing models.
- [`SECURITY_MODEL.md`](SECURITY_MODEL.md) — threats and controls: authN/authZ, request defences, data at rest, webhook integrity, file-upload safety, and transport.
- [`FRONTEND.md`](FRONTEND.md) — the React app: boot sequence, routing, stores, models, cross-cutting patterns, actions, menus, hooks, and styles.
- [`EDITOR.md`](EDITOR.md) — the ProseMirror-based editor: schema, marks and nodes, embeds, commands and queries, the markdown pipeline, comments, and multiplayer.
- [`PLUGINS.md`](PLUGINS.md) — the plugin system: server and client `PluginManager`, the plugin reference, deep dives, and an authoring guide.
- [`MCP.md`](MCP.md) — the Model Context Protocol server: architecture, request flow, OAuth 2.1 + PKCE, the seven tools, and discovery.
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) — common dev, build, runtime, and MCP issues with actionable "if you see X, do Y" recipes.
- [`GLOSSARY.md`](GLOSSARY.md) — definitions of project-specific and library terms used throughout the docs.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — the human-facing contributor guide (PR workflow, release process, community norms); thin pointer doc that defers style rules to `AGENTS.md`.
- [`ADRS/0001-yjs-for-collaboration.md`](ADRS/0001-yjs-for-collaboration.md) — decision to use Yjs (via Hocuspocus) for collaborative editing.
- [`ADRS/0002-hocuspocus-over-custom-ws.md`](ADRS/0002-hocuspocus-over-custom-ws.md) — decision to use Hocuspocus as the collaboration WebSocket server instead of a custom `ws` implementation.

## How this doc set is organised

The docs in this folder fall into three groups.

- **Process** — guides you through a workflow. Read these in order when you are setting up, building, releasing, or maintaining the codebase. `DEVELOPMENT.md`, `BUILD_AND_DEPLOY.md`, `CI.md`.
- **Reference** — describes a subsystem end-to-end. Open these when you are about to make a change inside a subsystem. `BACKEND.md`, `DATA_MODEL.md`, `SECURITY_MODEL.md`, `FRONTEND.md`, `EDITOR.md`, `PLUGINS.md`, `MCP.md`.
- **Index** — this file.

The existing `ARCHITECTURE.md` and `SERVICES.md` are the historical reference for the folder map and the runtime service topology; the new docs build on them. `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `TRANSLATION.md` are policy docs and are not changed by this set.

Every reference doc starts with a `## Prerequisites` section that names what you should already understand, and ends with a `## File map` table that links the discussion back to the source directories. Mermaid diagrams are used for request sequences, the entity-relationship diagram, and the document lifecycle state machine. Counts are avoided in headings (they rot); specific numbers live in tables where they can be updated from a single source.

## Cross-link rules

The docs in this set follow a small set of explicit cross-link rules so that each doc stays scoped. When you read one of these references, the linked doc covers the related topic in depth.

- `PLUGINS.md` → `EDITOR.md` — if your plugin contributes to the editor, registration is through the editor's extension arrays, not through the plugin API.
- `PLUGINS.md` → `DATA_MODEL.md` — if your plugin subscribes to events, the event bus and envelope are documented there.
- `MCP.md` → `PLUGINS.md` — MCP is a first-class subsystem of the server, not a plugin; the link clarifies what "plugin" means in this codebase.
- `MCP.md` → `SECURITY_MODEL.md` — the OAuth 2.1 + PKCE mechanics and the request defences layered on top of the transport.
- `SECURITY_MODEL.md` → `BACKEND.md` — the implementation patterns (middleware ordering, presenters, commands) live in `BACKEND.md`; this doc covers the *threats and controls*.
- `DATA_MODEL.md` → `BACKEND.md` — the server-side mechanics that operate on these entities (request lifecycle, `saveWithCtx`, cancan policies) live in `BACKEND.md`.
- `BUILD_AND_DEPLOY.md` → `CI.md` — the release section links to `CI.md` for the full release pipeline.
- `FRONTEND.md` → `EDITOR.md` — the editor's multiplayer flow and schema are documented in `EDITOR.md`.

## File map

One line per major directory in the monorepo, as a quick index to the source.

| Directory | What lives there |
| --- | --- |
| `app/` | React frontend: scenes, components, stores, models, editor host, hooks, actions, menus, styles, utils. |
| `server/` | Koa API server: routes, models, policies, presenters, commands, queues, middlewares, services, migrations, storage, utils. |
| `shared/` | Code shared between the app and the server: editor, i18n, styles, components, utils. |
| `plugins/` | Optional integrations: auth providers, search providers, unfurlers, storage backends, webhooks, analytics. |
| `public/` | Static assets served directly by Vite; embed-provider logos. |
| `patches/` | `patch-package` diffs applied to upstream dependencies. |
| `.github/` | GitHub Actions workflows, bot configuration, and issue templates. |
| `.husky/` | Git hooks (pre-commit runs `lint-staged`). |
| `.vscode/` | Workspace editor settings (validation, format-on-save). |
| `__mocks__/`, `server/__mocks__/` | Test mocks for the frontend, shared, and server projects. |
| `docs/` | Developer and contributor documentation (this folder). |
| `Makefile` | Dev shortcuts: `up`, `build`, `test`, `watch`, `destroy`.

## Maintaining this doc set

The set is generated against the source tree; counts and paths drift as the codebase evolves. When you change a public surface — adding a middleware, a plugin, a route, an env var, or a model — update the matching doc in the same change. Before opening a PR, run the mechanical checks against the docs you touched: `## Prerequisites` present in each reference doc, no raw counts in headings, Mermaid code fences tagged `mermaid`, every `server/`, `app/`, `shared/`, or `plugins/` path mentioned in a doc still exists in the source, and every relative cross-doc link resolves.

When you add a new reference doc, follow the same conventions: a `## Prerequisites` block near the top, a `## File map` table at the bottom, a one-line purpose, and cross-links to the docs the new doc leans on. If the new doc introduces a new cross-link rule, add it to the list above so future readers know what to expect. |
