import { createMemo, createResource, on, type Accessor } from "solid-js"
import { useSync, type DirectorySync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

const emptyDescendantIDs: string[] = []

async function collectDescendantSessionIDs(input: {
  sessionID: string
  client: OpencodeClient
  remember: DirectorySync["session"]["remember"]
  isWorking: (sessionID: string) => boolean
  cache: Map<string, string[]>
}) {
  const { sessionID, client, remember, isWorking, cache } = input
  const seen = new Set<string>([sessionID])
  const ids: string[] = []
  const queue = [sessionID]

  while (queue.length > 0) {
    const parentID = queue.shift()!
    // A parent still generating (root session, or a subagent that may itself spawn
    // further subagents) can gain children at any time, so keep re-checking it.
    // A parent that has gone idle has a stable child list — reuse the cached result
    // instead of re-querying it on every re-run.
    let childIDs = cache.get(parentID)
    if (childIDs === undefined || isWorking(parentID)) {
      try {
        const result = await client.session.children({ sessionID: parentID })
        childIDs = (result.data ?? []).map((child) => {
          remember(child)
          return child.id
        })
        cache.set(parentID, childIDs)
      } catch {
        // Deleted/evicted session, or a transient network error - fall back to
        // whatever we already know about this parent instead of failing the whole lookup.
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

export function useSubagentCost(sessionID: Accessor<string | undefined>, messageCount: Accessor<number>) {
  const sync = useSync()
  const sdk = useSDK()

  const cache = createMemo(on(sessionID, () => new Map<string, string[]>()))

  const [descendantSessionIDs] = createResource(
    () => (sessionID() ? ([sessionID()!, messageCount()] as const) : undefined),
    async ([id]) =>
      collectDescendantSessionIDs({
        sessionID: id,
        client: sdk().client,
        remember: sync().session.remember,
        isWorking: (parentID) => sync().data.session_working(parentID),
        cache: cache(),
      }),
    { initialValue: emptyDescendantIDs },
  )

  const subagentCost = createMemo(() => {
    const ids = descendantSessionIDs() ?? emptyDescendantIDs
    return ids.reduce((total, id) => total + (sync().session.get(id)?.cost ?? 0), 0)
  })

  const hasSubagents = createMemo(() => (descendantSessionIDs()?.length ?? 0) > 0)

  return { subagentCost, hasSubagents }
}
