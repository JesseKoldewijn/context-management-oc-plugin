import { describe, expect, it } from "vitest"
import {
  isSidebarVisible,
  isSidebarVisibleFromApi,
  readSidebarPreference,
  readTerminalWidth,
  SIDEBAR_WIDE_MIN_WIDTH,
} from "../../src/sidebar.js"
import { createMockApi } from "../helpers/mock-api.js"

describe("isSidebarVisible", () => {
  it("is hidden when preference is hide", () => {
    expect(isSidebarVisible("hide", 200)).toBe(false)
    expect(isSidebarVisible("hide", 80)).toBe(false)
  })

  it("is visible for auto preference only when terminal is wide", () => {
    expect(isSidebarVisible("auto", SIDEBAR_WIDE_MIN_WIDTH)).toBe(false)
    expect(isSidebarVisible("auto", SIDEBAR_WIDE_MIN_WIDTH + 1)).toBe(true)
    expect(isSidebarVisible("auto", 80)).toBe(false)
  })
})

describe("sidebar helpers from api", () => {
  it("reads preference and width from the plugin API", () => {
    const mock = createMockApi({ sidebar: "hide", terminalWidth: 160 })
    expect(readSidebarPreference(mock.api)).toBe("hide")
    expect(readTerminalWidth(mock.api)).toBe(160)
    expect(isSidebarVisibleFromApi(mock.api)).toBe(false)

    mock.state.sidebar = "auto"
    expect(isSidebarVisibleFromApi(mock.api)).toBe(true)

    mock.state.terminalWidth = 100
    expect(isSidebarVisibleFromApi(mock.api)).toBe(false)

    mock.state.terminalWidth = 0
    expect(readTerminalWidth(mock.api)).toBe(0)
  })
})
