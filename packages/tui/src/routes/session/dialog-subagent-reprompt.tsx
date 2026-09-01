import { createMemo, Show } from "solid-js"
import { DialogPrompt } from "../../ui/dialog-prompt"
import { useDialog } from "../../ui/dialog"
import { useSDK } from "../../context/sdk"
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import type { TextPart } from "@opencode-ai/sdk/v2"

export function DialogSubagentReprompt(props: { sessionID: string; mode: "reprompt" | "restart" }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const { theme } = useTheme()

  const originalPromptLines = createMemo(() => {
    const messages = sync.data.message[props.sessionID] ?? []
    const first = messages.find((item) => item.role === "user")
    if (!first) return undefined
    const text = (sync.data.part[first.id] ?? []).find(
      (item): item is TextPart => item.type === "text",
    )?.text
    if (!text) return undefined
    return (text.match(/\n/g)?.length ?? 0) + 1
  })

  return (
    <DialogPrompt
      title={props.mode === "restart" ? "Restart Subagent" : "Interrupt & Reprompt"}
      placeholder="Optional note (leave empty to retry as-is)"
      description={() => (
        <text fg={theme.textMuted}>
          Continue with this where you left off
          <Show when={originalPromptLines()}>{(lines) => ` [Original prompt ~${lines()} lines]`}</Show>
        </text>
      )}
      onConfirm={(value) => {
        const note = value.trim()
        void sdk.client.session.reprompt({
          sessionID: props.sessionID,
          note: note.length > 0 ? note : undefined,
        })
        dialog.clear()
      }}
      onCancel={() => dialog.clear()}
    />
  )
}
