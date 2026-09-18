import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * Ленивая загрузка ИМЕНОВАННОГО экспорта: `lazyNamed(() => import('@/pages/x'), 'XPage')`
 * вместо повторяющегося `.then((m) => ({ default: m.XPage }))`.
 *
 * Типобезопасно: имя экспорта сверяется с модулем, и это обязан быть React-компонент —
 * опечатка в имени или не-компонент не соберутся. Тип пропсов компонента сохраняется
 * в результате как есть (`M[K]`).
 */
export const lazyNamed = <
  // `any` в констрейнте неизбежен: `ComponentType<never>`/`<unknown>` отвергают любой
  // компонент из-за контравариантности пропсов. Наружу `any` не утекает — результат
  // типизирован фактическим типом компонента `M[K]`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  M extends Record<K, ComponentType<any>>,
  K extends PropertyKey,
>(
  loader: () => Promise<M>,
  exportName: K
): LazyExoticComponent<M[K]> =>
  lazy(async () => ({ default: (await loader())[exportName] }))
