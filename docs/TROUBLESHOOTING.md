# Troubleshooting

Recipes for the issues that surface most often when running Outline locally or self-hosting it in production. For day-to-day development commands, see [`docs/DEVELOPMENT.md`](DEVELOPMENT.md); for the server architecture and process model, see [`docs/BACKEND.md`](BACKEND.md); for build, deploy, and env vars, see [`docs/BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md).

## Prerequisites

Outline troubleshooting guide.

## Local dev issues

### `yarn install` fails on Node 24 / Apple Silicon

Native modules (`sharp`, `keytar`, native addons under `node_modules`) need a matching Node ABI. Switch to a supported Node, then reinstall: `nvm use 24 && rm -rf .yarn/cache && yarn install`. The `postinstall` step re-applies the patches under `patches/`.

### Postgres connection refused at boot

The local Postgres on `127.0.0.1:5432` is not running. Bring it up with `make up` (or `docker compose up -d postgres`), then check `DATABASE_URL` in `.env.development`. If your install uses a non-default user or password, mirror it in the URL.

### Redis connection refused at boot

Same pattern: Redis is not up. `make up` brings it online on `127.0.0.1:6379`. For a custom host, point `REDIS_URL` at it. The `worker`, `collaboration`, and `websockets` services all fail-fast if Redis is unreachable at boot.

### Hocuspocus collaboration server not connecting

`COLLABORATION_URL` in `.env` does not match the URL the browser is connecting from. The browser-side `HocuspocusProvider` reads `window.env.COLLABORATION_URL` (inlined via `@Public` in `server/env.ts`), so a mismatch surfaces as silent retry loops in the editor. Match the protocol, host, and port; the dev default is `https://local.outline.dev:3000/collaboration`.

### Vite dev server port conflict (3001)

Another process is bound to 3001. Free the port or change the `server.port` in `vite.config.ts`. The dev server also needs HTTPS via the local cert from `server/config/certs/` — re-run `yarn install-local-ssl` if the cert is missing.

### `Reflect.metadata is not a function` from a test

The test file is going through the default esbuild/OXC transform instead of the Babel one. The decorator metadata is stripped. Vitest disables the default transform per-project in `vitest.config.ts`; the file is probably in a directory not covered by a project's `include` glob. Add the path to the relevant project, or move the test under an already-included directory.

### `Migrations pending` failure on master startup

The master process runs migrations via Umzug from `server/storage/database.ts` and refuses to fork if any are pending against a non-empty database. Run `yarn db:migrate` (the same Umzug pipeline) and confirm the head matches `server/migrations/`. To skip the auto-run when the DB user lacks `DDL` rights, pass `--no-migrate` to the server process.

### HMR loops / stale build artifacts

The Vite HMR client is running against a stale module graph after a `node_modules` or alias change. Stop `yarn dev:watch`, run `yarn clean`, then `yarn dev:watch` again. If loops persist, clear `.yarn/cache` and the browser service worker at `/static/sw.js`.

## Build & deploy issues

### `yarn build` fails with a `babel-plugin-styled-components` complaint

`@babel/preset-env` has been upgraded past the version the styled-components plugin supports. Pin the plugin to a version compatible with `@babel/core`, or upgrade the plugin. The plugin is wired in `.babelrc` with `displayName: false` for production builds.

### Docker build fails on M1 Mac (cross-platform)

The multi-arch `Dockerfile` requires `docker buildx`. Use `docker buildx build --platform linux/amd64,linux/arm64 .` rather than `docker build`. The CI workflow `.github/workflows/docker.yml` shows the exact `buildx` invocation, including the `--load` / `--push` split.

### `node build/server/index.js` panics with "secret key not configured"

`SECRET_KEY` (and usually `UTILS_SECRET`) is missing or shorter than 32 bytes. Generate fresh ones with `openssl rand -hex 32` and set them in the environment or in a `_FILE` Docker secret referenced via `SECRET_KEY_FILE` / `UTILS_SECRET_FILE`. The server refuses to boot without a strong key.

### `/_health` returns 503

A liveness probe dependency is down. `/_health` pings Postgres and Redis. Check `DATABASE_URL` and `REDIS_URL`, confirm both services are reachable from the pod, and inspect the `HealthMonitor` logs from the `worker` service. The 503 is intentional — the orchestrator should restart the pod.

### `yarn db:migrate` runs the wrong migration set

`.sequelizerc` loads `.env` or `.env.test` based on `NODE_ENV`. If you ran `yarn db:migrate` against a production-shaped `DATABASE_URL` with `NODE_ENV=test`, the wrong env file is loaded. Set `NODE_ENV` explicitly, or run migrations through the master process (`yarn dev` or `node build/server/index.js`) so Umzug uses the same env the server uses at boot.

### `node:bad-option` in older Node versions

The Dockerfile pins `node:24.16.0-slim`; the local dev range is `>=20.12 <21 || 22 || 24` per `package.json#engines`. Node 18 or earlier is unsupported and `--no-migrate`, `--services`, and the recent `node --inspect` flags trip on the wrong runtime. Upgrade to a supported Node.

## Runtime / collaboration issues

### Editor stuck on "Connecting"

The Hocuspocus WebSocket at `/collaboration` is not reachable from the browser, or the editor version is stale. Confirm `COLLABORATION_URL` in `window.env` matches what the server is bound to, and confirm `EDITOR_VERSION` (from `shared/editor/version.ts`) matches the server's compiled-in version. A mismatch triggers a full reload; a missing URL triggers a silent retry.

### Comments not syncing

The Y.js document is syncing but the comment marks are not. The two patches in `patches/` (`@benrbray+prosemirror-math+0.2.2.patch` and `y-prosemirror+1.3.7.patch`) must be applied — they are reapplied by `yarn patch-package` on every `yarn install`. If `postinstall` was skipped, run `yarn patch-package` and restart the server.

### WebSocket 1009 (`DocumentTooLarge`)

The Y.js BLOB exceeded the per-document size cap. Hocuspocus closes the connection with code 1009 to prevent the document from growing unbounded. Split the document, archive old revisions, or prune embeds / images. The cap lives in the Hocuspocus `PersistenceExtension` configuration in `server/collaboration/`.

### WebSocket 4401 (`AuthenticationFailed`)

The collaboration JWT in the `accessToken` cookie expired. The Hocuspocus `Authentication` extension validates the token signed with `SECRET_KEY`. A 4401 is also raised when `SECRET_KEY` is rotated without flushing sessions. Re-login to refresh the cookie; on rotation, accept that all open editors will reconnect.

### WebSocket 4403 (`AuthorizationFailed`)

The authenticated user is no longer a member of the document's team, or the document is restricted to specific groups. The Hocuspocus `Authentication` extension checks team membership before admitting the connection. Re-invite the user, or have them sign in to the correct team. The close codes are defined in `shared/collaboration/CloseEvents.ts`.

## MCP issues

### `/.well-known/oauth-authorization-server/mcp` returns 404

The MCP team preference is disabled. Discovery is gated by `TeamPreference.MCP` (default `true`, declared in `shared/constants.ts`). An admin can toggle it at `/settings/features` (the `MCP` toggle in `app/scenes/Settings/Features.tsx`); without it, both `.well-known` endpoints and the `/mcp` route return 404.

### MCP tool `update` returns 401

The OAuth access token does not carry the required scope. MCP scopes mirror the API verbs; `update` requires the document-update scope on the user's team. Re-authorize the client with the broader scope, or use a per-resource API key generated from `/settings/api-keys`. The scope grammar is in `shared/helpers/AuthenticationHelper`.

### "Tool not found" from a registered MCP client

The tool exists on the server but the client's view of the registry is filtered. MCP tools are gated by OAuth scopes and by team preferences, and the server constructs a fresh `McpServer` per request in `server/routes/mcp/index.ts` (no session). A "tool not found" usually means the client's token scopes do not include the tool, or `TeamPreference.MCP` is off for the team the token belongs to.

## Cross-references

- Project structure: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
- Service topology: [`docs/SERVICES.md`](SERVICES.md).
- Local dev workflow: [`docs/DEVELOPMENT.md`](DEVELOPMENT.md).
- Server architecture: [`docs/BACKEND.md`](BACKEND.md).
- Build, deploy, env vars: [`docs/BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md).
- CI and release: [`docs/CI.md`](CI.md).
- Editor (ProseMirror, multiplayer): [`docs/EDITOR.md`](EDITOR.md).
- MCP server details: [`docs/MCP.md`](MCP.md).
- Plugin system: [`docs/PLUGINS.md`](PLUGINS.md).

## File map

| Directory | Purpose |
| --- | --- |
| `app/` | React frontend; editor multiplayer lives in `app/editor/`. |
| `app/scenes/` | Scene components; MCP toggle at `app/scenes/Settings/Features.tsx`. |
| `patches/` | `patch-package` diffs applied at every `yarn install`. |
| `plugins/` | Optional integrations discovered by `PluginManager`. |
| `server/` | Koa server root; entry `server/index.ts`. |
| `server/collaboration/` | Hocuspocus extensions (auth, persistence, throttling). |
| `server/middlewares/` | Auth, CSRF, rate limit, validation, transaction, CSP. |
| `server/routes/` | HTTP routes; `server/routes/mcp/` is the MCP server. |
| `server/services/` | Service registry (`web`, `worker`, `collaboration`, `websockets`, `admin`, `cron`). |
| `server/storage/` | Database, Redis, files, vault, request context. |
| `server/tools/` | MCP tool implementations registered per request. |
| `shared/` | Types, schemas, editor core, i18n, design tokens. |
| `shared/collaboration/` | WebSocket close-event codes shared by client and server. |
