# Contributing

## Prerequisites

Contributions of all kinds — code, docs, bug reports, and feature discussion — are welcome to Outline, a fast, collaborative knowledge base built for teams. This guide is the human-facing companion to [`AGENTS.md`](../AGENTS.md), which is the AI-agent handbook and the source of truth for code style, TypeScript usage, and project conventions. Read it before you open a pull request.

If you are new to the codebase, start with the audience map in [`docs/README.md`](README.md) — it points at the right doc for your task (backend, frontend, editor, plugins, MCP, ops). For local setup, follow [`docs/DEVELOPMENT.md`](DEVELOPMENT.md). For a high-level folder map, see [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

First-time contributors must accept the Contributor License Agreement. CLA-assistant comments on your pull request with a sign link; unsigned PRs older than two weeks are closed automatically by `.github/workflows/auto-close-prs.yml`.

## How to file a bug or feature request

**Security issues** go to [`docs/SECURITY.md`](SECURITY.md), not the issue tracker. Disclose vulnerabilities privately through GitHub Security Advisories so they can be triaged before public disclosure.

**Bug reports** go to GitHub Issues. Use the bug report template and include:

- A clear, minimal reproduction.
- The Outline version (visible at the bottom of the settings page) and commit hash if you built from source.
- Environment: self-hosted or cloud, browser and OS for frontend bugs, database engine for backend bugs.
- Relevant log lines (set `LOG_LEVEL=debug` for the server, open the browser console for the app).

**Feature requests and self-hosting questions** go to [GitHub Discussions](https://github.com/outline/outline/discussions), not Issues. Issues are reserved for actionable bug reports; feature discussion, ideas, and deployment questions live in Discussions. The repository's `ISSUE_TEMPLATE/config.yml` disables blank Issues for this reason.

All participants are expected to follow [`docs/CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## How to send a pull request

1. Fork the repository and create a topic branch from `main`.
2. Make focused commits. One concern per pull request keeps reviews fast.
3. Run the local checks before pushing:

```bash
yarn lint && yarn tsc && yarn test
```

4. The pre-commit hook (`.husky/pre-commit`) runs `lint-staged`, which formats with Prettier, lints with Oxlint, regenerates the `en_US` translation file, and deduplicates `yarn.lock`. If a hook step fails, fix the underlying issue — do not skip it.
5. CI runs the same checks plus dependency audit and a bundle-size report; see [`docs/CI.md`](CI.md) for the workflow breakdown.
6. Open the pull request against `main`.

**Pull request titles** follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `build:`, `ci:`, `perf:`. This drives the auto-generated changelog grouping and keeps history searchable.

**Auto-assign.** The repo auto-adds `@tommoor` as a reviewer on every PR (see `.github/auto_assign.yml`). Pull requests with `wip` in the title are skipped so you can iterate before review. Remove `wip` when the PR is ready.

**Reviews.** First-time contributors receive a welcome message from the new-PR bot. Maintainers review on a best-effort basis; expect questions, requested changes, and a back-and-forth before merge. Squash-merge is the default; rebase before merge if your branch has drifted from `main`.

**What goes in the PR body.** Summarise the change in one or two sentences. Link the issue or discussion it resolves. Call out any user-visible behaviour change, migration step, or new environment variable. Include a screenshot or short screen capture for frontend changes that touch layout, theming, or motion.

## Code style

Detailed rules — TypeScript strict mode, React and MobX conventions, JSDoc requirements, security practices, and the class member order — live in [`AGENTS.md`](../AGENTS.md). Follow them as the source of truth.

For subsystem-specific patterns:

- **Testing** (Vitest projects, fixtures, mocks): [`AGENTS.md`](../AGENTS.md) and [`docs/DEVELOPMENT.md`](DEVELOPMENT.md).
- **Database and migrations** (Sequelize models, sequelize-cli, Umzug auto-run): [`AGENTS.md`](../AGENTS.md) and [`docs/DATA_MODEL.md`](DATA_MODEL.md).
- **Backend patterns** (routes, policies, presenters, commands, queues): [`docs/BACKEND.md`](BACKEND.md).
- **Frontend patterns** (stores, models, hooks, actions, menus): [`docs/FRONTEND.md`](FRONTEND.md).
- **Security model** (authN/authZ, CSRF, rate limiting, encryption): [`docs/SECURITY_MODEL.md`](SECURITY_MODEL.md).
- **Architecture overview**: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

Lint and format are enforced by CI; do not submit PRs with `yarn lint` failures. Prettier formatting is automatic on commit.

## Release process

Releases are maintainer-driven. The flow:

1. A maintainer runs `yarn release <major|minor|patch|x.y.z>`. The script in `server/scripts/release.js` bumps the version in `package.json`, updates the BSL license change-date in `LICENSE`, commits, tags, and pushes.
2. The `v*` tag triggers `.github/workflows/docker.yml`, which builds multi-arch (`amd64` + `arm64`) images and publishes a manifest list to Docker Hub. See [`docs/CI.md`](CI.md).
3. Crowdin translation syncs back as automated commits of the form `fix: New %language% translations from Crowdin [ci skip]`. No maintainer action is needed; translations land on `main` directly.

The full build, deploy, and environment-variable reference is in [`docs/BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md).

## Community norms

All contributors — in issues, pull requests, discussions, and project spaces — are expected to follow [`docs/CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). It is adapted from the Contributor Covenant and is enforced by the project maintainers. Be welcoming, be specific, and assume good faith.

## Other ways to contribute

- **Translations.** Outline's UI is localised through Crowdin. To translate an existing string or add a new language, follow [`docs/TRANSLATION.md`](TRANSLATION.md). Do not edit translation files manually — they are regenerated from `en_US` on every commit by `lint-staged`.
- **Documentation.** The developer docs in `docs/` are maintained alongside the code. When you change a public surface (a middleware, a route, an env var, a model, a plugin hook), update the matching doc in the same pull request. Conventions and the cross-link rules are described at the bottom of [`docs/README.md`](README.md) under "Maintaining this doc set".
- **Plugins.** If you want to integrate with Outline as an external system, the plugin system is the supported extension point. See [`docs/PLUGINS.md`](PLUGINS.md) for the server and client `PluginManager`, the manifest format, and an authoring guide. The bundled plugins under `plugins/` are also a useful reference.
