# CLAUDE.md

Project context for Claude Code and other agents. Keep this file focused on things that are **not** obvious from reading the repo — anything you can grep for in five seconds doesn't belong here.

Markdown in this repo is not manually wrapped. Write one paragraph per line and let the editor soft-wrap.

## Layout

- `packages/vite-plugin-fastly/` — the published library. Built with tsdown, published to npm. The package is unscoped (bare `vite-plugin-fastly`) — bare names are normally avoided in projects under this template, but the convention for Vite plugins is the bare `vite-plugin-*` name.
- `examples/*` — consumer demos (server-only, client-server, react-ssr). Not published. Designed to be cloned standalone (e.g. via `degit`), so **dependencies on the workspace package must use real version pins, never `workspace:*`**. The `./version` script keeps those pins in sync with the latest package version; pnpm still links locally during dev thanks to `linkWorkspacePackages: true` in [pnpm-workspace.yaml](pnpm-workspace.yaml).
- `ci/` — internal end-to-end test harness (puppeteer-driven). Private, not published. Joined into the workspace so it gets the local link to the plugin and so Renovate keeps its deps current.

The root `readme.md` is a symlink into the package's readme. Edit the symlink target, not the symlink.

## The plugin/runner split

The package ships **two** entry points built against different runtimes:

- `src/plugin/` → `dist/plugin.js` — runs in Node inside the Vite dev server. tsdown builds it as ESM, `platform: "node"`.
- `src/runner/` → `dist/runner.js` — runs inside Fastly Compute. tsdown builds it as ESM, `platform: "neutral"`, and `deps.neverBundle: [/^fastly:/]` keeps the `fastly:*` host imports external. The runner's `tsconfig.runner.json` adds `customConditions: ["import", "fastly"]` and `types: ["@fastly/js-compute"]`.

Each runtime has its own tsconfig (`tsconfig.plugin.json`, `tsconfig.runner.json`); the package `tsconfig.json` is a project-references aggregator. Don't merge them — they resolve different conditions and have different libs.

`packages/vite-plugin-fastly/types.d.ts` declares the `vite-plugin-fastly:environment` virtual module so consumers get types for the runtime-injected globals.

## Stack invariants

These are deliberate. Don't change them without a reason.

- **ESM only.** No CJS output, no `"type": "commonjs"`.
- **Strict TS** with `noUncheckedIndexedAccess` and `noImplicitOverride`.
- **Tabs, 80 cols.** Markdown and `package.json` use 2-space indent (see [.prettierrc](.prettierrc)). Don't reformat with spaces.
- **Node**: the published plugin targets the lowest `engines.node` major (every active LTS plus every still-maintained Current Node release). Dev tooling, build configs, and scripts can assume the latest minor of the most recent LTS.
- **ESLint config** comes from `@cyco130/eslint-config/node`. Lint rules live there, not in-repo.

## Commands

Run from the repo root unless noted.

- `pnpm dev` — watch-build the plugin.
- `pnpm build` — build the plugin.
- `pnpm test` — runs every script matching `test:*` (uses pnpm's `/^test:/` syntax). Currently `test:packages` (per-package suite) and `test:format` (prettier check).
- `pnpm run ci` — runs the e2e suite under `ci/`. Note: bare `pnpm ci` here is _our_ script; pnpm's own clean-install command is `pnpm install --frozen-lockfile`.
- `pnpm format` — Prettier write across the repo.

Inside the plugin package, `pnpm test` fans out to `test:typecheck` (`tsc --noEmit`), `test:lint` (eslint), and `test:package` (publint).

## Versioning and publishing

- `./version <semver-arg>` (e.g. `./version patch`, `./version 1.2.0`) bumps `packages/vite-plugin-fastly` and rewrites `examples/*` deps to drop the `workspace:` protocol, pinning them to the new version. Run from a clean tree — it edits `package.json` files and the lockfile.
- Publishing is wired up in [.github/workflows/publish.yml](.github/workflows/publish.yml) (workflow_dispatch).

## Tooling around the edges

- **husky + lint-staged** run on pre-commit. If a commit is being blocked, fix the underlying issue rather than bypassing the hook.
- **Renovate** config lives at [.github/renovate.json](.github/renovate.json).
- **VSCode** recommended extensions and settings live in `.vscode/`.
