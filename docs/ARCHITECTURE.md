# Architecture

## Overview

This plugin displays a **configured context alert threshold** in the OpenCode TUI sidebar and bottom bar, and fires toast + desktop notifications when context usage reaches that threshold. It deliberately does not duplicate OpenCode's built-in live context progress display — it only shows the configured limit and triggers on crossing it.

## Module roles

```
tui.tsx (entry point)
  ├── options.ts       — parse & normalize user config
  ├── session.ts       — resolve sessions, find messages, compute usage
  ├── usage.ts         — token math, threshold evaluation, crossing detection
  ├── view-model.ts    — UI display models (label, color, title)
  └── notify.ts        — event subscriptions, toast/desktop dispatch
```

### `tui.tsx` — Plugin entry point

Exports the `tui` async function (the `TuiPlugin` contract) and a default `TuiPluginModule` with `id: "context-management.limit"`.

Responsibilities:

- Normalize options from the user's `tui.json` config via `normalizeOptions()`
- Wire notification event handlers via `wireNotifications()`
- Register two TUI slots:
  - `sidebar_content` — renders `<SidebarLimit>` with title "Limit" and the threshold label
  - `app_bottom` — renders `<BottomBarLimit>` with a one-line label `"limit · <value>"`
- Both slots register with `order: 100` and use SolidJS `createMemo` for reactivity

### `options.ts` — Configuration parsing

Defines `PluginOptionsInput` (what the user writes in `tui.json`) and `NormalizedOptions` (the parsed, validated result).

- `DEFAULT_MAX_TOKENS = 100_000`
- `normalizeOptions()` floors token values, clamps percent to 0–100, preserves finite non-negative cost values, and allows `null`/`false`/omission to disable a limit
- Returns `{ maxTokens, maxPercent, maxCost }`, where `maxCost` is denominated in USD

### `session.ts` — Data access layer

Bridge between OpenCode API message events and the usage/threshold logic.

- `activeSessionID()` — reads current session from the API routes
- `sessionIDFromEvent()` — extracts session ID from event payload shapes
- `lastAssistantWithOutput()` — finds the latest assistant message that has `output` tokens
- `usageForSession()` — resolves messages for a session, finds the model's context window size, carries the latest assistant cost, and delegates to `computeUsage()`
- `isOverLimit()` — convenience that chains session resolution → usage computation → threshold evaluation

### `usage.ts` — Core business logic

Pure computation functions with no API or side-effect dependencies.

- `safeNumber()` — sanitizes potentially missing numeric values
- `sumTokens()` — sums all token categories (input + output + reasoning + cache_read + cache_write)
- `computeUsage()` — returns `UsageSnapshot` with total tokens, context window size, usage percent, and latest assistant cost
- `evaluateThreshold()` — compares usage against `maxTokens`, `maxPercent`, and/or `maxCost`; returns status for each
- `decideCrossing()` — implements once-per-crossing logic with re-arm. Returns `"cross"` when the limit is newly exceeded, `"recross"` after a prior crossing has been re-armed (usage dropped below limit), and `"noop"` otherwise.
- `formatInt()` / `formatCost()` / `formatThresholdLabel()` / `buildNotifyMessage()` — human-readable formatting helpers

### `view-model.ts` — UI display models

Transforms normalized options and threshold status into display-ready values.

- `limitLabelColor()` — returns `"error"` if over the limit, `"textMuted"` if under
- `sidebarLimitModel()` — returns `{ title: "Limit", label: "<formatted threshold>", color }`
- `bottomBarLimitModel()` — returns `{ label: "limit · <formatted threshold>", color }`

### `notify.ts` — Event-driven notifications

Subscribes to OpenCode message events and dispatches alerts.

- `wireNotifications()` — subscribes to `message.updated` and `message.removed` events
- Maintains a `Map<sessionId, boolean>` tracking `armedOver` state per session
- On each event:
  1. Resolves the session ID
  2. Computes usage for that session
  3. Evaluates the threshold
  4. Calls `decideCrossing()` to check if this is a new crossing
  5. If crossing detected, fires `api.ui.toast()` and `api.attention.notify()`
- Returns an unsubscribe function called on plugin dispose

## Data flows

### Startup flow

```
tui.json loaded
  → tui(config) called
    → normalizeOptions(config)
    → wireNotifications(api, options)
    → registerSlot("sidebar_content", component, 100)
    → registerSlot("app_bottom", component, 100)
```

### Event flow (threshold crossing)

```
message.updated / message.removed
  → lookup session ID
  → compute usage for that session
  → evaluate threshold (maxTokens / maxPercent / maxCost)
  → decideCrossing (armed/not-armed/over/under)
  → if crossing: toast + desktop notification
  → update armed state
```

### UI reactivity flow

```
slot registration
  → createMemo reads api.state.session / api.state.messages
  → compute usage → evaluate threshold
  → produce view model (label + color)
  → SolidJS reactivity re-renders on change
```

## Notification lifecycle

1. **Initial state** — `armedOver = false` for each session
2. **Crossing up** — usage goes from under threshold to over → fire notification → set `armedOver = true`
3. **Stay over** — subsequent events while usage remains over → `decideCrossing` returns `"noop"` → no notification
4. **Crossing down (re-arm)** — usage drops below threshold → `armedOver` resets to `false`
5. **Crossing up again** — usage goes over again → notification fires again

This prevents spam while still alerting after a `/compact` reduces usage back below the threshold.

## TUI slot behavior

- `sidebar_content` — displayed when the sidebar is open
- `app_bottom` — displayed in the bottom status bar; hidden while the sidebar is open (checked via `api.kv.get("sidebar_visible")` and terminal width)
- Both use `order: 100` — controls ordering relative to other plugins using the same slots

## Testing architecture

Three test layers, each building on the one below:

| Layer       | File                 | What it tests                                                                                  | Dependencies          |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| Unit        | `tests/unit/`        | Pure functions: options parsing, token math, threshold evaluation, crossing logic, view models | None (mock data only) |
| Integration | `tests/integration/` | Slot registration, notification wiring, plugin lifecycle, multi-session                        | `mock-api.ts`         |
| E2E         | `tests/e2e/`         | Package contract, `tui.json` loading, full under→over→re-arm scenario                          | Real entry + mock API |

### Mock API (`tests/helpers/mock-api.ts`)

Provides a `createMockApi()` function that returns a full `TuiPluginApi` implementation with:

- Event system (emit/subscribe/dispose) with spy support
- State store for sessions, messages, and model info
- Route stubs for session and message resolution
- Theme accessors for color tokens
- KV store for sidebar visibility
- Toast and attention notification spies

This enables comprehensive testing without a real OpenCode TUI host.

## Build & CI

### Build process

`node scripts/build.mjs`:

1. Removes old `dist/` directory
2. Copies `src/` to `dist/`
3. Writes `build.json` with timestamp and entry point

No transpilation occurs — OpenCode loads `.tsx` files natively.

### CI pipeline (GitHub Actions)

Parallel jobs for lint, format check, typecheck, and test. Build runs only after all four pass. This catches issues at the earliest stage without wasting time on builds that would fail checks.
