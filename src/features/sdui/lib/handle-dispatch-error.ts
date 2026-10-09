import axios from 'axios'
import i18n from 'i18next'

import { classifyAccessError } from '@/shared/api/access-denied'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ActionBehavior, ViewAction } from '../types/view'
import { ViewConflictError, ViewHttpError } from '../api/view-transport'
import { handleConflict } from './conflict-handler'
import type { SduiSessionValue } from './sdui-session-context'
import {
  handleAccessDenied,
  handleObjectNotFound,
} from './access/handle-access-denied'
import {
  DOCUMENT_VALIDATION_CODE,
  buildValidationErrorPatches,
} from './validation-highlight'
import { rowAddressedTableCodes } from './validation/table-row-errors'
import {
  parseValidationReport,
  useValidationReportStore,
} from '@/entities/validation-report'

export interface DispatchErrorCtx {
  action: ViewAction
  /** behavior исходного действия — распознавание «пишущей» команды (SCRUM-400 §5.9). */
  behavior?: ActionBehavior | null
  isRetry: boolean
  /** Ключ вкладки экрана (tabRouteKey) — ключ стора отчёта (тот же, что на 200). */
  pathname: string
  session: SduiSessionValue
  opts?: {
    onOpenNotFound?: (info?: { kind?: string }) => void
  }
  /** Повтор исходного действия с isRetry=true (конфликт-хендлер). */
  retry: () => Promise<boolean>
  /** Восстановление сессии после SESSION_NOT_FOUND (route-only OPEN). */
  reopen: () => Promise<void>
  /** Свежий OPEN без старого formSessionId — восстановление после 403 (SCRUM-400). */
  reopenFresh: () => Promise<void>
}

// Catch-блок dispatch: 422-валидация документа, 409-конфликт ревизии/сессии,
// 403/404 по правам (SCRUM-400), гейты ошибок OPEN (SCRUM-290) и общий тост.
// Вызывающий после нас всегда возвращает false.
export function handleDispatchError(
  error: unknown,
  ctx: DispatchErrorCtx
): void {
  const { action, session } = ctx
  if (action.type === 'CLOSE') return
  // Отменённый запрос (выход, смена пользователя — поколение авторизации)
  // не показывает ничего: пользователь уже на другом экране.
  if (axios.isCancel(error)) return
  if (
    error instanceof ViewHttpError &&
    error.status === 422 &&
    error.code === DOCUMENT_VALIDATION_CODE
  ) {
    session.clearAllErrors()
    const report = parseValidationReport(error.validation)
    session.applyTreePatches(
      buildValidationErrorPatches(
        session.getTree?.() ?? session.tree,
        error.errors,
        rowAddressedTableCodes(report)
      )
    )
    // SCRUM-317 §3.2/§3.3: отчёт из тела 422 кладётся ТЕМ ЖЕ редьюсером,
    // что 200-эффект. operation на этом канале null — подставляем команду,
    // которую сами отправили. Есть панель — тост-дубль не показываем.
    if (report && report.messages.length > 0) {
      useValidationReportStore.getState().setReport(ctx.pathname, {
        ...report,
        operation:
          report.operation ??
          (action.type === 'COMMAND' ? (action.command ?? null) : null),
      })
    } else {
      showToast('error', error.message || i18n.t('sdui.requestError'))
    }
    return
  }
  if (error instanceof ViewConflictError) {
    const retry = !ctx.isRetry && action.type !== 'OPEN' ? ctx.retry : null
    handleConflict(
      error.data,
      { setSession: session.setSession, replaceAll: session.replaceAll },
      retry,
      ctx.reopen
    )
    return
  }
  // SCRUM-400 §3.2/§5.9: 403 по правам — на ЛЮБОМ действии, не только OPEN.
  // Раньше 403 на OPEN уходил в общий тост и оставлял вечный скелетон.
  if (error instanceof ViewHttpError && error.status === 403) {
    const kind = classifyAccessError(
      403,
      error.code,
      error.message,
      error.scope
    )
    if (
      kind?.kind === 'password-change' ||
      kind?.kind === 'account-ineligible'
    ) {
      // Оба случая уже перехвачены интерсептором (увод на смену пароля /
      // экран входа) — дублирующий тост или «Нет доступа» здесь только мешал бы.
      return
    }
    if (kind?.kind === 'access-denied') {
      handleAccessDenied(kind.denial.message, kind.denial.scope, {
        action,
        behavior: ctx.behavior,
        isRetry: ctx.isRetry,
        screenKey: ctx.pathname,
        session,
        reopenFresh: ctx.reopenFresh,
      })
      return
    }
    // 403 с неизвестным кодом — показать message тостом (спека §3.2).
    showToast('error', error.message || i18n.t('sdui.requestError'))
    return
  }
  // SCRUM-400 §9.5: 404 — «Объект не найден» (запись не существует либо вне
  // области RLS; с ней сервер намеренно неразличим). Легаси-фолбэк —
  // ТОЛЬКО 422 SCREEN_NOT_SDUI: 403/404 в обход прав легаси открывать нельзя.
  if (error instanceof ViewHttpError && error.status === 404) {
    handleObjectNotFound({ action, session, screenKey: ctx.pathname })
    return
  }
  if (
    error instanceof ViewHttpError &&
    action.type === 'OPEN' &&
    error.status === 422 &&
    error.code === 'SCREEN_NOT_SDUI' &&
    ctx.opts?.onOpenNotFound
  ) {
    ctx.opts.onOpenNotFound({ kind: error.kind })
    return
  }
  const message =
    error instanceof Error ? error.message : i18n.t('sdui.requestError')
  showToast('error', message)
}
