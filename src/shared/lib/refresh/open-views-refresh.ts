/** Реальные открытые формы могут хранить данные вне React Query. */
export interface OpenViewsRefreshResult {
  refreshed: number
  deferred: number
  failed: number
}

type RefreshHandler = () => Promise<OpenViewsRefreshResult>
const handlers = new Set<RefreshHandler>()

export function registerOpenViewsRefresh(handler: RefreshHandler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/** Обновляет подключённые экраны; каждый экран сам защищает свой черновик. */
export async function requestOpenViewsRefresh(): Promise<OpenViewsRefreshResult> {
  const results = await Promise.allSettled(
    [...handlers].map(async (handler) => handler())
  )
  return results.reduce<OpenViewsRefreshResult>(
    (total, result) => {
      if (result.status === 'rejected') {
        total.failed++
      } else {
        total.refreshed += result.value.refreshed
        total.deferred += result.value.deferred
        total.failed += result.value.failed
      }
      return total
    },
    { refreshed: 0, deferred: 0, failed: 0 }
  )
}
