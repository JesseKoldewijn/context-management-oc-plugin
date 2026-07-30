import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import { describe, expect, it } from "vitest"
import { bottomBarLimitModel, limitLabelColor, sidebarLimitModel } from "../../src/view-model.js"

const theme = {
  text: "text",
  textMuted: "muted",
  error: "error",
} as unknown as Pick<TuiThemeCurrent, "text" | "textMuted" | "error">

describe("view-model", () => {
  it("uses error color when over and muted when under", () => {
    expect(limitLabelColor(true, theme)).toBe("error")
    expect(limitLabelColor(false, theme)).toBe("muted")
  })

  it("builds sidebar limit model from options", () => {
    expect(sidebarLimitModel({ maxTokens: 100_000, maxPercent: 80 }, false, theme)).toEqual({
      title: "Limit",
      label: "100,000 tokens · 80% of context",
      color: "muted",
    })
    expect(sidebarLimitModel({ maxTokens: 100_000, maxPercent: null }, true, theme).color).toBe(
      "error",
    )
  })

  it("builds bottom-bar model with limit prefix", () => {
    expect(bottomBarLimitModel({ maxTokens: null, maxPercent: 90 }, false, theme)).toEqual({
      label: "limit · 90% of context",
      color: "muted",
    })
  })
})
