import { useEffect, useState } from 'react'

import { useSduiSession } from '../sdui-session-context'
import {
  useListMemoryStore,
  type ListMemoryEntry,
} from '../stores/list-memory-store'

export const useRestoredListMemory = (
  nodeId: string
): ListMemoryEntry | undefined => {
  const { screenRoute } = useSduiSession()
  const [restored] = useState(() =>
    screenRoute
      ? useListMemoryStore.getState().get(screenRoute, nodeId)
      : undefined
  )
  return restored
}

export const useRememberListMemory = (
  nodeId: string,
  { search, selectedRowId, trail }: ListMemoryEntry
): void => {
  const { screenRoute } = useSduiSession()
  useEffect(() => {
    if (!screenRoute) return
    useListMemoryStore
      .getState()
      .save(screenRoute, nodeId, { search, selectedRowId, trail })
  }, [screenRoute, nodeId, search, selectedRowId, trail])
}
