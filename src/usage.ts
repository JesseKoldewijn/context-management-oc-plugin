import type { NormalizedOptions } from "./options.js"

export type TokenCounts = {
  input: number
  output: number
  reasoning: number
  cache: {
    read: number
    write: number
  }
}

export type UsageSnapshot = {
  tokens: number
  contextWindow: number
  percent: number
}

export type ThresholdHit = {
  over: boolean
  byTokens: boolean
  byPercent: boolean
}

export type CrossingDecision = {
  /** True when this update is a rising-edge crossing (under → over). */
  shouldNotify: boolean
  /** Next armed/over state to store for this session. */
  nextArmedOver: boolean
}

export function safeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0
  return value
}

/** Sum all token categories that contribute to context window fill. */
export function sumTokens(tokens: TokenCounts): number {
  return (
    safeNumber(tokens.input) +
    safeNumber(tokens.output) +
    safeNumber(tokens.reasoning) +
    safeNumber(tokens.cache?.read) +
    safeNumber(tokens.cache?.write)
  )
}

export function computeUsage(tokens: TokenCounts, contextWindow: number): UsageSnapshot {
  const used = sumTokens(tokens)
  const window = safeNumber(contextWindow)
  const percent = window > 0 ? Math.round((used / window) * 100) : 0
  return { tokens: used, contextWindow: window, percent }
}

export function evaluateThreshold(usage: UsageSnapshot, options: NormalizedOptions): ThresholdHit {
  const byTokens = options.maxTokens !== null && usage.tokens >= options.maxTokens
  const byPercent =
    options.maxPercent !== null && usage.contextWindow > 0 && usage.percent >= options.maxPercent
  return {
    over: byTokens || byPercent,
    byTokens,
    byPercent,
  }
}

/**
 * Once-per-crossing notify with re-arm when usage drops back under the limit.
 * `wasOver` is the previously stored armed-over state for this session.
 */
export function decideCrossing(wasOver: boolean, nowOver: boolean): CrossingDecision {
  if (nowOver && !wasOver) {
    return { shouldNotify: true, nextArmedOver: true }
  }
  if (!nowOver && wasOver) {
    return { shouldNotify: false, nextArmedOver: false }
  }
  return { shouldNotify: false, nextArmedOver: wasOver }
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

/** Human-readable configured threshold(s) for the sidebar (not live usage). */
export function formatThresholdLabel(options: NormalizedOptions): string {
  const parts: string[] = []
  if (options.maxTokens !== null) {
    parts.push(`${formatInt(options.maxTokens)} tokens`)
  }
  if (options.maxPercent !== null) {
    parts.push(`${options.maxPercent}% of context`)
  }
  return parts.length > 0 ? parts.join(" · ") : "none"
}

export function buildNotifyMessage(
  usage: UsageSnapshot,
  hit: ThresholdHit,
  options: NormalizedOptions,
): string {
  const parts: string[] = [`${formatInt(usage.tokens)} tokens used`]
  const reasons: string[] = []
  if (hit.byTokens && options.maxTokens !== null) {
    reasons.push(`maxTokens ${formatInt(options.maxTokens)}`)
  }
  if (hit.byPercent && options.maxPercent !== null) {
    reasons.push(`maxPercent ${options.maxPercent}%`)
  }
  if (reasons.length > 0) {
    parts.push(`(hit ${reasons.join(" and ")})`)
  }
  if (usage.contextWindow > 0) {
    parts.push(`— ${usage.percent}% of ${formatInt(usage.contextWindow)} context`)
  }
  return parts.join(" ")
}
