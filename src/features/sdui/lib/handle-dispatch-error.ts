import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewAction } from '../types/view'
import { ViewConflictError, ViewHttpError } from '../api/view-transport'
import { handleConflict } from './conflict-handler'
import type { SduiSessionValue } from './sdui-session-context'
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
  isRetry: boolean
  /** location.pathname — ключ стора отчёта о проверке (тот же, что на 200). */
  pathname: string
  session: SduiSessionValue
  opts?: {
    onOpenNotFound?: (info?: { kind?: string }) => void
    onRouteUnknown?: () => void
  }
  /** Повтор исходного действия с isRetry=true (конфликт-хендлер). */
  retry: () => Promise<boolean>
  /** Восстановление сессии после SESSION_NOT_FOUND (route-only OPEN). */
  reopen: () => Promise<void>
}

// Catch-блок dispatch: 422-валидация документа, 409-конфликт ревизии/сессии,
// гейты ошибок OPEN (SCRUM-290) и общий тост. Вызывающий после нас всегда
// возвращает false.
export function handleDispatchError(
  error: unknown,
  ctx: DispatchErrorCtx
): void {
  const { action, session } = ctx
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
  } else if (error instanceof ViewConflictError) {
    const retry = !ctx.isRetry && action.type !== 'OPEN' ? ctx.retry : null
    handleConflict(
      error.data,
      { setSession: session.setSession, replaceAll: session.replaceAll },
      retry,
      ctx.reopen
    )
  } else if (error instanceof ViewHttpError && action.type === 'OPEN') {
    // Единый гейт раскатки под catch-all (§2 бэк-спеки SCRUM-290):
    // ROUTE_UNKNOWN → «не найдено»; SCREEN_NOT_SDUI / унаследованный
    // 404 → легаси-фолбэк. Без подходящего колбэка — общий тост, как раньше.
    if (
      error.status === 404 &&
      error.code === 'ROUTE_UNKNOWN' &&
      ctx.opts?.onRouteUnknown
    ) {
      ctx.opts.onRouteUnknown()
    } else if (
      error.status === 422 &&
      error.code === 'SCREEN_NOT_SDUI' &&
      ctx.opts?.onOpenNotFound
    ) {
      ctx.opts.onOpenNotFound({ kind: error.kind })
    } else if (error.status === 404 && ctx.opts?.onOpenNotFound) {
      ctx.opts.onOpenNotFound(undefined)
    } else {
      showToast('error', error.message || i18n.t('sdui.requestError'))
    }
  } else {
    const message =
      error instanceof Error ? error.message : i18n.t('sdui.requestError')
    showToast('error', message)
  }
}
