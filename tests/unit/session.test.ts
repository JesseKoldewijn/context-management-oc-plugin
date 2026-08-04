import { describe, expect, it } from "vitest"
import {
  activeSessionID,
  isAssistantMessage,
  isOverLimit,
  lastAssistantWithOutput,
  sessionIDFromEvent,
  usageForSession,
} from "../../src/session.js"
import { createMockApi, makeAssistant } from "../helpers/mock-api.js"

describe("message helpers", () => {
  it("detects assistant messages", () => {
    expect(isAssistantMessage(makeAssistant({ tokens: emptyTokens(1) }))).toBe(true)
    expect(
      isAssistantMessage({
        id: "u1",
        sessionID: "ses_1",
        role: "user",
        time: { created: 1 },
        agent: "build",
        model: { providerID: "p", modelID: "m" },
        path: { cwd: "/tmp", root: "/tmp" },
      } as never),
    ).toBe(false)
  })

  it("finds the last assistant message with output tokens", () => {
    const messages = [
      makeAssistant({ id: "a1", tokens: emptyTokens(0) }),
      makeAssistant({
        id: "a2",
        tokens: { input: 10, output: 2, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
      makeAssistant({ id: "a3", tokens: emptyTokens(0) }),
    ]
    expect(lastAssistantWithOutput(messages)?.id).toBe("a2")
    expect(lastAssistantWithOutput([])).toBeUndefined()
  })
})

describe("usageForSession", () => {
  it("returns zeros when no qualifying assistant message exists", () => {
    const { api } = createMockApi({ messages: [] })
    expect(usageForSession(api, "ses_1")).toEqual({
      tokens: 0,
      contextWindow: 0,
      percent: 0,
      cost: 0,
    })
  })

  it("sums tokens and resolves model context window", () => {
    const { api } = createMockApi({
      messages: [
        makeAssistant({
          tokens: { input: 90, output: 10, reasoning: 0, cache: { read: 0, write: 0 } },
          cost: 1.2345,
        }),
      ],
      contextWindow: 200,
    })
    // recreate provider with updated context — mock uses initial contextWindow in provider object
    expect(usageForSession(api, "ses_1").tokens).toBe(100)
    expect(usageForSession(api, "ses_1").contextWindow).toBe(200)
    expect(usageForSession(api, "ses_1").percent).toBe(50)
    expect(usageForSession(api, "ses_1").cost).toBe(1.2345)
  })

  it("uses 0 context window when model is missing", () => {
    const { api, state } = createMockApi({
      messages: [
        makeAssistant({
          providerID: "missing",
          tokens: { input: 5, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        }),
      ],
    })
    expect(usageForSession(api, state.sessionID)).toEqual({
      tokens: 6,
      contextWindow: 0,
      percent: 0,
      cost: 0,
    })
  })

  it("sanitizes missing, invalid, and negative message costs", () => {
    for (const cost of [undefined, Number.NaN, -1]) {
      const { api } = createMockApi({
        messages: [
          makeAssistant({
            cost,
            tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
          }),
        ],
      })
      expect(usageForSession(api, "ses_1").cost).toBe(0)
    }
  })
})

describe("activeSessionID / isOverLimit / sessionIDFromEvent", () => {
  it("reads session id from the current route", () => {
    const mock = createMockApi({ routeName: "session", sessionID: "ses_abc" })
    expect(activeSessionID(mock.api)).toBe("ses_abc")
    mock.state.routeName = "home"
    expect(activeSessionID(mock.api)).toBeUndefined()
  })

  it("detects over-limit for an explicit or active session", () => {
    const mock = createMockApi({
      messages: [
        makeAssistant({
          tokens: { input: 150_000, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        }),
      ],
    })
    expect(
      isOverLimit(mock.api, { maxTokens: 100_000, maxPercent: null, maxCost: null }, "ses_1"),
    ).toBe(true)
    expect(isOverLimit(mock.api, { maxTokens: 100_000, maxPercent: null, maxCost: null })).toBe(
      true,
    )
    mock.state.routeName = "home"
    expect(isOverLimit(mock.api, { maxTokens: 100_000, maxPercent: null, maxCost: null })).toBe(
      false,
    )
  })

  it("extracts sessionID from properties or data event shapes", () => {
    expect(sessionIDFromEvent({ properties: { sessionID: "a" } })).toBe("a")
    expect(sessionIDFromEvent({ data: { sessionID: "b" } })).toBe("b")
    expect(sessionIDFromEvent({})).toBeUndefined()
  })
})

function emptyTokens(output: number) {
  return { input: 0, output, reasoning: 0, cache: { read: 0, write: 0 } }
}
