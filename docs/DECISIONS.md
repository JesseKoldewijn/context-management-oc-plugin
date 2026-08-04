# Design Decisions

## 1. Threshold-only display (not live progress)

**Context.** OpenCode's built-in TUI already shows live context usage progress in the sidebar. Early drafts considered re-displaying that live progress with additional formatting.

**Decision.** Show only the configured threshold — the limit value (tokens and/or percent) and whether it has been exceeded. Do not display live current usage.

**Consequences.** Avoids duplicating built-in UI. Users get the one piece of information OpenCode doesn't show: "what's my configured limit?" The trade-off is that the limit display is static until the limit is crossed.

---

## 2. SolidJS + OpenTUI for terminal UI

**Context.** OpenCode TUI plugins render into terminal UI slots using components.

**Decision.** Use SolidJS 1.9 with `@opentui/solid` for component rendering, matching OpenCode's own TUI framework.

**Consequences.** Reactive UI via `createMemo` and signals integrates naturally with OpenCode's slot lifecycle. Components are declarative and fine-grained. The framework choice is dictated by the host platform.

---

## 3. No transpilation / custom build script

**Context.** OpenCode loads plugin `.tsx` files natively via its built-in TypeScript/JSX parser.

**Decision.** The build step is a simple copy of `src/` → `dist/` with a `build.json` stamp file. No bundling, no transpilation, no Babel/SWC/ESBuild.

**Consequences.** Fast builds, minimal tooling. `tsc --noEmit` is used only for type checking, not output generation. The custom `scripts/build.mjs` is ~15 lines and replaces what would otherwise be a no-op build pipeline.

---

## 4. Once-per-crossing notifications with re-arm

**Context.** Without rate limiting, every message event while over the threshold would fire a notification, producing spam.

**Decision.** Notifications fire once when usage crosses _up_ through the threshold, then silence until usage drops back _below_ the threshold (re-arm), at which point another crossing can be detected.

**Consequences.** Prevents notification spam. Re-arm after `/compact` or session cleanup allows the user to be re-notified if usage grows again. The trade-off is that a very slow leak that stays just above the threshold won't re-alert, but that's an acceptable trade-off since the TUI already shows the over-limit state continuously.

---

## 5. Per-session state tracking

**Context.** OpenCode supports multiple concurrent sessions (separate conversations in separate TUI tabs).

**Decision.** Track `armedOver` state in a `Map<sessionId, boolean>` so each session independently manages its notification arm state.

**Consequences.** Sessions don't interfere. A crossing in one session doesn't suppress notifications in another. Slightly more complex state management, but correctly models the domain.

---

## 6. Subscribe to `message.updated` + `message.removed`

**Context.** Token usage changes both when messages are incrementally streamed (`message.updated`) and when they are removed by `/compact` (`message.removed`).

**Decision.** Subscribe to both event types. Ignore events that don't involve the assistant or don't carry output tokens.

**Consequences.** Correctly detects re-arm after compaction. The handler filters aggressively and re-evaluates synchronously, so the cost is minimal.

---

## 7. Mock API for testing

**Context.** The plugin depends on `TuiPluginApi` from the OpenCode host, which is not available in a standard test runner.

**Decision.** Build a full `createMockApi()` factory in `tests/helpers/mock-api.ts` that provides a complete API implementation with spies, stubs, and controllable state.

**Consequences.** Tests run in isolation without a real TUI. The mock is shared across all test layers (integration and E2E). It's more code to maintain but eliminates all external dependencies from tests. The mock surface area mirrors the real API closely enough to catch integration issues.

---

## 8. Oxidation toolchain (oxlint, oxfmt)

**Context.** Fast linting and formatting in a TypeScript project.

**Decision.** Use `oxlint` (with `oxlint-tsgolint` for type-aware rules) and `oxfmt`. Reject the traditional ESLint + Prettier stack.

**Consequences.** Significantly faster lint and format passes (sub-second vs. multi-second). The type-aware rules in `oxlint-tsgolint` catch real bugs. The tooling is newer and less widely documented, but the speed and correctness trade-off is strongly positive.

---

## 9. Dual limit evaluation with OR logic

**Context.** Users may want to set both an absolute token ceiling (`maxTokens`) and a relative percentage of the model's context window (`maxPercent`).

**Decision.** Evaluate both limits independently. A notification fires when **any** enabled limit is crossed. Both can be active simultaneously and both are displayed in the UI.

**Consequences.** Maximum flexibility for the user. The plugin works for token-only, percent-only, cost-only, any combination, or none. The OR logic is intuitive and matches user expectations.

---

## 10. Latest-message cost evaluation

**Context.** Assistant messages expose a cost alongside token usage. A cost limit could either represent the latest response or accumulate across a session.

**Decision.** Use the latest qualifying assistant message's cost, matching the existing latest-message token model. Cost is evaluated in USD and participates in the same OR evaluation as token and percent limits.

**Consequences.** This is the smallest behavioral change and keeps cost consistent with the current usage snapshot. It does not represent a cumulative session budget; cumulative accounting would require additional handling for compaction and message removal.
