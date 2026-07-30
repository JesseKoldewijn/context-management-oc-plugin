import { describe, expect, it } from "vitest"
import {
  buildNotifyMessage,
  computeUsage,
  decideCrossing,
  evaluateThreshold,
  formatInt,
  formatThresholdLabel,
  safeNumber,
  sumTokens,
} from "../../src/usage.js"

describe("safeNumber", () => {
  it("returns 0 for non-finite, negative, or non-number values", () => {
    expect(safeNumber(undefined)).toBe(0)
    expect(safeNumber("1")).toBe(0)
    expect(safeNumber(-3)).toBe(0)
    expect(safeNumber(Number.NaN)).toBe(0)
    expect(safeNumber(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it("returns finite non-negative numbers", () => {
    expect(safeNumber(0)).toBe(0)
    expect(safeNumber(12.5)).toBe(12.5)
  })
})

describe("sumTokens / computeUsage", () => {
  it("sums all token categories", () => {
    expect(
      sumTokens({
        input: 100,
        output: 20,
        reasoning: 5,
        cache: { read: 10, write: 2 },
      }),
    ).toBe(137)
  })

  it("treats missing/invalid cache fields as 0", () => {
    expect(
      sumTokens({
        input: 1,
        output: 1,
        reasoning: 1,
        cache: { read: -1, write: Number.NaN } as { read: number; write: number },
      }),
    ).toBe(3)
  })

  it("computes percent against context window", () => {
    const usage = computeUsage(
      { input: 80, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
      200,
    )
    expect(usage).toEqual({ tokens: 100, contextWindow: 200, percent: 50 })
  })

  it("returns 0 percent when context window unknown", () => {
    expect(
      computeUsage({ input: 10, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, 0).percent,
    ).toBe(0)
  })

  it("rounds percent to nearest integer", () => {
    expect(
      computeUsage({ input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }, 3).percent,
    ).toBe(33)
  })
})

describe("evaluateThreshold", () => {
  const usage = { tokens: 100_000, contextWindow: 200_000, percent: 50 }

  it("hits maxTokens when at or above absolute limit", () => {
    expect(evaluateThreshold(usage, { maxTokens: 100_000, maxPercent: null })).toEqual({
      over: true,
      byTokens: true,
      byPercent: false,
    })
  })

  it("hits maxPercent when at or above percent limit", () => {
    expect(evaluateThreshold(usage, { maxTokens: null, maxPercent: 50 })).toEqual({
      over: true,
      byTokens: false,
      byPercent: true,
    })
  })

  it("reports both when both limits are crossed", () => {
    expect(
      evaluateThreshold(
        { tokens: 180_000, contextWindow: 200_000, percent: 90 },
        { maxTokens: 100_000, maxPercent: 80 },
      ),
    ).toEqual({ over: true, byTokens: true, byPercent: true })
  })

  it("hits when either limit is crossed", () => {
    const hit = evaluateThreshold(usage, { maxTokens: 90_000, maxPercent: 80 })
    expect(hit.over).toBe(true)
    expect(hit.byTokens).toBe(true)
    expect(hit.byPercent).toBe(false)
  })

  it("is under when below all configured limits", () => {
    expect(evaluateThreshold(usage, { maxTokens: 150_000, maxPercent: 80 }).over).toBe(false)
  })

  it("ignores percent when context window is unknown", () => {
    expect(
      evaluateThreshold(
        { tokens: 50, contextWindow: 0, percent: 0 },
        { maxTokens: null, maxPercent: 10 },
      ).over,
    ).toBe(false)
  })

  it("is under when no limits are configured", () => {
    expect(evaluateThreshold(usage, { maxTokens: null, maxPercent: null }).over).toBe(false)
  })
})

describe("decideCrossing", () => {
  it("notifies only on rising edge", () => {
    expect(decideCrossing(false, true)).toEqual({ shouldNotify: true, nextArmedOver: true })
    expect(decideCrossing(true, true)).toEqual({ shouldNotify: false, nextArmedOver: true })
  })

  it("re-arms when usage drops under the limit", () => {
    expect(decideCrossing(true, false)).toEqual({ shouldNotify: false, nextArmedOver: false })
    expect(decideCrossing(false, false)).toEqual({ shouldNotify: false, nextArmedOver: false })
  })
})

describe("format helpers", () => {
  it("formats threshold labels from config only", () => {
    expect(formatInt(12_847)).toBe("12,847")
    expect(formatThresholdLabel({ maxTokens: 100_000, maxPercent: null })).toBe("100,000 tokens")
    expect(formatThresholdLabel({ maxTokens: 100_000, maxPercent: 80 })).toBe(
      "100,000 tokens · 80% of context",
    )
    expect(formatThresholdLabel({ maxTokens: null, maxPercent: 90 })).toBe("90% of context")
    expect(formatThresholdLabel({ maxTokens: null, maxPercent: null })).toBe("none")
  })

  it("builds notify message with hit reasons", () => {
    const msg = buildNotifyMessage(
      { tokens: 100_000, contextWindow: 200_000, percent: 50 },
      { over: true, byTokens: true, byPercent: false },
      { maxTokens: 100_000, maxPercent: null },
    )
    expect(msg).toContain("100,000 tokens used")
    expect(msg).toContain("maxTokens 100,000")
    expect(msg).toContain("50% of 200,000 context")
  })

  it("includes both reasons and omits context when window unknown", () => {
    const msg = buildNotifyMessage(
      { tokens: 10, contextWindow: 0, percent: 0 },
      { over: true, byTokens: true, byPercent: true },
      { maxTokens: 5, maxPercent: 80 },
    )
    expect(msg).toContain("maxTokens 5")
    expect(msg).toContain("maxPercent 80%")
    expect(msg).not.toContain("of")
  })

  it("omits reason clause when hit flags are empty", () => {
    const msg = buildNotifyMessage(
      { tokens: 1, contextWindow: 100, percent: 1 },
      { over: false, byTokens: false, byPercent: false },
      { maxTokens: 100, maxPercent: null },
    )
    expect(msg).toBe("1 tokens used — 1% of 100 context")
  })
})
