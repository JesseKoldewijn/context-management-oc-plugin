import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { NormalizedOptions } from "./options.js"
import { sessionIDFromEvent, usageForSession } from "./session.js"
import { buildNotifyMessage, decideCrossing, evaluateThreshold } from "./usage.js"

/**
 * Subscribe to message events and fire toast + desktop attention once per
 * threshold crossing (re-arms when usage drops back under the limit).
 */
export function wireNotifications(api: TuiPluginApi, options: NormalizedOptions): () => void {
  const armedOver = new Map<string, boolean>()

  const check = (sessionID: string) => {
    const usage = usageForSession(api, sessionID)
    const hit = evaluateThreshold(usage, options)
    const wasOver = armedOver.get(sessionID) ?? false
    const decision = decideCrossing(wasOver, hit.over)
    armedOver.set(sessionID, decision.nextArmedOver)

    if (!decision.shouldNotify) return

    const message = buildNotifyMessage(usage, hit, options)
    api.ui.toast({
      variant: "warning",
      title: "Context limit",
      message,
      duration: 8_000,
    })
    void api.attention.notify({
      title: "Context limit",
      message,
      notification: true,
      sound: { name: "default" },
    })
  }

  const unsubUpdated = api.event.on("message.updated", (event) => {
    const sessionID = sessionIDFromEvent(event)
    if (sessionID) check(sessionID)
  })

  const unsubRemoved = api.event.on("message.removed", (event) => {
    const sessionID = sessionIDFromEvent(event)
    if (sessionID) check(sessionID)
  })

  return () => {
    unsubUpdated()
    unsubRemoved()
  }
}
