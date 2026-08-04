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
    expect(usage).toEqual({ tokens: 100, contextWindow: 200, percent: 50, cost: 0 })
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
  const usage = { tokens: 100_000, contextWindow: 200_000, percent: 50, cost: 12.5 }

  it("hits maxTokens when at or above absolute limit", () => {
    expect(
      evaluateThreshold(usage, { maxTokens: 100_000, maxPercent: null, maxCost: null }),
    ).toEqual({
      over: true,
      byTokens: true,
      byPercent: false,
      byCost: false,
    })
  })

  it("hits maxPercent when at or above percent limit", () => {
    expect(evaluateThreshold(usage, { maxTokens: null, maxPercent: 50, maxCost: null })).toEqual({
      over: true,
      byTokens: false,
      byPercent: true,
      byCost: false,
    })
  })

  it("reports both when both limits are crossed", () => {
    expect(
      evaluateThreshold(
        { tokens: 180_000, contextWindow: 200_000, percent: 90, cost: 12.5 },
        { maxTokens: 100_000, maxPercent: 80, maxCost: 20 },
      ),
    ).toEqual({ over: true, byTokens: true, byPercent: true, byCost: false })
  })

  it("hits maxCost at or above the configured cost", () => {
    expect(evaluateThreshold(usage, { maxTokens: null, maxPercent: null, maxCost: 12.5 })).toEqual({
      over: true,
      byTokens: false,
      byPercent: false,
      byCost: true,
    })
  })

  it("hits when either limit is crossed", () => {
    const hit = evaluateThreshold(usage, { maxTokens: 90_000, maxPercent: 80, maxCost: 20 })
    expect(hit.over).toBe(true)
    expect(hit.byTokens).toBe(true)
    expect(hit.byPercent).toBe(false)
    expect(hit.byCost).toBe(false)
  })

  it("is under when below all configured limits", () => {
    expect(evaluateThreshold(usage, { maxTokens: 150_000, maxPercent: 80, maxCost: 20 }).over).toBe(
      false,
    )
  })

  it("ignores percent when context window is unknown", () => {
    expect(
      evaluateThreshold(
        { tokens: 50, contextWindow: 0, percent: 0, cost: 0 },
        { maxTokens: null, maxPercent: 10, maxCost: null },
      ).over,
    ).toBe(false)
  })

  it("is under when no limits are configured", () => {
    expect(
      evaluateThreshold(usage, { maxTokens: null, maxPercent: null, maxCost: null }).over,
    ).toBe(false)
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
    expect(formatThresholdLabel({ maxTokens: 100_000, maxPercent: null, maxCost: null })).toBe(
      "100,000 tokens",
    )
    expect(formatThresholdLabel({ maxTokens: 100_000, maxPercent: 80, maxCost: 1.25 })).toBe(
      "100,000 tokens · 80% of context · $1.25 cost",
    )
    expect(formatThresholdLabel({ maxTokens: null, maxPercent: 90, maxCost: null })).toBe(
      "90% of context",
    )
    expect(formatThresholdLabel({ maxTokens: null, maxPercent: null, maxCost: null })).toBe("none")
  })

  it("builds notify message with hit reasons", () => {
    const msg = buildNotifyMessage(
      { tokens: 100_000, contextWindow: 200_000, percent: 50, cost: 1.25 },
      { over: true, byTokens: true, byPercent: false, byCost: false },
      { maxTokens: 100_000, maxPercent: null, maxCost: null },
    )
    expect(msg).toContain("100,000 tokens used")
    expect(msg).toContain("$1.25 cost used")
    expect(msg).toContain("maxTokens 100,000")
    expect(msg).toContain("50% of 200,000 context")
  })

  it("includes both reasons and omits context when window unknown", () => {
    const msg = buildNotifyMessage(
      { tokens: 10, contextWindow: 0, percent: 0, cost: 2.5 },
      { over: true, byTokens: true, byPercent: true, byCost: true },
      { maxTokens: 5, maxPercent: 80, maxCost: 2.5 },
    )
    expect(msg).toContain("maxTokens 5")
    expect(msg).toContain("maxPercent 80%")
    expect(msg).toContain("maxCost $2.50")
    expect(msg).not.toContain("of")
  })

  it("omits reason clause when hit flags are empty", () => {
    const msg = buildNotifyMessage(
      { tokens: 1, contextWindow: 100, percent: 1, cost: 0 },
      { over: false, byTokens: false, byPercent: false, byCost: false },
      { maxTokens: 100, maxPercent: null, maxCost: null },
    )
    expect(msg).toBe("1 tokens used $0.00 cost used — 1% of 100 context")
  })
})
