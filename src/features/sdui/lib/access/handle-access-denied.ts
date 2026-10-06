import i18n from 'i18next'

import type { AccessDenialScope } from '@/shared/api/access-denied'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ActionBehavior, ViewAction } from '../../types/view'
import type { SduiSessionValue } from '../sdui-session-context'
import { useScreenAccessStore } from './screen-access-store'

/**
 * Команды записи — вторая опора распознавания «пишущей» команды рядом с
 * `behavior.resetsDirty` (SCRUM-400 §5.9): команда, пришедшая без behavior
 * (Ctrl+S из ТЧ), не должна попадать в ветку «переоткрыть» и стирать правки.
 */
const WRITE_COMMANDS = new Set([
  'save',
  'saveAndClose',
  'post',
  'postAndClose',
  'unpost',
  'dict.save',
  'dict.saveAndClose',
  'setDeletionMark',
])

const isWriteAction = (
  action: ViewAction,
  behavior: ActionBehavior | null | undefined
): boolean => {
  if (behavior?.resetsDirty === true) return true
  return (
    action.type === 'COMMAND' &&
    typeof action.command === 'string' &&
    WRITE_COMMANDS.has(action.command)
  )
}

export interface HandleAccessDeniedCtx {
  action: ViewAction
  behavior?: ActionBehavior | null
  isRetry: boolean
  /** Маршрутный ключ вкладки экрана (tabRouteKey) — ключ screen-access-store. */
  screenKey: string
  session: SduiSessionValue
  /** Один свежий OPEN без старого formSessionId (восстановление после отзыва). */
  reopenFresh: () => Promise<void>
}

/**
 * Политика реакции на 403 по правам в SDUI — таблица §5.9 спеки SCRUM-400:
 *
 * - OPEN корневого экрана → экран «Нет доступа» (легаси-фолбэк ЗАПРЕЩЁН:
 *   он только по 422 SCREEN_NOT_SDUI);
 * - `scope: TARGET` → тост с причиной, форма и правки целы;
 * - пишущая команда (`resetsDirty` ИЛИ известная команда записи) → тост с
 *   причиной, форма и dirty целы, не переоткрывать;
 * - остальное (потерян «Просмотр», HYDRATE, EVENT) → один свежий OPEN без
 *   старого formSessionId; повторный 403 на этом OPEN сам приведёт в ветку
 *   «Нет доступа». Панели не переоткрываются — только тост.
 *
 * 403 приходит ДО исполнения команды: состояние документа на сервере не
 * изменилось, поэтому правки формы никогда не выбрасываются молча.
 */
export function handleAccessDenied(
  message: string | null,
  scope: AccessDenialScope,
  ctx: HandleAccessDeniedCtx
): void {
  const { action, session } = ctx

  if (action.type === 'OPEN') {
    if (session.kind === 'panel') {
      showToast('warning', message ?? i18n.t('sdui.accessDenied.description'))
      return
    }
    useScreenAccessStore.getState().setDenied(ctx.screenKey, message)
    return
  }

  if (scope === 'TARGET') {
    showToast('warning', message ?? i18n.t('sdui.accessDenied.targetDenied'))
    return
  }

  if (isWriteAction(action, ctx.behavior)) {
    showToast('warning', message ?? i18n.t('sdui.accessDenied.writeDenied'))
    return
  }

  // Панель не переоткрывается по маршруту (её сессия живёт в диалоге):
  // показываем причину, форму владельца не трогаем.
  if (session.kind === 'panel') {
    showToast('warning', message ?? i18n.t('sdui.accessDenied.description'))
    return
  }

  // Повторный отказ после восстановления — не зацикливаемся: экран «Нет доступа».
  if (ctx.isRetry) {
    useScreenAccessStore.getState().setDenied(ctx.screenKey, message)
    return
  }

  const lostChanges = session.isDirty
  showToast(
    'warning',
    i18n.t('sdui.accessDenied.changed') +
      (lostChanges ? ` ${i18n.t('sdui.accessDenied.unsavedLost')}` : '')
  )
  session.resetDirty()
  void ctx.reopenFresh()
}

/** Target-адресованные команды: их 404 не закрывает текущую форму (§9.5). */
const TARGET_COMMAND_PREFIXES = [
  'ref.',
  'refcell',
  'nav.',
  'table.podbor',
  'list.createBasedOn',
]

export const isTargetAddressedCommand = (action: ViewAction): boolean =>
  action.type === 'COMMAND' &&
  typeof action.command === 'string' &&
  TARGET_COMMAND_PREFIXES.some((p) => action.command!.startsWith(p))

/**
 * Политика 404 в SDUI (SCRUM-400 §9.5): запись не существует либо вне области
 * пользователя (RLS) — сервер их намеренно не различает.
 */
export function handleObjectNotFound(ctx: {
  action: ViewAction
  session: SduiSessionValue
  screenKey: string
}): void {
  // Команда с целью-другой записью (выбор ссылки, подбор, панель «Перейти»):
  // доступ к ТЕКУЩЕЙ форме не менялся — только тост, форма и правки целы.
  if (isTargetAddressedCommand(ctx.action)) {
    showToast('warning', i18n.t('sdui.objectNotFound.targetToast'))
    return
  }
  if (ctx.session.kind === 'panel') {
    showToast('warning', i18n.t('sdui.objectNotFound.targetToast'))
    return
  }
  useScreenAccessStore.getState().setNotFound(ctx.screenKey)
}
