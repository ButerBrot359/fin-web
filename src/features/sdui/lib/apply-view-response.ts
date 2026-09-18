import type { ViewEffect, ViewResponse, ViewTabMeta } from '../types/view'
import type { PanelPatchSink } from './panel-patch-registry'
import { applyValuePatches } from './patch-applier'
import type { SduiSessionValue } from './sdui-session-context'
import { saveFormSession } from './form-session-storage'
import { validatePatches } from './validation'

/**
 * Приёмник серверного ответа /api/view. Базовый набор методов — контракт
 * `PanelPatchSink` (патчи дерева/значений, statePatch, сброс ошибок); поверх —
 * необязательные методы, которые есть не у каждого приёмника:
 * - `bumpRevision` — у панели ревизия живёт в panel-store и обновляется
 *   снаружи (updateSession), поэтому её sink метода не имеет;
 * - `setDirty` — серверный dirty авторитетен только у форм-сессии dispatch
 *   (SCRUM-288 §2.5); ретрансляция выбора dirty родителя не трогает.
 */
export interface ServerPatchSink extends PanelPatchSink {
  bumpRevision?: (revision: number) => void
  setDirty?: (value: boolean) => void
}

export interface ApplyServerPatchesOptions {
  /**
   * Сбрасывать ли старые ошибки перед патчами: COMMAND — да, EVENT — нет
   * (dispatch); ретрансляция выбора — всегда да (это COMMAND родителю).
   */
  clearErrors: boolean
  playEffects: (effects: ViewEffect[]) => void
}

function applyPatchSet(
  sink: Pick<ServerPatchSink, 'applyTreePatches' | 'setFromServer'>,
  res: ViewResponse
): void {
  const patches = validatePatches(res.patches)
  sink.applyTreePatches(patches)
  applyValuePatches(patches, sink.setFromServer)
}

/**
 * Единый порядок применения ответа EVENT/COMMAND — критичен и одинаков во всех
 * точках (dispatch, ретрансляция выбора в родителя):
 * ревизия → сброс старых ошибок → патчи дерева → патчи значений →
 * merge(statePatch) → серверный dirty → эффекты.
 *
 * Серверный dirty (только при наличии `sink.setDirty`):
 * - res.dirty перекрывает клиентский флаг, включая false (SCRUM-288 §2.5);
 *   null/undefined — «решай сам»;
 * - res.formDirty=true латчит dirty (SCRUM-276, черновики: серверные правки
 *   scratch в клиентский dirty не попадают); false клиентский флаг не трогает
 *   (условие «клиентский ИЛИ серверный»).
 */
export function applyServerPatches(
  sink: ServerPatchSink,
  res: ViewResponse,
  opts: ApplyServerPatchesOptions
): void {
  sink.bumpRevision?.(res.revision)
  if (opts.clearErrors) sink.clearAllErrors()
  applyPatchSet(sink, res)
  sink.merge(res.statePatch ?? {})
  if (sink.setDirty) {
    if (res.dirty != null) sink.setDirty(res.dirty)
    if (res.formDirty === true) sink.setDirty(true)
  }
  opts.playEffects(res.effects ?? [])
}

/**
 * Ответ OPEN отличается по-настоящему: ревизия/дерево/state уже установлены
 * целиком (setSession/setRoot/replaceAll), сбрасывать ошибки и мерджить
 * statePatch нечего — применяются только патчи handler.handleOpen
 * (required/enabled/label-дефолты) и эффекты.
 */
export function applyOpenPatches(
  sink: Pick<ServerPatchSink, 'applyTreePatches' | 'setFromServer'>,
  res: ViewResponse,
  playEffects: (effects: ViewEffect[]) => void
): void {
  applyPatchSet(sink, res)
  playEffects(res.effects ?? [])
}

/**
 * Полное применение ответа OPEN к форм-сессии: установка сессии/дерева/state
 * целиком, затем патчи handler.handleOpen и эффекты (applyOpenPatches).
 */
export function applyOpenResponse(
  session: SduiSessionValue,
  res: ViewResponse,
  ctx: {
    route: string
    /** layoutCode ушедшего OPEN — запоминается для reopen (SCRUM-244 §4.2). */
    layoutCode?: string | null
    onOpenTab?: (tab: ViewTabMeta | null) => void
    playEffects: (effects: ViewEffect[]) => void
  }
): void {
  session.setSession(res.formSessionId, res.revision)
  // formSessionId переживает F5 в sessionStorage (SCRUM-330 Работа 2)
  saveFormSession(ctx.route, res.formSessionId)
  session.setLayoutCode?.(ctx.layoutCode ?? null)
  session.setScreenKey?.(res.screenKey ?? null)
  if (res.tree) session.setRoot(res.tree)
  session.setOnDirtyClose?.(res.onDirtyClose ?? null)
  ctx.onOpenTab?.(res.tab ?? null)
  session.replaceAll(res.state ?? {})
  // SCRUM-276 (черновики): OPEN с подмешанным черновиком приходит с
  // formDirty=true — форма сразу «изменена», как в 1С. Латч после
  // replaceAll (он сбрасывает dirty в false).
  if (res.formDirty === true) session.setDirty(true)
  applyOpenPatches(session, res, ctx.playEffects)
}
