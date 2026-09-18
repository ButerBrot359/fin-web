import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type {
  ActionBehavior,
  ViewAction,
  ViewEffect,
  ViewTabMeta,
} from '../types/view'
import { viewTransport } from '../api/view-transport'
import { applyOpenResponse, applyServerPatches } from './apply-view-response'
import { buildDispatchEffectHandler } from './build-dispatch-effect-deps'
import { handleDispatchError } from './handle-dispatch-error'
import { isRetryableAfterReopen } from './reopen-retry-policy'
import { useSduiSession } from './sdui-session-context'
import { flushAllPendingTableCommits } from './pending-table-commits'
import {
  CUSTOMIZE_FORM_COMMAND,
  CUSTOMIZE_FORM_DEFAULT_COMMAND,
} from './customize-form/customize-form-command'
import { useCustomizeFormStore } from './customize-form/customize-form-store'
import { revealAllTableErrors } from './table-validation-registry'
import { shouldRevealTableErrors } from './utils/reveal-policy'
import {
  currentFormInstanceId,
  prepareFreshFormInstanceId,
} from './form-instance'
import { useCommandInflightStore } from './stores/command-inflight-store'
import { clearFormSession, readFormSession } from './form-session-storage'

export function useSduiDispatch() {
  const location = useLocation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const session = useSduiSession()

  const dispatch = useCallback(
    // Именованное функциональное выражение: рекурсивные самовызовы (confirm/
    // reopen/retry ниже) ссылаются на dispatchAction — привязку имени внутри
    // собственной области видимости, а не на внешний dispatch (TDZ на этапе
    // сборки useCallback до присваивания константе).
    async function dispatchAction(
      action: ViewAction,
      behavior?: ActionBehavior | null,
      isRetry = false,
      opts?: {
        onOpenNotFound?: (info?: { kind?: string }) => void
        onRouteUnknown?: () => void
        onOpenTab?: (tab: ViewTabMeta | null) => void
        // Background refresh may finish after the user edits or changes tabs.
        acceptOpenResponse?: () => boolean
        freshOpen?: boolean
      }
    ): Promise<boolean> {
      // Конструктор дизайна Ф4/Ф5: «Изменить форму [для всех]» — клиентские
      // команды контракта. Пункты приходят с бэка обычными MENU_ITEM-нодами, но
      // серверного хендлера нет — перехват до inflight-гарда и транспорта.
      if (
        action.type === 'COMMAND' &&
        (action.command === CUSTOMIZE_FORM_COMMAND ||
          action.command === CUSTOMIZE_FORM_DEFAULT_COMMAND)
      ) {
        useCustomizeFormStore
          .getState()
          .open(
            action.command === CUSTOMIZE_FORM_DEFAULT_COMMAND
              ? 'default'
              : 'user'
          )
        return true
      }

      const { formSessionId, revision } = session.getSession()

      // SCRUM-330 Работа 1: in-flight-гард от двойного клика. Повторный COMMAND,
      // пока предыдущий той же сессии не отвечен, дропается молча: раньше он ждал
      // блокировку на бэке 20 с и падал 409 LOCK_CONFLICT. isRetry пропускаем —
      // retry конфликт-хендлера стартует, пока флаг исходной команды ещё держится.
      const inflightKey =
        action.type === 'COMMAND' && !isRetry ? formSessionId : null
      if (inflightKey) {
        if (inflightKey in useCommandInflightStore.getState().sessions) {
          return false
        }
        useCommandInflightStore.getState().begin(inflightKey)
      }

      // Поведение действия приходит с бэка (SCRUM-283). Фолбэки асимметричны намеренно:
      // забытый flush = молчаливая потеря правок ТЧ → безопасная сторона true;
      // забытые resetsDirty/closeAfter безвредны (заметны) → false.
      const shouldFlush = behavior?.flushPendingTables ?? true
      const shouldReset = behavior?.resetsDirty ?? false
      const shouldClose = behavior?.closeAfter ?? false

      const effectHandler = buildDispatchEffectHandler({
        navigate,
        session,
        queryClient,
        setSearchParams,
        pathname: location.pathname,
        redispatch: (a, b) => dispatchAction(a, b),
      })
      const playEffects = (effects: ViewEffect[]) => {
        effectHandler.playAll(effects)
      }

      const reopen = async () => {
        // isRetry: мы уже внутри повтора после восстановления — второй
        // SESSION_NOT_FOUND подряд означает нестабильный бэк; не зацикливаемся.
        if (isRetry) return
        // SCRUM-290: OPEN стал route-only. getLayoutCode() обычно null →
        // reopen уходит по route (маршрут между OPEN и reopen не меняется,
        // резолвится в тот же экран). Сохранённый layoutCode берём, если он
        // всё же есть (переходный период страниц, ещё шлющих layoutCode).
        const layoutCode = session.getLayoutCode?.() ?? undefined
        const ok = await dispatchAction({ type: 'OPEN', layoutCode })
        // Повторяем исходное действие, чтобы клик не терялся (кроме команд записи)
        if (ok && isRetryableAfterReopen(action, behavior)) {
          void dispatchAction(action, behavior, true)
        }
      }

      try {
        if (action.type === 'COMMAND' && shouldFlush) {
          try {
            await flushAllPendingTableCommits()
          } catch {
            showToast('error', i18n.t('sdui.tableFlushFailed'))
            return false
          }
        }

        // SCRUM-329: на write-команде (save/post) подсветить пустые обязательные
        // ячейки ТЧ — клиентский дублёр серверной 422-валидации. Сабмит не блокируем.
        if (shouldRevealTableErrors(action, behavior)) {
          revealAllTableErrors()
        }

        const route = location.pathname + location.search
        // Экземпляр формы этой вкладки — на КАЖДОМ OPEN (бэк: DocumentFormDraftStore).
        // Он же остаётся прежним при реопене после 409 и при переходе новый → записанный:
        // вкладка та же, значит и её черновик тот же.
        const freshInstance =
          action.type === 'OPEN' && opts?.freshOpen
            ? prepareFreshFormInstanceId(location.pathname)
            : null
        const openAction =
          action.type === 'OPEN'
            ? {
                ...action,
                formInstanceId:
                  freshInstance?.id ?? currentFormInstanceId(location.pathname),
              }
            : action
        const res = await viewTransport.post({
          // SCRUM-330 Работа 2: на OPEN шлём formSessionId, переживший F5 в
          // sessionStorage. Сейчас бэк его игнорирует (резюм отложен — v2 §2);
          // включение резюма будет односторонним, серверным, без правок фронта.
          formSessionId:
            action.type === 'OPEN'
              ? opts?.freshOpen
                ? null
                : readFormSession(route)
              : formSessionId,
          revision: action.type === 'OPEN' ? null : revision,
          ...(action.type === 'OPEN' && action.layoutCode
            ? { layoutCode: action.layoutCode }
            : {}),
          route,
          action: openAction,
        })

        if (action.type === 'OPEN') {
          if (
            (opts?.acceptOpenResponse && !opts.acceptOpenResponse()) ||
            (freshInstance && !freshInstance.commit())
          ) {
            if (res.formSessionId !== formSessionId) {
              void viewTransport
                .post({
                  formSessionId: res.formSessionId,
                  action: { type: 'CLOSE' },
                })
                .catch(() => undefined)
            }
            return false
          }
          applyOpenResponse(session, res, {
            route,
            layoutCode: action.layoutCode,
            onOpenTab: opts?.onOpenTab,
            playEffects,
          })
        } else if (action.type === 'CLOSE') {
          // reset is done by SduiScreen on unmount
          // Сессия закрыта штатно — резюмить после F5 больше нечего (SCRUM-330)
          clearFormSession(route)
        } else {
          // EVENT или COMMAND — единый порядок применения ответа (включая
          // авторитетный серверный dirty) — в applyServerPatches.
          applyServerPatches(session, res, {
            clearErrors: action.type === 'COMMAND',
            playEffects, // navigate играет здесь…
          })
          // SCRUM-277 §3.1: commandFailed=true — неуспех команды на 200-ответе.
          // Патчи/эффекты уже применены (бэк ими показывает причину), но
          // resetsDirty/closeAfter выполнять нельзя, и вызывающий код обязан
          // увидеть неуспех (false) — например, save → god.open не продолжается.
          // SCRUM-276 v7: касается и EVENT — отклонённая matrix-команда (stale
          // generation) возвращает false, чтобы ячейка откатила локальный буфер.
          if (res.commandFailed === true) return false
          if (action.type === 'COMMAND') {
            if (shouldReset) session.resetDirty()
            // Уже ли сервер увёл (эффект navigate)? Хост по этому флагу решает,
            // навигировать ли самому: закрытие вкладки (save+closeAfter, без
            // серверного navigate) → сесть на соседнюю; postAndClose (navigate в
            // список) → только закрыть, не перебивая серверный переход (SCRUM-283 v2).
            const didNavigate = (res.effects ?? []).some(
              (e) => e.type === 'navigate'
            )
            if (shouldClose) session.closeAfter?.(didNavigate) // …закрытие — после эффектов
          }
        }
        return true
      } catch (error) {
        if (
          action.type === 'OPEN' &&
          opts?.acceptOpenResponse &&
          !opts.acceptOpenResponse()
        ) {
          return false
        }
        handleDispatchError(error, {
          action,
          isRetry,
          pathname: location.pathname,
          session,
          opts,
          retry: () => dispatchAction(action, behavior, true),
          reopen,
        })
        return false
      } finally {
        if (inflightKey) useCommandInflightStore.getState().end(inflightKey)
      }
    },
    [
      location.pathname,
      location.search,
      navigate,
      setSearchParams,
      session,
      queryClient,
    ]
  )

  return dispatch
}
