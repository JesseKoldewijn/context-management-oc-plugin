import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Message } from "@opencode-ai/sdk/v2"
import type { NormalizedOptions } from "./options.js"
import { computeUsage, evaluateThreshold, type UsageSnapshot } from "./usage.js"

export function isAssistantMessage(m: Message): m is AssistantMessage {
  return m.role === "assistant"
}

export function lastAssistantWithOutput(
  messages: readonly Message[],
): AssistantMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (isAssistantMessage(m) && m.tokens.output > 0) return m
  }
  return undefined
}

export function usageForSession(api: TuiPluginApi, sessionID: string): UsageSnapshot {
  const messages = api.state.session.messages(sessionID)
  const last = lastAssistantWithOutput(messages)
  if (!last) return { tokens: 0, contextWindow: 0, percent: 0, cost: 0 }

  const model =
    api.state.provider.find((item) => item.id === last.providerID)?.models?.[last.modelID] ?? null
  const contextWindow =
    typeof model?.limit?.context === "number" && Number.isFinite(model.limit.context)
      ? model.limit.context
      : 0

  return computeUsage(last.tokens, contextWindow, last.cost)
}

export function activeSessionID(api: TuiPluginApi): string | undefined {
  const route = api.route.current
  if (route.name === "session" && route.params && typeof route.params.sessionID === "string") {
    return route.params.sessionID
  }
  return undefined
}

export function isOverLimit(
  api: TuiPluginApi,
  options: NormalizedOptions,
  sessionID?: string,
): boolean {
  const id = sessionID ?? activeSessionID(api)
  if (!id) return false
  return evaluateThreshold(usageForSession(api, id), options).over
}

export function sessionIDFromEvent(event: {
  properties?: { sessionID?: string }
  data?: { sessionID?: string }
}): string | undefined {
  return event.properties?.sessionID ?? event.data?.sessionID
}
