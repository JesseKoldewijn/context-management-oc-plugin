import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { NormalizedOptions } from "./options.js"
import { formatThresholdLabel } from "./usage.js"

export type LimitThemeColors = Pick<TuiThemeCurrent, "text" | "textMuted" | "error">

export function limitLabelColor(over: boolean, theme: LimitThemeColors) {
  return over ? theme.error : theme.textMuted
}

export function sidebarLimitModel(
  options: NormalizedOptions,
  over: boolean,
  theme: LimitThemeColors,
) {
  return {
    title: "Limit" as const,
    label: formatThresholdLabel(options),
    color: limitLabelColor(over, theme),
  }
}

export function bottomBarLimitModel(
  options: NormalizedOptions,
  over: boolean,
  theme: LimitThemeColors,
) {
  return {
    label: `limit · ${formatThresholdLabel(options)}`,
    color: limitLabelColor(over, theme),
  }
}
