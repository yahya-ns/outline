# Development

Set up Outline for local development in three commands, then use this guide for the day-to-day workflow, the IDE/editor knobs, the migration pipeline, and the patches that keep the build green. The high-level folder layout lives in [ARCHITECTURE.md](ARCHITECTURE.md); this doc is the hands-on companion.

## Prerequisites

You will need the following before you start.

- **Node.js**: `>=20.12 <21 || 22 || 24` (see `package.json#engines`).
- **Yarn**: 4.11 (the repo pins `packageManager: "yarn@4.11.0"`; corepack will provision it).
- **PostgreSQL**: 14 or newer. The CI workflow runs against `postgres:14.2`.
- **Redis**: any recent version. `docker-compose.yml` brings one up on `127.0.0.1`.
- **Docker / docker compose**: used by the `Makefile` to bring Redis and Postgres online on Linux.
- **Working knowledge of**: TypeScript, React, Koa, Sequelize, Postgres. Newcomers to these should read [`AGENTS.md`](../AGENTS.md) and the upstream docs first.

## Setup

Clone the repository and install dependencies. `yarn install` runs `patch-package` as a postinstall step, so patched dependencies are restored automatically.

```bash
git clone https://github.com/outline/outline.git
cd outline
yarn install
```

Generate a local development certificate so the Vite dev server can serve HTTPS on `local.outline.dev:3000`:

```bash
yarn install-local-ssl
```

Copy and edit the development env file. `.env.development` is preconfigured for the local Postgres + Redis at `127.0.0.1`, with `URL=https://local.outline.dev:3000`, `LOG_LEVEL=debug`, and `DEVELOPMENT_UNSAFE_INLINE_CSP=true` so the Vite HMR client can run inline scripts. Adjust `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, and `UTILS_SECRET` if needed. Generate fresh keys with:

```bash
openssl rand -hex 32
```

`.env.sample` lists every supported variable with comments; it is the source of truth for env names.

## First run

The `Makefile` target `up` brings up Redis + Postgres via Docker, installs the local SSL cert, installs dependencies, and starts the dev watchers:

```bash
make up
```

This runs `yarn dev:watch`, which uses `concurrently` to run two processes side by side:

- `yarn dev:backend` — `nodemon` watching `server/`, `shared/`, `plugins/`, and the env files; on change it rebuilds the server with `yarn build:server` then launches `yarn dev`.
- `yarn vite:dev` — the Vite dev server with HMR for the React app on port 3001 (HTTPS via the local cert).

`yarn dev` runs the prebuilt server with `node --inspect=0.0.0.0` so you can attach a debugger. For day-to-day work use `yarn dev:watch`; for stepping through server code with a debugger, stop the backend watcher and run `yarn dev` directly.

To run the production build, build once and start:

```bash
yarn build
yarn start
```

`yarn start` runs `node ./build/server/index.js`, which forks worker processes via `throng`.

## Common commands

Every command below is defined in `package.json#scripts`.

### Development

| Command | Purpose |
| --- | --- |
| `make up` | Bring up Redis + Postgres, install local SSL, install deps, start `dev:watch`. |
| `yarn dev:watch` | Run backend watcher + Vite dev server concurrently. |
| `yarn dev:backend` | `nodemon` over the server with auto-rebuild. |
| `yarn dev` | Run the prebuilt server with Node `--inspect=0.0.0.0`. |
| `yarn vite:dev` | Vite dev server only (frontend HMR). |
| `yarn vite:build` | Production frontend bundle (rolldown-vite, PWA). |
| `yarn vite:preview` | Preview the production frontend locally. |
| `yarn build` | Full build: clean → vite:build → i18n → server Babel compile. |
| `yarn start` | Run `node ./build/server/index.js`. |
| `yarn clean` | Remove the `build/` directory. |

### Test

| Command | Purpose |
| --- | --- |
| `yarn test` | Run every Vitest project once. |
| `yarn test:app` | App project (jsdom). |
| `yarn test:server` | Server project (node + threads). |
| `yarn test:shared` | Both shared projects (node + jsdom). |
| `yarn test:watch` | Watch mode for the whole suite. |

### Lint, format, types

| Command | Purpose |
| --- | --- |
| `yarn lint` | `oxlint --type-aware` over `app/`, `server/`, `shared/`, `plugins/`. |
| `yarn lint:changed` | Lint only files changed in `git diff`. |
| `yarn format` | Prettier write across the repo. |
| `yarn format:check` | Prettier check (no write). |
| `yarn tsc` | Type-check (run by CI; not a separate script alias — invoke `tsc` directly). |

### Database

| Command | Purpose |
| --- | --- |
| `yarn db:create-migration` | Create a new migration file under `server/migrations/`. |
| `yarn db:create` | Create the database referenced by `DATABASE_URL`. |
| `yarn db:migrate` | Run pending migrations. |
| `yarn db:rollback` | Roll back the most recent migration. |
| `yarn db:reset` | Drop, create, and re-run all migrations. |

### Utility

