import { useCallback, useState } from 'react'

/** Drafts live with the widget, not its collapsible composer. Never sent automatically. */
export function useAssistantDraft(key: string) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const setDraft = useCallback(
    (value: string) => {
      setDrafts((current) => ({ ...current, [key]: value }))
    },
    [key]
  )
  return { draft: drafts[key] ?? '', setDraft }
}
