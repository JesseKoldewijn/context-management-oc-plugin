import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

/** Matches OpenCode session route: sidebar shows when preference is auto and terminal is wide. */
export const SIDEBAR_WIDE_MIN_WIDTH = 120

export type SidebarPreference = "auto" | "hide"

/**
 * Approximate OpenCode's `sidebarVisible` for plugins.
 * Uses persisted `kv` preference `"sidebar"` + terminal width.
 * (Narrow-terminal overlay open state is not exposed to plugins.)
 */
export function readSidebarPreference(api: TuiPluginApi): SidebarPreference {
  const value: unknown = api.kv.get("sidebar", "auto")
  return value === "hide" ? "hide" : "auto"
}

export function readTerminalWidth(api: TuiPluginApi): number {
  const renderer = api.renderer as { terminalWidth?: number; width?: number }
  const width = renderer.terminalWidth ?? renderer.width
  return typeof width === "number" && Number.isFinite(width) && width > 0 ? width : 0
}

export function isSidebarVisible(
  preference: SidebarPreference,
  terminalWidth: number,
  wideMinWidth: number = SIDEBAR_WIDE_MIN_WIDTH,
): boolean {
  if (preference === "hide") return false
  return terminalWidth > wideMinWidth
}

export function isSidebarVisibleFromApi(api: TuiPluginApi): boolean {
  return isSidebarVisible(readSidebarPreference(api), readTerminalWidth(api))
}
