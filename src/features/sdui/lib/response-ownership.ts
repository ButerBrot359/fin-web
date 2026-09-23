import type { SduiSessionValue } from './sdui-session-context'
import { isRouteOpenAsTab } from './workspace-tab-gateway'

// SCRUM-308 v1 §5: владение ответом. Пользователь мог переключить вкладку,
// пока запрос в полёте, — ответ не должен примениться к тому, что сейчас на
// экране. У запроса снимается владелец, а исход маршрутизируется в один из
// трёх: active (применяем), deferred (вкладка скрыта, но жива — колбэк
// проигрывается при возврате после восстановления дерева и значений),
// orphaned (вкладка закрыта — ответ выбрасывается и вкладку не воскрешает).

export interface ResponseOwner {
  kind: 'root' | 'panel'
  formSessionId: string | null
  route: string
}

export type ResponseFate = 'active' | 'deferred' | 'orphaned'

export function captureResponseOwner(
  session: SduiSessionValue,
  route: string
): ResponseOwner {
  return {
    kind: session.kind,
    formSessionId: session.getSession().formSessionId,
    route,
  }
}

/**
 * `session` — тот же объект, через который ответ применился бы: у root-экрана
 * его геттеры читают глобальные сторы динамически, поэтому после ухода на
 * другую вкладку он отдаёт уже ЧУЖОЙ formSessionId — по нему уход и виден.
 */
export function classifyResponse(
  owner: ResponseOwner,
  session: SduiSessionValue
): ResponseFate {
  // Панели: их приёмники (panel-patch-registry) пропадают вместе с панелью,
  // патчи закрытой панели дропаются на приёмнике — классификатор не нужен.
  if (owner.kind === 'panel') return 'active'
  // Сессия на экране та же, что у владельца, — ответ свой.
  if (session.getSession().formSessionId === owner.formSessionId) {
    return 'active'
  }
  const currentRoute = window.location.pathname + window.location.search
  // Маршрут тот же, но сессия за время полёта переоткрыта (reopen после 409):
  // ответ прежней сессии применять нельзя — его revision утопила бы
  // подтверждённую новой сессией.
  if (currentRoute === owner.route) return 'orphaned'
  return isRouteOpenAsTab(owner.route) ? 'deferred' : 'orphaned'
}
