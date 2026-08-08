import type { Plugin } from "@opencode-ai/plugin"

export const SoundNotifyPlugin: Plugin = async ({ $ }) => {
  const beep = async () => {
    try {
      await $`powershell -c "[Console]::Beep(800, 200)"`
    } catch {
      // silently ignore if beep fails
    }
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await beep()
      }
    },
    "tool.execute.before": async (input) => {
      if (input.tool === "question") {
        await beep()
      }
    },
  }
}
