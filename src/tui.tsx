/** @jsxImportSource @opentui/solid */

import type {
  TuiPlugin,
  TuiPluginApi,
  TuiPluginModule,
  TuiThemeCurrent,
} from "@opencode-ai/plugin/tui"
import { TextAttributes } from "@opentui/core"
import { createMemo } from "solid-js"
import { wireNotifications } from "./notify.js"
import { normalizeOptions, type NormalizedOptions } from "./options.js"
import { isOverLimit } from "./session.js"
import { bottomBarLimitModel, sidebarLimitModel } from "./view-model.js"

/** Sidebar: configured alert threshold only (OpenCode already shows context progress). */
export function SidebarLimit(props: {
  api: TuiPluginApi
  sessionID: string
  theme: TuiThemeCurrent
  options: NormalizedOptions
}) {
  const model = createMemo(() =>
    sidebarLimitModel(
      props.options,
      isOverLimit(props.api, props.options, props.sessionID),
      props.theme,
    ),
  )

  return (
    <box>
      <text fg={props.theme.text} attributes={TextAttributes.BOLD}>
        {model().title}
      </text>
      <text fg={model().color}>{model().label}</text>
    </box>
  )
}

/** Bottom bar (`app_bottom`): compact one-line configured threshold. */
export function BottomBarLimit(props: {
  api: TuiPluginApi
  theme: TuiThemeCurrent
  options: NormalizedOptions
}) {
  const model = createMemo(() =>
    bottomBarLimitModel(props.options, isOverLimit(props.api, props.options), props.theme),
  )

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={model().color} wrapMode="none">
        {model().label}
      </text>
    </box>
  )
}

export const tui: TuiPlugin = async (api, options) => {
  const normalized = normalizeOptions(options)

  const unsub = wireNotifications(api, normalized)
  api.lifecycle.onDispose(() => {
    unsub()
  })

  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(ctx, props) {
        return (
          <SidebarLimit
            api={api}
            sessionID={props.session_id}
            theme={ctx.theme.current}
            options={normalized}
          />
        )
      },
      app_bottom(ctx) {
        return <BottomBarLimit api={api} theme={ctx.theme.current} options={normalized} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "context-management.limit",
  tui,
}

export default plugin
