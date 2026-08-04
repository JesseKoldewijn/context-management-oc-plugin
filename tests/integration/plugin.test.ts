import type { TuiPluginMeta } from "@opencode-ai/plugin/tui"
import { describe, expect, it, vi } from "vitest"
import { wireNotifications } from "../../src/notify.js"
import plugin, { tui } from "../../src/tui.js"
import { createMockApi, makeAssistant } from "../helpers/mock-api.js"

const meta = {
  id: "context-management.limit",
  source: "file",
  spec: "./src/tui.tsx",
  target: "./src/tui.tsx",
  state: "first",
  first_time: 0,
  last_time: 0,
  time_changed: 0,
  load_count: 1,
  fingerprint: "test",
} as TuiPluginMeta

function registeredSlots(register: ReturnType<typeof createMockApi>["register"]) {
  expect(register).toHaveBeenCalled()
  const [registration] = register.mock.calls[0] as unknown as [
    {
      order: number
      slots: {
        sidebar_content: (
          ctx: { theme: { current: unknown } },
          props: { session_id: string },
        ) => unknown
        app_bottom: (ctx: { theme: { current: unknown } }) => unknown
      }
    },
  ]
  return registration
}

describe("plugin module contract", () => {
  it("exports id and tui entry", () => {
    expect(plugin.id).toBe("context-management.limit")
    expect(typeof plugin.tui).toBe("function")
    expect(plugin).not.toHaveProperty("server")
  })
})

describe("tui() registration", () => {
  it("registers sidebar_content and app_bottom slots with order 100", async () => {
    const mock = createMockApi()
    await tui(mock.api, { maxTokens: 50_000, maxPercent: 80, maxCost: null }, meta)

    const registration = registeredSlots(mock.register)
    expect(registration.order).toBe(100)
    expect(Object.keys(registration.slots).sort()).toEqual(["app_bottom", "sidebar_content"])
    expect(typeof registration.slots.sidebar_content).toBe("function")
    expect(typeof registration.slots.app_bottom).toBe("function")
  })

  it("wires slot renderers that enter the OpenTUI JSX path", async () => {
    const mock = createMockApi()
    await tui(mock.api, undefined, meta)
    const registration = registeredSlots(mock.register)
    const ctx = { theme: { current: mock.api.theme.current } }
    // Outside a live TUI host there is no CliRenderer; proving we reach JSX is enough.
    expect(() => registration.slots.sidebar_content(ctx, { session_id: "ses_1" })).toThrow(
      /No renderer found/,
    )
    expect(() => registration.slots.app_bottom(ctx)).toThrow(/No renderer found/)
  })

  it("unsubscribes on dispose", async () => {
    const mock = createMockApi()
    await tui(mock.api, { maxTokens: 1, maxCost: null }, meta)
    expect(mock.disposeFns.length).toBe(1)

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 10, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    await mock.runDispose()
    mock.toast.mockClear()
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).not.toHaveBeenCalled()
  })
})

describe("wireNotifications integration", () => {
  it("toasts and notifies once on rising-edge maxTokens crossing", () => {
    const mock = createMockApi()
    const unsub = wireNotifications(mock.api, { maxTokens: 100, maxPercent: null, maxCost: null })

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 50, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).not.toHaveBeenCalled()

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 120, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)
    expect(mock.notify).toHaveBeenCalledTimes(1)
    const firstToast = mock.toast.mock.calls[0]?.[0] as
      | { variant?: string; title?: string; message?: string }
      | undefined
    expect(firstToast).toMatchObject({
      variant: "warning",
      title: "Context limit",
    })
    expect(String(firstToast?.message)).toContain("maxTokens")

    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    unsub()
  })

  it("notifies on maxPercent crossing via message.removed data shape", () => {
    const mock = createMockApi({ contextWindow: 200 })
    wireNotifications(mock.api, { maxTokens: null, maxPercent: 50, maxCost: null })

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 120, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.removed", { data: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)
    const toast = mock.toast.mock.calls[0]?.[0] as { message?: string } | undefined
    expect(String(toast?.message)).toContain("maxPercent")
  })

  it("re-arms after usage drops under the limit", () => {
    const mock = createMockApi()
    wireNotifications(mock.api, { maxTokens: 100, maxPercent: null, maxCost: null })

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 150, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 10, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 200, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(2)
    expect(mock.notify).toHaveBeenCalledTimes(2)
  })

  it("ignores events without a session id", () => {
    const mock = createMockApi()
    wireNotifications(mock.api, { maxTokens: 1, maxPercent: null, maxCost: null })
    mock.state.messages = [
      makeAssistant({
        tokens: { input: 10, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: {} })
    expect(mock.toast).not.toHaveBeenCalled()
  })

  it("tracks sessions independently", () => {
    const mock = createMockApi()
    wireNotifications(mock.api, { maxTokens: 100, maxPercent: null, maxCost: null })

    mock.state.messages = [
      makeAssistant({
        sessionID: "ses_a",
        tokens: { input: 150, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
      makeAssistant({
        sessionID: "ses_b",
        tokens: { input: 10, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]

    mock.emit("message.updated", { properties: { sessionID: "ses_a" } })
    mock.emit("message.updated", { properties: { sessionID: "ses_b" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)
  })

  it("notifies once for a cost-only crossing, then re-arms", () => {
    const mock = createMockApi()
    wireNotifications(mock.api, { maxTokens: null, maxPercent: null, maxCost: 1.5 })

    const setCost = (cost: number) => {
      mock.state.messages = [
        makeAssistant({
          cost,
          tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        }),
      ]
    }

    setCost(1.25)
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).not.toHaveBeenCalled()

    setCost(1.5)
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)
    const toast = mock.toast.mock.calls[0]?.[0] as { message?: string } | undefined
    expect(String(toast?.message)).toContain("maxCost")

    setCost(0.5)
    mock.emit("message.removed", { properties: { sessionID: "ses_1" } })
    setCost(2)
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(2)
  })

  it("combines cost with token and percent limits using OR logic", () => {
    const mock = createMockApi({ contextWindow: 200 })
    wireNotifications(mock.api, { maxTokens: 100, maxPercent: 90, maxCost: 10 })
    mock.state.messages = [
      makeAssistant({
        cost: 10,
        tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)
  })
})

describe("attention notify failure resilience", () => {
  it("still toasts if attention.notify rejects", async () => {
    const mock = createMockApi()
    mock.notify.mockRejectedValueOnce(new Error("attention disabled"))
    wireNotifications(mock.api, { maxTokens: 1, maxPercent: null, maxCost: null })
    mock.state.messages = [
      makeAssistant({
        tokens: { input: 5, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(mock.notify).toHaveBeenCalled())
  })
})
