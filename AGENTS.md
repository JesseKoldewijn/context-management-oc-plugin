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
