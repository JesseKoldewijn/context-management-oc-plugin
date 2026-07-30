import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Message } from "@opencode-ai/sdk/v2"
import { vi } from "vitest"

export type MockSessionState = {
  messages: Message[]
  routeName: "home" | "session"
  sessionID: string
  contextWindow: number
}

export function makeAssistant(partial: {
  id?: string
  sessionID?: string
  tokens: AssistantMessage["tokens"]
  providerID?: string
  modelID?: string
}): AssistantMessage {
  return {
    id: partial.id ?? "msg_1",
    sessionID: partial.sessionID ?? "ses_1",
    role: "assistant",
    time: { created: Date.now() },
    parentID: "user_1",
    modelID: partial.modelID ?? "test-model",
    providerID: partial.providerID ?? "test-provider",
    mode: "build",
    agent: "build",
    path: { cwd: "/tmp", root: "/tmp" },
    cost: 0,
    tokens: partial.tokens,
  }
}

export function createMockApi(initial?: Partial<MockSessionState>) {
  const state: MockSessionState = {
    messages: [],
    routeName: "session",
    sessionID: "ses_1",
    contextWindow: 200_000,
    ...initial,
  }

  const handlers = new Map<string, Set<(event: unknown) => void>>()
  const disposeFns: Array<() => void | Promise<void>> = []
  const toast = vi.fn()
  const notify = vi.fn(async () => ({
    ok: true,
    notification: true,
    sound: true,
  }))
  const register = vi.fn(() => "context-management.limit")

  const api = {
    route: {
      get current() {
        if (state.routeName === "session") {
          return { name: "session" as const, params: { sessionID: state.sessionID } }
        }
        return { name: "home" as const }
      },
      register: vi.fn(),
      navigate: vi.fn(),
    },
    state: {
      ready: true,
      config: {},
      provider: [
        {
          id: "test-provider",
          models: {
            "test-model": {
              id: "test-model",
              limit: { context: state.contextWindow },
            },
          },
        },
      ],
      path: { state: "", config: "", worktree: "", directory: "/tmp" },
      vcs: undefined,
      session: {
        count: () => 1,
        get: () => undefined,
        diff: () => [],
        todo: () => [],
        messages: (sessionID: string) =>
          state.messages.filter((m) => ("sessionID" in m ? m.sessionID === sessionID : true)),
        status: () => undefined,
        permission: () => [],
        question: () => [],
      },
      part: () => [],
      lsp: () => [],
      mcp: () => [],
    },
    ui: {
      toast,
      dialog: {
        replace: vi.fn(),
        clear: vi.fn(),
        setSize: vi.fn(),
        size: "medium",
        depth: 0,
        open: false,
      },
      Dialog: vi.fn(),
      DialogAlert: vi.fn(),
      DialogConfirm: vi.fn(),
      DialogPrompt: vi.fn(),
      DialogSelect: vi.fn(),
      Slot: vi.fn(),
      Prompt: vi.fn(),
    },
    attention: {
      notify,
      soundboard: {
        registerPack: vi.fn(),
        activate: vi.fn(),
        current: () => "opencode.default",
        list: () => [],
      },
    },
    event: {
      on: (type: string, handler: (event: unknown) => void) => {
        let set = handlers.get(type)
        if (!set) {
          set = new Set()
          handlers.set(type, set)
        }
        set.add(handler)
        return () => handlers.get(type)?.delete(handler)
      },
    },
    slots: { register },
    lifecycle: {
      signal: new AbortController().signal,
      onDispose: (fn: () => void | Promise<void>) => {
        disposeFns.push(fn)
        return () => {
          const i = disposeFns.indexOf(fn)
          if (i >= 0) disposeFns.splice(i, 1)
        }
      },
    },
    theme: {
      current: {
        text: "text",
        textMuted: "muted",
        error: "error",
        warning: "warning",
        accent: "accent",
      },
      selected: "default",
      has: () => true,
      set: () => true,
      install: async () => {},
      mode: () => "dark" as const,
      ready: true,
    },
  } as unknown as TuiPluginApi

  return {
    api,
    state,
    toast,
    notify,
    register,
    disposeFns,
    emit(type: string, event: unknown) {
      for (const handler of handlers.get(type) ?? []) handler(event)
    },
    async runDispose() {
      for (const fn of disposeFns) await fn()
    },
  }
}
