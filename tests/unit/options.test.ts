import { describe, expect, it } from "vitest"
import { DEFAULT_MAX_TOKENS, normalizeOptions } from "../../src/options.js"

describe("normalizeOptions", () => {
  it("defaults to maxTokens 100000 with no percent", () => {
    expect(normalizeOptions(undefined)).toEqual({
      maxTokens: DEFAULT_MAX_TOKENS,
      maxPercent: null,
      maxCost: null,
    })
    expect(normalizeOptions({})).toEqual({
      maxTokens: 100_000,
      maxPercent: null,
      maxCost: null,
    })
  })

  it("accepts custom maxTokens and maxPercent", () => {
    expect(normalizeOptions({ maxTokens: 50_000, maxPercent: 80 })).toEqual({
      maxTokens: 50_000,
      maxPercent: 80,
      maxCost: null,
    })
  })

  it("disables maxTokens when null or false", () => {
    expect(normalizeOptions({ maxTokens: null, maxPercent: 90 }).maxTokens).toBeNull()
    expect(normalizeOptions({ maxTokens: false }).maxTokens).toBeNull()
  })

  it("treats maxPercent null/false as disabled", () => {
    expect(normalizeOptions({ maxPercent: null }).maxPercent).toBeNull()
    expect(normalizeOptions({ maxPercent: false }).maxPercent).toBeNull()
  })

  it("accepts decimal maxCost and disables it with null or false", () => {
    expect(normalizeOptions({ maxCost: 12.345678 })).toEqual({
      maxTokens: DEFAULT_MAX_TOKENS,
      maxPercent: null,
      maxCost: 12.345678,
    })
    expect(normalizeOptions({ maxCost: null }).maxCost).toBeNull()
    expect(normalizeOptions({ maxCost: false }).maxCost).toBeNull()
  })

  it("ignores invalid maxCost values", () => {
    expect(normalizeOptions({ maxCost: "nope" }).maxCost).toBeNull()
    expect(normalizeOptions({ maxCost: -1 }).maxCost).toBeNull()
    expect(normalizeOptions({ maxCost: Number.NaN }).maxCost).toBeNull()
    expect(normalizeOptions({ maxCost: Number.POSITIVE_INFINITY }).maxCost).toBeNull()
  })

  it("ignores invalid maxPercent values", () => {
    expect(normalizeOptions({ maxPercent: "nope" }).maxPercent).toBeNull()
    expect(normalizeOptions({ maxPercent: -5 }).maxPercent).toBeNull()
    expect(normalizeOptions({ maxPercent: Number.NaN }).maxPercent).toBeNull()
  })

  it("clamps maxPercent to 100 and floors maxTokens", () => {
    expect(normalizeOptions({ maxTokens: 1000.9, maxPercent: 150 })).toEqual({
      maxTokens: 1000,
      maxPercent: 100,
      maxCost: null,
    })
  })

  it("allows maxTokens 0 as an explicit absolute limit", () => {
    expect(normalizeOptions({ maxTokens: 0 })).toEqual({
      maxTokens: 0,
      maxPercent: null,
      maxCost: null,
    })
  })

  it("falls back to default for invalid maxTokens", () => {
    expect(normalizeOptions({ maxTokens: -1 }).maxTokens).toBe(DEFAULT_MAX_TOKENS)
    expect(normalizeOptions({ maxTokens: "nope" }).maxTokens).toBe(DEFAULT_MAX_TOKENS)
    expect(normalizeOptions({ maxTokens: Number.POSITIVE_INFINITY }).maxTokens).toBe(
      DEFAULT_MAX_TOKENS,
    )
  })
})
