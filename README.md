# Context Management OpenCode Plugin

OpenCode TUI plugin that shows your **configured context alert threshold** in the sidebar and bottom bar, and notifies you when usage reaches it. OpenCode’s built-in UI already shows live context progress — this plugin does not duplicate that.

```
Sidebar                  Bottom bar (app_bottom)
Limit                    limit · 100,000 tokens · 80% of context
100,000 tokens · 80% of context
```

## Features

- **Sidebar + bottom bar** — displays configured `maxTokens` and/or `maxPercent` (turns red when over)
- **Configurable limits** — absolute tokens and/or percent of the model context window
- **Toast + desktop notification** — once per threshold crossing (re-arms after usage drops, e.g. after `/compact`)

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
