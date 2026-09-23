import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'

import type { ActionBehavior, ViewAction } from '../types/view'
import { uploadFileByEffect } from './upload-file-effect'
import {
  buildCommonEffectDeps,
  buildDialogEffectDeps,
} from './build-effect-deps'
import { createEffectHandler } from './effect-handler'
import type { SduiSessionValue } from './sdui-session-context'
import { useConfirmStore } from './stores/confirm-store'
import { useUnsavedChangesStore } from './stores/unsaved-changes-store'
import { useAlertStore } from './stores/alert-store'
import { useAsyncTaskStore } from '@/entities/async-task'
import {
  parseValidationReport,
  useValidationReportStore,
} from '@/entities/validation-report'

export interface DispatchEffectHandlerCtx {
  navigate: NavigateFunction
  session: SduiSessionValue
  queryClient: QueryClient
  setSearchParams: (search: string, opts?: { replace?: boolean }) => void
  /** location.pathname на момент dispatch — ключ стора отчёта о проверке. */
  pathname: string
  /**
   * Рекурсивный вход обратно в dispatchAction: серверные ответы диалогов
   * confirm/unsavedChanges — команды в ТУ ЖЕ форм-сессию.
   */
  redispatch: (
    action: ViewAction,
    behavior?: ActionBehavior | null
  ) => Promise<boolean>
}

// Эффект-хэндлер форм-сессионного пути (dispatch): полный набор мостов, включая
// те, что требуют сессию/redispatch и потому недоступны session-less рантайму
// (use-sdui-effects).
export function buildDispatchEffectHandler(ctx: DispatchEffectHandlerCtx) {
  const { session, pathname, redispatch } = ctx
  const common = buildCommonEffectDeps(ctx)
  const effectHandler: ReturnType<typeof createEffectHandler> =
    createEffectHandler({
      ...common,
      ...buildDialogEffectDeps({
        session,
        playAll: (effects) => {
          effectHandler.playAll(effects)
        },
      }),
      confirm: (effect) => {
        // SCRUM-288 §2.3/§2.4: session-less подтверждение (панель) исполняет
        // confirmRequest; иначе — форм-сессионный COMMAND с confirmBehavior.
        void useConfirmStore
          .getState()
          .ask(effect.message ?? '')
          .then((ok) => {
            if (!ok) {
              // SCRUM-276: «Нет» — тоже серверный исход, когда бэк дал
              // cancelCommand (field.rollback:Nomer): без него отменённое
              // значение оставалось бы в серверной сессии.
              if (effect.cancelCommand) {
                void redispatch({
                  type: 'COMMAND',
                  command: effect.cancelCommand,
                })
              }
              return
            }
            if (effect.confirmRequest) {
              void effectHandler.executeActionRequest(effect.confirmRequest)
              return
            }
            void redispatch(
              { type: 'COMMAND', command: effect.confirmCommand ?? '' },
              effect.confirmBehavior
            )
          })
      },
      validationReport: (effect) => {
        // SCRUM-317 §3.1/§3.3: отчёт ПОЛНОСТЬЮ заменяет прежний список
        // экрана; пустой — гасит панель (успешная операция без замечаний).
        // Ключ — маршрут вкладки: тот же, что у sdui-cache-store.
        const report = parseValidationReport(effect.report)
        if (report) {
          useValidationReportStore.getState().setReport(pathname, report)
        }
      },
      alert: (effect) => {
        useAlertStore
          .getState()
          .show(effect.message ?? '', effect.title ?? null)
      },
      taskStarted: (effect) => {
        // SCRUM-330 §3.3: фоновая операция запущена — задача приезжает в
        // эффекте целиком (иначе до первого опроса показывать было бы нечего).
        // Кладём в стор с привязкой к сессии; поллинг и рапорт task.finished —
        // на вотчере экрана (use-task-watcher). Сессию читаем в момент
        // эффекта: на OPEN-ответе setSession уже отработал.
        const sid = session.getSession().formSessionId
        if (effect.task && sid) {
          useAsyncTaskStore.getState().track(effect.task, sid)
        }
      },
      uploadFile: (effect) => {
        // Файл по SDUI-каналу не ходит: адрес приёмника, фильтр типов и предел
        // размера присылает сервер, фронт лишь открывает диалог и отправляет
        // multipart. После успеха — серверная команда в ТУ ЖЕ сессию
        // (обычно reread): документ уже изменён в БД, и форма обязана его
        // перечитать, иначе на экране осталась бы прежняя табличная часть.
        void uploadFileByEffect(effect, redispatch)
      },
      unsavedChanges: (effect) => {
        // Три ответа — три исхода: «Да» и «Нет» уходят серверными командами в
        // ТУ ЖЕ сессию, «Отмена» не шлёт ничего (форма остаётся открытой).
        // «Нет» — тоже команда, а не локальное закрытие: несохранённое лежит
        // в серверной сессии, и без неё оно всплыло бы при следующем открытии.
        void useUnsavedChangesStore
          .getState()
          .ask()
          .then((answer) => {
            if (answer === 'cancel') return
            const command =
              answer === 'save' ? effect.saveCommand : effect.discardCommand
            if (!command) return
            void redispatch(
              { type: 'COMMAND', command },
              answer === 'save' ? effect.saveBehavior : effect.discardBehavior
            )
          })
      },
    })
  return effectHandler
}