| Command | Purpose |
| --- | --- |
| `yarn install-local-ssl` | Generate the local HTTPS cert for `local.outline.dev`. |
| `yarn release <ver>` | Bump the version, patch the BSL change date, tag, and push. |
| `yarn upgrade` | `git pull` then `yarn install && heroku-postbuild`. |

## Editor and IDE

The repo's `.vscode/settings.json` enables JS/TS validation and Prettier formatting with format-on-save. No recommended extensions file is provided; add whatever you need locally.

The toolchain combines **rolldown-vite + OXC** for the fast path with **Babel** for the slow path. Babel is required because the codebase uses **legacy decorators** with metadata — `tsconfig.json` enables `experimentalDecorators` and `emitDecoratorMetadata`. The Babel preset chain (`.babelrc`) runs `@babel/preset-env`, `@babel/preset-react`, `@babel/preset-typescript`, `@babel/plugin-proposal-decorators` (legacy), `@babel/plugin-transform-class-properties`, `@babel/plugin-transform-typescript-metadata`, and `babel-plugin-module-resolver`. `vite-plugin-babel` applies the same transform in tests and dev; Vitest disables the default esbuild/OXC transforms for the same reason.

`babel-plugin-transform-inline-environment-variables` injects `SOURCE_COMMIT` and `SOURCE_VERSION` at compile time. In production builds, `babel-plugin-styled-components` runs with `displayName: false` so component class names are stripped.

### Path aliases

`tsconfig.json` and `.babelrc` define four aliases that resolve identically in app code, server code, tests, and Vite:

| Alias | Resolves to |
| --- | --- |
| `@server/*` | `server/*` |
| `@shared/*` | `shared/*` |
| `~/*` | `app/*` |
| `plugins/*` | `plugins/*` |

Use them in imports for consistency. Relative imports are also accepted.

## Debugging tips

- **Node inspector**: `yarn dev` exposes `node --inspect=0.0.0.0`. From VS Code, attach a "Node: Attach" launch config to `127.0.0.1:9229`; from Chrome, open `chrome://inspect`.
- **Health check**: the web service exposes `/_health`, useful for liveness probes during local debugging.
- **Sentry**: set `SENTRY_DSN` to forward local errors to a Sentry project. Reportable errors (`err.isReportable === true` or status 500) are tagged with the `outline` or `outline-mcp` service tag so you can filter in the Sentry UI.
- **`DEBUG=http`**: enable HTTP-level request logs. Set to a comma list (`http,sequelize:*)` for module-scoped debug output.
- **`LOG_LEVEL`**: one of `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. `.env.development` sets `debug`; `.env.sample` defaults to `info`.
- **Source maps**: production builds include sourcemaps so stack traces in Sentry deobfuscate. Set `SENTRY_TUNNEL` if your network blocks direct uploads.

## Internationalization

The frontend uses `react-i18next`; locale files live in `shared/i18n/locales/<lang>/translation.json` and are fetched at runtime via the CDN-aware path.

To extract new keys after editing code:

```bash
yarn build:i18n
```

This runs `i18next-parser` (configured by `i18next-parser.config.js`) across `{shared,app,server,plugins}/**/*.{ts,tsx}` and writes the canonical English catalog to `shared/i18n/locales/en_US/translation.json`. `yarn copy:i18n` then copies the full locale directory into `build/shared/i18n/locales` for production.

To add a new language:

1. Add the language code to the `languages` array and a label to the `languageOptions` array in `shared/i18n/index.ts`.
2. Create an empty locale directory under `shared/i18n/locales/<lang>/` with a stub `translation.json` containing `{}`.
3. Translate via Crowdin. The `crowdin.yml` config maps `en_US` → each locale, and Crowdin pushes commits with the message `fix: New %language% translations from Crowdin [ci skip]`.
4. RTL languages are detected automatically (`isRTLLanguage`) and the document direction flips via Radix `Direction`.

See [`docs/TRANSLATION.md`](TRANSLATION.md) for translator-facing notes.

## Git hooks

Husky is installed by `yarn prepare` and configures a single pre-commit hook at `.husky/pre-commit`. The hook runs `npx lint-staged`, which executes, in order:

1. `prettier --write` on the staged files.
2. `oxlint --fix --type-aware` on the staged files.
3. `yarn build:i18n` to regenerate `shared/i18n/locales/en_US/translation.json` if any staged file touched translatable strings, followed by `git add` of the regenerated catalog.
4. `yarn dedupe` for staged `yarn.lock` / `package.json` changes.

If you need to skip the hook once, commit with `git commit --no-verify`. Pre-commit hooks run automatically via Husky.

For common dev / build / deploy / runtime / MCP issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Patching dependencies

The repo pins `enableScripts: false`, so transitive patches are applied via `patch-package`. The `postinstall` script runs `yarn patch-package` after every `yarn install`.

Patches live in `patches/`. Two are currently in use:

- `patches/@benrbray+prosemirror-math+0.2.2.patch` — fixes a katex `ParseError` import shape mismatch between the upstream `prosemirror-math` and newer katex releases.
- `patches/y-prosemirror+1.3.7.patch` — backports PR #182, adding `restoreRelativeSelection` / `getRelativeSelection` / `relativePositionStore` helpers so `CellSelection` and other ProseMirror selection types survive CRDT round-trips.

To modify or add a patch, edit the dependency, then run `npx patch-package <package-name>` to regenerate the diff. Commit the updated `.patch` file alongside the dependency change.

## Migrations

The server uses `sequelize-cli` with `.sequelizerc` pointing at `server/config/database.js`, `server/migrations/`, and `server/models/`. `dotenvx` loads `.env` or `.env.test` depending on `NODE_ENV`.

- Create a migration: `yarn db:create-migration`. Files are written as `<TIMESTAMP>-<slug>.js` (CommonJS with `up(queryInterface, Sequelize)` / `down`).
- Run migrations: `yarn db:migrate`.
- Roll back the last migration: `yarn db:rollback`.
- Drop, recreate, and remigrate from scratch: `yarn db:reset`.

At server startup, `server/storage/database.ts` runs a small Umzug migration wrapper on the master process. This is automatic and ensures production databases are at head after a deploy. To skip auto-migration at startup (e.g. when the DB user lacks `DDL` rights or you run a multi-pod rollout), pass `--no-migrate` to the server process:

```bash
node ./build/server/index.js --no-migrate
```

This is the only env-controlled knob; migrations are otherwise implicit at boot.

> Migrations are excluded from `tsconfig.json` and from lint. Keep them small, idempotent, and reversible; treat the `down` method as a contract.

## Cross-references

- Project structure: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) and [`docs/SERVICES.md`](SERVICES.md).
- Build, deploy, env vars: [`docs/BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md).
- Server architecture: [`docs/BACKEND.md`](BACKEND.md).
- CI workflows and release: [`docs/CI.md`](CI.md).
- Translator notes: [`docs/TRANSLATION.md`](TRANSLATION.md).

