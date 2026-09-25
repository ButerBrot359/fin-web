import { viewTransport } from '../api/view-transport'
import { formInstanceIdFor } from './form-instance'

export interface TabTitleTarget {
  id: string
  path: string
  search: string
}

interface TabTitleRefreshDeps {
  onTitle: (tabId: string, title: string) => void
  shouldContinue: () => boolean
  shouldRefresh?: (tabId: string) => boolean
  concurrency?: number
}

async function fetchTabTitle(target: TabTitleTarget): Promise<string | null> {
  const res = await viewTransport.post({
    route: target.path + target.search,
    action: { type: 'OPEN', formInstanceId: formInstanceIdFor(target.path) },
  })
  if (res.formSessionId) {
    void viewTransport
      .post({ formSessionId: res.formSessionId, action: { type: 'CLOSE' } })
      .catch(() => undefined)
  }
  const title = res.tab?.title ?? res.tree?.props?.title
  return typeof title === 'string' && title ? title : null
}

export async function refreshTabTitles(
  targets: TabTitleTarget[],
  {
    onTitle,
    shouldContinue,
    shouldRefresh,
    concurrency = 3,
  }: TabTitleRefreshDeps
): Promise<void> {
  const queue = [...targets]

  const worker = async () => {
    for (;;) {
      const target = queue.shift()
      if (!target || !shouldContinue()) return
      if (shouldRefresh && !shouldRefresh(target.id)) continue
      try {
        const title = await fetchTabTitle(target)
        if (title && shouldContinue()) onTitle(target.id, title)
      } catch {
        continue
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker)
  )
}
