export type PluginOptionsInput = Record<string, unknown> | undefined

export type NormalizedOptions = {
  /** Absolute token ceiling. `null` disables the absolute check. */
  maxTokens: number | null
  /** Percent of model context window. `null` disables the percent check. */
  maxPercent: number | null
}

export const DEFAULT_MAX_TOKENS = 100_000

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return value
}

/**
 * Parse plugin options from tui.json `[spec, options]`.
 *
 * - Omitting options → `{ maxTokens: 100000, maxPercent: null }`
 * - `maxTokens: null` / `false` → disable absolute threshold
 * - `maxPercent` set → enable percent threshold (0–100)
 */
export function normalizeOptions(input: PluginOptionsInput): NormalizedOptions {
  const raw = input ?? {}

  let maxTokens: number | null = DEFAULT_MAX_TOKENS
  if ("maxTokens" in raw) {
    if (raw.maxTokens === null || raw.maxTokens === false) {
      maxTokens = null
    } else {
      const n = asFiniteNumber(raw.maxTokens)
      if (n === undefined || n < 0) {
        maxTokens = DEFAULT_MAX_TOKENS
      } else {
        maxTokens = Math.floor(n)
      }
    }
  }

  let maxPercent: number | null = null
  if ("maxPercent" in raw && raw.maxPercent !== null && raw.maxPercent !== false) {
    const n = asFiniteNumber(raw.maxPercent)
    if (n !== undefined && n >= 0) {
      maxPercent = Math.min(100, n)
    }
  }

  return { maxTokens, maxPercent }
}
