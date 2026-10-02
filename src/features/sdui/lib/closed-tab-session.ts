import { formInstanceOf } from '@/shared/lib/router/form-instance-route'

import { viewTransport } from '../api/view-transport'
import { peekFormInstanceId } from './form-instance'
import { isScreenMounted } from './mounted-screen'
import { useSduiCacheStore } from './stores/sdui-cache-store'

function splitRoute(fullRoute: string): { pathname: string; search: string } {
  const i = fullRoute.indexOf('?')
  return i >= 0
    ? { pathname: fullRoute.slice(0, i), search: fullRoute.slice(i) }
    : { pathname: fullRoute, search: '' }
}

export async function discardClosedFormDraft(fullRoute: string): Promise<void> {
  const { pathname, search } = splitRoute(fullRoute)
  const formInstanceId =
    formInstanceOf(pathname, search) ?? peekFormInstanceId(pathname)
  if (!formInstanceId) return
  try {
    const opened = await viewTransport.post({
      formSessionId: null,
      revision: null,
      route: fullRoute,
      action: { type: 'OPEN', formInstanceId },
    })
    await viewTransport.post({
      formSessionId: opened.formSessionId,
      revision: opened.revision,
      route: fullRoute,
      action: { type: 'CLOSE', discardDraft: true },
    })
  } catch {
    return
  }
}

export function releaseClosedTabScreen(route: string): void {
  if (isScreenMounted(route)) return
  const cached = useSduiCacheStore.getState().get(route)
  if (!cached) return
  useSduiCacheStore.getState().remove(route)
  if (cached.formSessionId == null) return
  void viewTransport
    .post({
      formSessionId: cached.formSessionId,
      revision: cached.revision,
      route,
      action: { type: 'CLOSE' },
    })
    .catch(() => undefined)
}
