import { acquireFormTurn } from './form-dispatch-queue'
import {
  FLUSH_TIMEOUT_MS,
  flushAllPendingTableCommits,
  hasPendingTableCommits,
} from './pending-table-commits'
import {
  flushPendingFieldChange,
  hasPendingFieldChange,
} from './hooks/use-change-on-blur'
import { useTreeStore } from './stores/tree-store'

export function hasPendingScreenEdits(): boolean {
  return hasPendingFieldChange() || hasPendingTableCommits()
}

function waitFormTurn(formSessionId: string | null): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, FLUSH_TIMEOUT_MS)
    void acquireFormTurn(formSessionId).then((release) => {
      release()
      clearTimeout(timer)
      resolve()
    })
  })
}

export async function flushScreenEdits(): Promise<void> {
  const formSessionId = useTreeStore.getState().formSessionId
  flushPendingFieldChange()
  try {
    await flushAllPendingTableCommits()
  } catch {
    return
  }
  await waitFormTurn(formSessionId)
}
