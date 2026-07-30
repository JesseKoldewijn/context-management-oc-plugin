# Context Management OpenCode Plugin

Set a **context alert threshold** for OpenCode and get notified when you cross it. OpenCode's built-in sidebar already shows live context usage — this plugin adds the configured limit display and crossing alerts.

## Why this exists

OpenCode shows how much context you're using, but it doesn't let you say "tell me when I hit 80%" or "warn me at 100,000 tokens". That's what this plugin does.

- **Set a limit** — absolute tokens and/or percent of the model's context window
- **See it in the UI** — your limit is shown in the sidebar and bottom bar, turning red when crossed
- **Get notified** — toast and desktop notification fire when you cross the threshold (once per crossing, re-arms after `/compact`)

## How it looks

When usage is under your limit:

```
Sidebar           Bottom bar
─────────         ──────────────
Limit             limit · 100,000 tokens · 80% of context
100,000 tokens
· 80% of context
```

When usage crosses the limit, the label turns red, and a toast + desktop notification fires. After you `/compact` and usage drops below the limit, the arm resets and can fire again.

## Use cases

- **Budget awareness** — stay under a token ceiling for cost-sensitive work
- **Context window management** — know when you're crowding the model's context window before quality degrades
- **Compaction cue** — use the notification as a signal to run `/compact` mid-conversation
- **Running close to the edge** — set a high percent threshold so you're alerted only when you're truly pushing the limit

## How notifications work

The plugin fires once per threshold crossing — not on every message update. If you cross 80% usage, you get one notification. If you then `/compact` and usage drops below 80%, the arm resets. If usage climbs back above 80%, you get another notification. This means no spam but you won't miss a re-crossing.

## Prerequisites

- OpenCode >= 1.4.3 (TUI plugin system)

## Install

Build once, then point OpenCode at this package from your TUI config (`tui.json` / `tui.jsonc`):

```bash
npm install
npm run build
```

```jsonc
{
  "plugin": [
    [
      "/absolute/path/to/context-management-oc-plugin",
      {
        "maxTokens": 100000,
        "maxPercent": 80,
      },
    ],
  ],
}
```

Relative paths resolve against the config file that declares them. The package exports `./tui` → `dist/tui.tsx` (produced by `npm run build`).

### Options

| Option       | Default  | Description                                                  |
| ------------ | -------- | ------------------------------------------------------------ |
| `maxTokens`  | `100000` | Absolute token ceiling. Set to `null` or `false` to disable. |
| `maxPercent` | unset    | Percent of model context window (0–100). Omit to disable.    |

Omit options entirely to use **maxTokens: 100000** only.

Notification fires when **any** enabled limit is reached.

**When to use which?** `maxTokens` gives you a hard ceiling independent of the model (useful for cost budgets). `maxPercent` scales with the model's context window (useful for quality management across models with different capacities). Use both together for belt-and-suspenders.

### Desktop notifications

Toast always works. Desktop attention requires `attention.enabled: true` in TUI config:

```jsonc
{
  "attention": {
    "enabled": true,
    "notifications": true,
    "sound": true,
  },
}
```

## Development

```bash
npm install
npm run build
npm test                 # unit + integration + e2e
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage    # enforces line/branch thresholds
npm run typecheck
npm run lint
npm run format:check
```

### Tooling

| Check                         | Tool                  |
| ----------------------------- | --------------------- |
| Lint (incl. type-aware rules) | `oxlint --type-aware` |
| Format                        | `oxfmt`               |
| Types                         | `tsc --noEmit`        |

### Test layers

| Layer       | Location             | Covers                                                                                               |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Unit        | `tests/unit/`        | options parsing, token math, threshold/crossing helpers, session usage                               |
| Integration | `tests/integration/` | `tui()` slot registration, notify wiring, dispose, multi-session                                     |
| E2E         | `tests/e2e/`         | package `./tui` contract, OpenCode `tui.json` load, full under→over→rearm scenario on the real entry |

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs **lint** (oxlint), **format** (oxfmt), **typecheck** (`tsc`), and **test** in parallel; **build** runs only if all four succeed.

## License

MIT
