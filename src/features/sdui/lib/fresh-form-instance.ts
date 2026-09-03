import { consumeFreshFormInstance as consumeIntent } from '@/features/workspace-tabs/lib/fresh-form-instance-registry'

import { useSduiCacheStore } from './stores/sdui-cache-store'

/** Маршрут начинает новый документ: `/new` — единственная форма создания в маршрутах. */
export function isCreateRoute(route: string): boolean {
  const i = route.indexOf('?')
  return (i >= 0 ? route.slice(0, i) : route).endsWith('/new')
}

export function consumeFreshFormInstance(route: string): boolean {
  return consumeIntent(route)
}

/**
 * Реакция SDUI на «маршрут начинает новый экземпляр формы»: снять снимок вкладки.
 * Без этого экран восстановил бы прошлые значения ещё до ответа сервера, и форма создания
 * открылась бы заполненной.
 */
export function dropCachedScreensFor(path: string): void {
  const cache = useSduiCacheStore.getState()
  Object.keys(cache.cache).forEach((route) => {
    const i = route.indexOf('?')
    if ((i >= 0 ? route.slice(0, i) : route) === path) cache.remove(route)
  })
}
