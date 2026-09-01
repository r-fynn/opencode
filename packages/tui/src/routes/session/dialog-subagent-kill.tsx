import { DialogSelect } from "../../ui/dialog-select"
import { useSDK } from "../../context/sdk"

export function DialogSubagentKill(props: { sessionID: string }) {
  const sdk = useSDK()

  return (
    <DialogSelect
      title="Kill Subagent"
      options={[
        {
          title: "Kill",
          value: "plain" as const,
          description: "Stop this attempt. The task still stands — resumable by the orchestrator or a human later.",
          onSelect: (dialog) => {
            void sdk.client.session.kill({ sessionID: props.sessionID, flavor: "plain" })
            dialog.clear()
          },
        },
        {
          title: "Kill — task no longer needed",
          value: "locked" as const,
          description:
            "Stop this attempt and refuse any future orchestrator resume of it. A human can still restart it.",
          onSelect: (dialog) => {
            void sdk.client.session.kill({ sessionID: props.sessionID, flavor: "locked" })
            dialog.clear()
          },
        },
      ]}
    />
  )
}
