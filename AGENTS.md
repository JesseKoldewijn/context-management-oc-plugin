# Context Management OC Plugin — Agent Guide

## Identity

This is an OpenCode TUI plugin that displays a **configured context alert threshold** in the sidebar and bottom bar and notifies when usage reaches it. It does not duplicate OpenCode's built-in live context progress display.

**Required reading before editing:**

- `docs/ARCHITECTURE.md` — module roles, data flows, notification lifecycle
- `docs/DECISIONS.md` — key design decisions and their rationale
- `README.md` — install, options, development commands

## Quick reference

| Aspect       | Convention                                                            |
| ------------ | --------------------------------------------------------------------- |
| Language     | TypeScript (100%), no JSX except `.tsx` TUI components                |
| UI framework | SolidJS 1.9 + OpenTUI (`@opentui/solid`)                              |
| API / SDK    | `@opencode-ai/plugin` (types) + `@opencode-ai/sdk`                    |
| Entry point  | `src/tui.tsx` — exports `tui` function + `TuiPluginModule` default    |
| Build        | `node scripts/build.mjs` — copies `src/` → `dist/` (no transpilation) |
| Tests        | vitest — three layers: unit, integration, e2e                         |
| Lint         | `oxlint --type-aware --deny-warnings`                                 |
| Format       | `oxfmt`                                                               |
| Typecheck    | `tsc --noEmit`                                                        |

## Key patterns to follow

- **No comments** in source code unless the code is doing something deliberately non-obvious that cannot be expressed in naming or structure.
- **Re-arm behavior** — notifications fire once per threshold crossing; after usage drops below the limit (e.g. after `/compact`), the arm resets and can fire again. Implemented via a `Map<sessionId, boolean>` in `notify.ts`.
- **Per-session state** — each session has independent notification state so concurrent sessions don't interfere.
- **Event subscriptions** — subscribe to both `message.updated` and `message.removed` to catch incremental token updates and `/compact` removals.
- **Mock API** — use `tests/helpers/mock-api.ts` for testing; it provides a full `TuiPluginApi` mock without a real host.
- **Dual limits** — `maxTokens` and `maxPercent` are evaluated with OR logic (notification fires when any limit is crossed). Both can be active simultaneously.
- **Bottom bar** — hidden while the sidebar is open (visibility checked via `api.kv` and terminal width).
- **TUI slots** — register with `order: 100`; use `sidebar_content` for the sidebar widget and `app_bottom` for the status bar.

## Build & test commands

```bash
npm run build           # copy src/ → dist/
npm test                # all tests (unit, integration, e2e)
npm run test:coverage   # with 90% line/branch threshold
npm run typecheck       # tsc --noEmit
npm run lint            # oxlint --type-aware
npm run format:check    # oxfmt --check
```

## Pull requests

When a PR is ready for human review (CI green, no unresolved review threads you still need to fix, description complete), add the **`ready-for-review`** label:

```bash
gh pr edit <number> --add-label ready-for-review
```

Do not add that label while the PR is still draft, failing CI, or blocked on your own follow-ups.

## Releases

Versioning is handled by [semantic-release](https://github.com/semantic-release/semantic-release) on pushes to `main` that include releasable commits (see `.github/workflows/release.yml`).

- **Conventional Commits** — squash-merge PR titles are what get analyzed. Use prefixes such as `feat:`, `fix:`, `perf:`, `feat!:` / `BREAKING CHANGE:`, `docs:`, `chore:`. Releases are cut for `feat` (minor), `fix` / `perf` (patch), and breaking changes (major); `docs` / `chore` alone do not release.
- **Changelog** — `CHANGELOG.md` is updated automatically when semantic-release creates a release (not on every merge to `main`).
- **CI loop avoidance** — release commits are `chore(release): x.y.z [skip ci]` so CI and the release workflow do not re-run.
- **Baseline** — the first published semver baseline is `v0.1.0` (matches `package.json`). If that tag is missing on `main`, create an annotated tag once after landing the release workflow so the next `fix:`/`feat:` produces `0.1.1` / `0.2.0` instead of a surprising first cut.
- **Publish** — eligible releases are published to GitHub Packages (`https://npm.pkg.github.com`) as `@jessekoldewijn/context-management-oc-plugin` via `@semantic-release/npm` (`npmPublish: true`). The release job uses `packages: write` and a scoped `.npmrc` only in the release step (so `npm ci` still uses the public npm registry).