## File map

| Directory | Purpose |
| --- | --- |
| `app/` | React frontend with MobX stores; entry `app/index.tsx`. |
| `server/` | Koa API server with Sequelize models, routes, queues, and policies. |
| `shared/` | Types, schemas, editor core, design tokens, and i18n catalogs. |
| `plugins/` | Optional integrations (auth providers, search providers, etc.). |
| `__mocks__/` | Test mocks for the frontend and shared modules. |
| `server/__mocks__/` | Server-side mocks for Bull, dd-trace, and request filtering. |
| `public/` | Static assets served by Vite; embed provider logos. |
| `patches/` | `patch-package` diffs for upstream dependencies. |
| `.github/` | GitHub Actions workflows, bot configs, issue templates. |
| `docs/` | Developer and contributor documentation. |
| `.husky/` | Git hooks (pre-commit runs `lint-staged`). |
| `.vscode/` | Workspace editor settings (validation + format-on-save). |
| `Makefile` | Dev shortcuts: `up`, `build`, `test`, `watch`, `destroy`. |

When you make your first change, expect a `dev:backend` rebuild on every save; the Vite HMR client applies frontend changes without a reload. If something looks stuck, restart `dev:watch` and tail the logs in the `concurrently` output — the `api` and `collaboration` prefixes are the server processes, `backend` and `frontend` are the watchers.

For a deeper tour of the codebase once the dev environment is running, start with [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) and the service map in [`docs/SERVICES.md`](SERVICES.md).

## Phase 3 features

All five Phase 3 features (originally scaffolds) are now real code:

- `app/scenes/Settings/AuditLog.tsx` — UI to view the `events` table with filters and pagination. Settings entry gated on `can.audit`.
- `app/scenes/Collection/Analytics.tsx` — Per-collection analytics (popularity score, document count, average). Backed by `Document.popularityScore`; a dedicated aggregated API is a follow-up.
- `server/services/websocketRooms.ts` — Per-document WebSocket rooms. The WebsocketsProcessor now also broadcasts document events to `document-${id}`; the team broadcast is unchanged.
- `app/editor/extensions/UndoPersistence.ts` — Yjs undo stack persistence to IndexedDB. Disabled by default (not registered in `app/editor/extensions/index.ts`) so the existing in-memory `yUndoPlugin` is unchanged until the extension is wired in.
- `server/collaboration/stateUpdateStrategy.ts` — Y.js update-message log (in-memory; Postgres-backed table is a follow-up). The 4 exported functions (`persistUpdate`, `loadAndReplay`, `maybeCompact`, `compact`) are real but not yet wired into `PersistenceExtension`.

Related (full implementations from Phase 3, all deps present in `package.json`):

- `docs/A11Y.md` + `.github/workflows/a11y.yml` + `package.json` script `a11y` — `yarn a11y` runs `@axe-core/cli` against the dev server. CI downloads Chromium via puppeteer's postinstall on first run.
- `bundlewatch.config.json` + `.github/workflows/bundlewatch.yml` + `package.json` script `bundle:check` — posts a PR comment when run on a pull_request. See [CI.md](CI.md) for why both bundlewatch and the existing RelativeCI `bundle-size` job exist.