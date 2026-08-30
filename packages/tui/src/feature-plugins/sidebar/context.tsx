import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, createResource, on, Show } from "solid-js"

const id = "internal:sidebar-context"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const emptyDescendantIDs: string[] = []

async function collectDescendantSessionIDs(input: {
  sessionID: string
  api: TuiPluginApi
  cache: Map<string, string[]>
}) {
  const { sessionID, api, cache } = input
  const seen = new Set<string>([sessionID])
  const ids: string[] = []
  const queue = [sessionID]

  while (queue.length > 0) {
    const parentID = queue.shift()!
    const working = (api.state.session.status(parentID)?.type ?? "idle") !== "idle"
    let childIDs = cache.get(parentID)
    if (childIDs === undefined || working) {
      try {
        const result = await api.client.session.children({ sessionID: parentID })
        childIDs = (result.data ?? []).map((child) => child.id)
        cache.set(parentID, childIDs)
      } catch {
        childIDs = cache.get(parentID) ?? []
      }
    }
    for (const childID of childIDs) {
      if (seen.has(childID)) continue
      seen.add(childID)
      ids.push(childID)
      queue.push(childID)
    }
  }

  return ids
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))
  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const cost = createMemo(() => session()?.cost ?? 0)

  const cache = createMemo(
    on(
      () => props.session_id,
      () => new Map<string, string[]>(),
    ),
  )

  const [descendantSessionIDs] = createResource(
    () => [props.session_id, msg().length] as const,
    async ([sessionID]) => collectDescendantSessionIDs({ sessionID, api: props.api, cache: cache() }),
    { initialValue: emptyDescendantIDs },
  )

  const hasSubagents = createMemo(() => (descendantSessionIDs()?.length ?? 0) > 0)

  const totalCost = createMemo(() => {
    const ids = descendantSessionIDs() ?? emptyDescendantIDs
    const subagentCost = ids.reduce((total, childID) => total + (props.api.state.session.get(childID)?.cost ?? 0), 0)
    return cost() + subagentCost
  })

  const state = createMemo(() => {
    const last = msg().findLast((item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0)
    if (!last) {
      return {
        tokens: 0,
        percent: null,
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = props.api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
    return {
      tokens,
      percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : null,
    }
  })

  return (
    <box>
      <text fg={theme().text}>
        <b>Context</b>
      </text>
      <text fg={theme().textMuted}>{state().tokens.toLocaleString()} tokens</text>
      <text fg={theme().textMuted}>{state().percent ?? 0}% used</text>
      <text fg={theme().textMuted}>{money.format(cost())} spent</text>
      <Show when={hasSubagents()}>
        <text fg={theme().textMuted}>{money.format(totalCost())} total (incl. subagents)</text>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
