import type { ViewEffect } from '../types/view'

// SCRUM-308 v1 §5: отложенные исходы запросов скрытых-но-живых вкладок.
// Колбэк проигрывается при возврате на вкладку ПОСЛЕ восстановления дерева и
// значений (replayDeferredResponses зовётся из dispatch следом за
// applyOpenResponse). Патчи дерева/значений отложенный ответ не переносит:
// свежий OPEN авторитетнее — состояние сервера уже включает результат команды;
// переносятся только пользовательские эффекты и тексты ошибок. Отложенным
// ошибкам запрещены авто-retry и reopen.

const deferred = new Map<string, (() => void)[]>()

// Эффекты, которые имеет смысл показать при возврате: уведомления и отчёты.
// navigate/openDialog/refresh при возврате сыграли бы в чужом контексте.
const DEFERRABLE_EFFECT_TYPES = new Set([
  'notify',
  'alert',
  'validationReport',
  'download',
])

export function deferrableEffects(
  effects: ViewEffect[] | undefined
): ViewEffect[] {
  return (effects ?? []).filter((e) => DEFERRABLE_EFFECT_TYPES.has(e.type))
}

export function deferResponse(route: string, replay: () => void): void {
  const list = deferred.get(route)
  if (list) list.push(replay)
  else deferred.set(route, [replay])
}

/** Проиграть отложенные колбэки маршрута в порядке поступления (FIFO). */
export function replayDeferredResponses(route: string): void {
  const list = deferred.get(route)
  if (!list) return
  deferred.delete(route)
  for (const replay of list) replay()
}

/** Вкладка закрыта штатно (CLOSE) — её отложенные исходы никому не нужны. */
export function dropDeferredResponses(route: string): void {
  deferred.delete(route)
}
