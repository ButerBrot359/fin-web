import type { ViewPatch } from '../types/view'

/**
 * Приёмник патчей живой панели. Дерево и значения панели живут в локальном
 * стейте её провайдера (`PanelFormProvider`), а не в сторе: в сторе — только
 * `session.revision`. Поэтому код вне React-дерева (ретрансляция выбора из
 * дочерней панели) достучаться до них не может и до появления реестра просто
 * ронял патчи на пол.
 *
 * Тот же приём, что у `pending-table-commits` и `table-validation-registry`:
 * провайдер регистрируется по своему panelId, внешний код ищет по нему.
 */
export interface PanelPatchSink {
  applyTreePatches: (patches: ViewPatch[]) => void
  setFromServer: (binding: string, value: unknown) => void
  merge: (patch: Record<string, unknown>) => void
  clearAllErrors: () => void
}

const registry = new Map<string, PanelPatchSink>()

export function registerPanelPatchSink(
  panelId: string,
  sink: PanelPatchSink
): void {
  registry.set(panelId, sink)
}

export function unregisterPanelPatchSink(panelId: string): void {
  registry.delete(panelId)
}

/**
 * Приёмник панели или `undefined`, если панель уже размонтирована. Отсутствие —
 * штатный случай (панель успели закрыть), а не ошибка: вызывающий просто
 * обновляет ревизию и не применяет патчи.
 */
export function getPanelPatchSink(panelId: string): PanelPatchSink | undefined {
  return registry.get(panelId)
}
