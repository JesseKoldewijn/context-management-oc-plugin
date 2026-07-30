#!/usr/bin/env node
import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(join(root, "src"), dist, { recursive: true })

const stamp = {
  builtAt: new Date().toISOString(),
  entry: "./dist/tui.tsx",
}
await writeFile(join(dist, "build.json"), `${JSON.stringify(stamp, null, 2)}\n`)

console.log("build ok → dist/ (OpenCode loads ./tui → dist/tui.tsx)")
