# Context Management OpenCode Plugin

[![CI](https://img.shields.io/github/actions/workflow/status/JesseKoldewijn/context-management-oc-plugin/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/JesseKoldewijn/context-management-oc-plugin/actions/workflows/ci.yml)
[![GitHub Packages](https://img.shields.io/npm/v/@jessekoldewijn/context-management-oc-plugin?registry_uri=https%3A%2F%2Fnpm.pkg.github.com&label=GitHub%20Packages&style=flat-square)](https://github.com/JesseKoldewijn/context-management-oc-plugin/pkgs/npm/context-management-oc-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

Set a **context alert threshold** for OpenCode and get notified when you cross it. OpenCode already shows live context usage — this plugin adds your configured limit in the UI and alerts you when you hit it.

## Getting started

Requires OpenCode >= 1.4.3 (TUI plugin system).

### 1. Install from GitHub Packages

Configure npm to use GitHub Packages for this scope (once per machine). Use a GitHub personal access token with `read:packages`:

```bash
# ~/.npmrc
@jessekoldewijn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Then install:

```bash
npm install -g @jessekoldewijn/context-management-oc-plugin
```

Alternatively, install straight from the git repo (no Packages auth):

```bash
npm install -g github:JesseKoldewijn/context-management-oc-plugin
```

### 2. Enable it in OpenCode

Add the plugin to your TUI config (`~/.config/opencode/tui.json` on macOS/Linux, `%APPDATA%\opencode\tui.json` on Windows):

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "@jessekoldewijn/context-management-oc-plugin",
      {
        "maxTokens": 100000,
        "maxPercent": 80,
      },
    ],
  ],
}
```

This is a **TUI plugin** — it belongs in `tui.json`, not `opencode.json`.

### 3. Restart OpenCode

Open a session. You should see **Limit** in the sidebar and a compact `limit · …` line in the bottom bar (when the sidebar is closed).

## Options

| Option       | Default  | Description                                                  |
| ------------ | -------- | ------------------------------------------------------------ |
| `maxTokens`  | `100000` | Absolute token ceiling. Set to `null` or `false` to disable. |
| `maxPercent` | unset    | Percent of model context window (0–100). Omit to disable.    |

Omit options entirely to use **maxTokens: 100000** only. Notification fires when **any** enabled limit is reached.

- **`maxTokens`** — hard ceiling independent of the model (good for cost budgets)
- **`maxPercent`** — scales with each model's context window (good when you switch models)
- Use both together if you want either condition to alert you

### Desktop notifications

Toasts always work. Desktop attention also needs:

```jsonc
{
  "attention": {
    "enabled": true,
    "notifications": true,
    "sound": true,
  },
}
```

## How it works

```text
Sidebar           Bottom bar (when sidebar is closed)
─────────         ──────────────
Limit             limit · 100,000 tokens · 80% of context
100,000 tokens
· 80% of context
```

When you cross the limit, the label turns red and you get a toast (plus a desktop notification if attention is enabled). Alerts fire **once per crossing** — after `/compact` drops you back under the limit, the next crossing can notify again.

## Updating

```bash
npm install -g @jessekoldewijn/context-management-oc-plugin@latest
```

Or from git:

```bash
npm install -g github:JesseKoldewijn/context-management-oc-plugin
```

Then restart OpenCode.

## Development

For contributors working from a clone:

```bash
npm install
npm run build
npm test                 # unit + integration + e2e
npm run test:coverage
npm run check            # lint + format + typecheck
```

Point `tui.json` at your local checkout while developing:

```jsonc
{
  "plugin": [["/absolute/path/to/context-management-oc-plugin", { "maxTokens": 100000 }]],
}
```

Run `npm run build` after source changes so OpenCode loads `dist/`.

## License

[MIT](./LICENSE)
