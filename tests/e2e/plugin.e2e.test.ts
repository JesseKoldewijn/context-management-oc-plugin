import { spawn } from "node:child_process"
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { TuiPluginMeta } from "@opencode-ai/plugin/tui"
import { afterAll, describe, expect, it } from "vitest"
import { createMockApi, makeAssistant } from "../helpers/mock-api.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const meta = {
  id: "context-management.limit",
  source: "file",
  spec: root,
  target: join(root, "src/tui.tsx"),
  state: "first",
  first_time: 0,
  last_time: 0,
  time_changed: 0,
  load_count: 1,
  fingerprint: "e2e",
} as TuiPluginMeta

function assistantWithCost(cost: number) {
  return makeAssistant({
    cost,
    tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
  })
}

function run(
  command: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: opts.cwd ?? root,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    const timer = setTimeout(() => {
      child.kill("SIGTERM")
    }, opts.timeoutMs ?? 15_000)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolvePromise({ code, stdout, stderr })
    })
  })
}

describe("e2e package contract", () => {
  it("declares a ./tui export that points at the plugin entry", async () => {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      name: string
      exports: { "./tui": string }
      engines: { opencode: string }
    }
    expect(pkg.name).toBe("@jessekoldewijn/context-management-oc-plugin")
    expect(pkg.exports["./tui"]).toBe("./dist/tui.tsx")
    expect(pkg.engines.opencode).toMatch(/>=\s*1\.4\.3/)
    await access(join(root, "src/tui.tsx"))
  })

  it("loads the real plugin module through the package entry file", async () => {
    const mod = await import(pathToFileURL(join(root, "src/tui.tsx")).href)
    expect(mod.default.id).toBe("context-management.limit")
    expect(typeof mod.default.tui).toBe("function")
  })
})

describe("e2e OpenCode TUI config + plugin runtime", () => {
  const dirs: string[] = []

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it("OpenCode accepts a tui.json that references this plugin path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ctx-limit-e2e-"))
    dirs.push(dir)
    const configPath = join(dir, "tui.json")
    await writeFile(
      configPath,
      JSON.stringify({
        $schema: "https://opencode.ai/tui.json",
        plugin: [[root, { maxTokens: 1000, maxPercent: 50, maxCost: 10 }]],
      }),
      "utf8",
    )

    const result = await run("opencode", ["--print-logs", "--log-level", "DEBUG"], {
      cwd: dir,
      env: { OPENCODE_TUI_CONFIG: configPath },
      timeoutMs: 10_000,
    })
    const log = `${result.stdout}\n${result.stderr}`
    expect(log).toContain("loading tui config")
    expect(log).toContain(configPath)
    expect(log).not.toMatch(/invalid tui config|failed to parse tui/i)
  }, 20_000)

  it("drives a full under→over→rearm→over scenario on the real plugin entry", async () => {
    const mod = await import(pathToFileURL(join(root, "src/tui.tsx")).href)
    const mock = createMockApi({ contextWindow: 200 })
    await mod.default.tui(mock.api, { maxTokens: 100, maxPercent: 50, maxCost: 10 }, meta)

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 20, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(0)

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 120, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 10, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.removed", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    mock.state.messages = [
      makeAssistant({
        tokens: { input: 110, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      }),
    ]
    mock.emit("message.updated", { data: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(2)
    expect(mock.notify).toHaveBeenCalledTimes(2)

    expect(mock.register).toHaveBeenCalled()
    const [registration] = mock.register.mock.calls[0] as unknown as [
      {
        slots: {
          sidebar_content: (ctx: unknown, props: { session_id: string }) => unknown
          app_bottom: (ctx: unknown) => unknown
        }
      },
    ]
    expect(Object.keys(registration.slots).sort()).toEqual(["app_bottom", "sidebar_content"])
    const ctx = { theme: { current: mock.api.theme.current } }
    expect(() => registration.slots.sidebar_content(ctx, { session_id: "ses_1" })).toThrow(
      /No renderer found/,
    )
    expect(() => registration.slots.app_bottom(ctx)).toThrow(/No renderer found/)
  })

  it("drives a cost-only under-to-over-to-rearm lifecycle", async () => {
    const mod = await import(pathToFileURL(join(root, "src/tui.tsx")).href)
    const mock = createMockApi()
    await mod.default.tui(mock.api, { maxTokens: null, maxPercent: null, maxCost: 1 }, meta)

    mock.state.messages = [assistantWithCost(0.5)]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(0)

    mock.state.messages = [assistantWithCost(1)]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(1)

    mock.state.messages = [assistantWithCost(0)]
    mock.emit("message.removed", { properties: { sessionID: "ses_1" } })
    mock.state.messages = [assistantWithCost(1.25)]
    mock.emit("message.updated", { properties: { sessionID: "ses_1" } })
    expect(mock.toast).toHaveBeenCalledTimes(2)
  })
})
