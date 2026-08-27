import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ActionBehavior, ViewAction, ViewTabMeta } from '../types/view'
import {
  viewTransport,
  ViewConflictError,
  ViewHttpError,
} from '../api/view-transport'
import { applyValuePatches } from './patch-applier'
import { validatePatches } from './validation'
import { handleConflict } from './conflict-handler'
import { createEffectHandler } from './effect-handler'
import { isRetryableAfterReopen } from './reopen-retry-policy'
import { useSduiSession } from './sdui-session-context'
import { usePanelStore } from './stores/panel-store'
import { useConfirmStore } from './stores/confirm-store'
import { useUnsavedChangesStore } from './stores/unsaved-changes-store'
import { flushAllPendingTableCommits } from './pending-table-commits'
import { revealAllTableErrors } from './table-validation-registry'
import { shouldRevealTableErrors } from './utils/reveal-policy'
import { openDialogAsPanel } from './open-dialog-panel'
import { relaySelectionToParent } from './relay-selection'
import { buildCommonEffectDeps } from './build-effect-deps'
import { useCommandInflightStore } from './stores/command-inflight-store'
import {
  clearFormSession,
  readFormSession,
  saveFormSession,
} from './form-session-storage'
import { useAsyncTaskStore } from '@/entities/async-task'

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
      }
    ): Promise<boolean> {
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

      const {
        replaceAll,
        merge,
        setSession,
        setRoot,
        bumpRevision,
        applyTreePatches,
        clearAllErrors,
        setFromServer,
        resetDirty,
        setDirty,
        closeAfter,
        setOnDirtyClose,
      } = session

      // Поведение действия приходит с бэка (SCRUM-283). Фолбэки асимметричны намеренно:
      // забытый flush = молчаливая потеря правок ТЧ → безопасная сторона true;
      // забытые resetsDirty/closeAfter безвредны (заметны) → false.
      const shouldFlush = behavior?.flushPendingTables ?? true
      const shouldReset = behavior?.resetsDirty ?? false
      const shouldClose = behavior?.closeAfter ?? false

      const common = buildCommonEffectDeps({
        navigate,
        session,
        queryClient,
        setSearchParams,
      })
      const effectHandler = createEffectHandler({
        ...common,
        closeDialog: (effect) => {
          if (effect.id) usePanelStore.getState().remove(effect.id)
          relaySelectionToParent(effect, (effects) => {
            effectHandler.playAll(effects)
          })
        },
        replaceDialog: (closes, open) => {
          // Одна транзакция стора вместо remove+push: панель не исчезает ни на
          // кадр, и хост не проигрывает анимацию появления (см. panel-store).
          const closeIds = closes
            .map((e) => e.id)
            .filter((id): id is string => typeof id === 'string')
          openDialogAsPanel(
            open,
            session.getSession().formSessionId ?? undefined,
            closeIds
          )
          // Ретрансляция выбора родителю к анимации отношения не имеет, но
          // живёт на ЗАКРЫВАЕМОМ эффекте — пропустить её здесь значило бы
          // потерять её в паре (SCRUM-265: выбор из дочерней панели).
          for (const close of closes) {
            relaySelectionToParent(close, (effects) => {
              effectHandler.playAll(effects)
            })
          }
        },
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
                  void dispatchAction({
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
              void dispatchAction(
                { type: 'COMMAND', command: effect.confirmCommand ?? '' },
                effect.confirmBehavior
              )
            })
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
              void dispatchAction(
                { type: 'COMMAND', command },
                answer === 'save' ? effect.saveBehavior : effect.discardBehavior
              )
            })
        },
      })

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
        const res = await viewTransport.post({
          // SCRUM-330 Работа 2: на OPEN шлём formSessionId, переживший F5 в
          // sessionStorage. Сейчас бэк его игнорирует (резюм отложен — v2 §2);
          // включение резюма будет односторонним, серверным, без правок фронта.
          formSessionId:
            action.type === 'OPEN' ? readFormSession(route) : formSessionId,
          revision: action.type === 'OPEN' ? null : revision,
          ...(action.type === 'OPEN' && action.layoutCode
            ? { layoutCode: action.layoutCode }
            : {}),
          route,
          action,
        })

        if (action.type === 'OPEN') {
          setSession(res.formSessionId, res.revision)
          saveFormSession(route, res.formSessionId)
          session.setLayoutCode?.(action.layoutCode ?? null)
          if (res.tree) setRoot(res.tree)
          setOnDirtyClose?.(res.onDirtyClose ?? null)
          opts?.onOpenTab?.(res.tab ?? null)
          replaceAll(res.state ?? {})
          // Apply handler.handleOpen patches (e.g. required/enabled/label defaults)
          const openPatches = validatePatches(res.patches)
          applyTreePatches(openPatches)
          applyValuePatches(openPatches, setFromServer)
          effectHandler.playAll(res.effects ?? [])
        } else if (action.type === 'CLOSE') {
          // reset is done by SduiScreen on unmount
          // Сессия закрыта штатно — резюмить после F5 больше нечего (SCRUM-330)
          clearFormSession(route)
        } else {
          // EVENT or COMMAND — order is critical: revision → clear old errors → tree patches → value patches → effects
          bumpRevision(res.revision)
          if (action.type === 'COMMAND') clearAllErrors()
          const patches = validatePatches(res.patches)
          applyTreePatches(patches)
          applyValuePatches(patches, setFromServer)
          merge(res.statePatch ?? {})
          // SCRUM-288 §2.5: серверный dirty авторитетен и ПЕРЕКРЫВАЕТ клиентский флаг
          // (включая false с LIST/REPORT). null/undefined — «решай сам».
          if (res.dirty != null) setDirty(res.dirty)
          effectHandler.playAll(res.effects ?? []) // navigate играет здесь…
          // SCRUM-277 §3.1: commandFailed=true — неуспех команды на 200-ответе.
          // Патчи/эффекты уже применены (бэк ими показывает причину), но
          // resetsDirty/closeAfter выполнять нельзя, и вызывающий код обязан
          // увидеть неуспех (false) — например, save → god.open не продолжается.
          // SCRUM-276 v7: касается и EVENT — отклонённая matrix-команда (stale
          // generation) возвращает false, чтобы ячейка откатила локальный буфер.
          if (res.commandFailed === true) return false
          if (action.type === 'COMMAND') {
            if (shouldReset) resetDirty()
            // Уже ли сервер увёл (эффект navigate)? Хост по этому флагу решает,
            // навигировать ли самому: закрытие вкладки (save+closeAfter, без
            // серверного navigate) → сесть на соседнюю; postAndClose (navigate в
            // список) → только закрыть, не перебивая серверный переход (SCRUM-283 v2).
            const didNavigate = (res.effects ?? []).some(
              (e) => e.type === 'navigate'
            )
            if (shouldClose) closeAfter?.(didNavigate) // …закрытие — после эффектов
          }
        }
        return true
      } catch (error) {
        if (error instanceof ViewConflictError) {
          const retry =
            !isRetry && action.type !== 'OPEN'
              ? () => dispatchAction(action, behavior, true)
              : null
          handleConflict(error.data, { setSession, replaceAll }, retry, reopen)
        } else if (error instanceof ViewHttpError && action.type === 'OPEN') {
          // Единый гейт раскатки под catch-all (§2 бэк-спеки SCRUM-290):
          // ROUTE_UNKNOWN → «не найдено»; SCREEN_NOT_SDUI / унаследованный
          // 404 → легаси-фолбэк. Без подходящего колбэка — общий тост, как раньше.
          if (
            error.status === 404 &&
            error.code === 'ROUTE_UNKNOWN' &&
            opts?.onRouteUnknown
          ) {
            opts.onRouteUnknown()
          } else if (
            error.status === 422 &&
            error.code === 'SCREEN_NOT_SDUI' &&
            opts?.onOpenNotFound
          ) {
            opts.onOpenNotFound({ kind: error.kind })
          } else if (error.status === 404 && opts?.onOpenNotFound) {
            opts.onOpenNotFound(undefined)
          } else {
            showToast('error', error.message || i18n.t('sdui.requestError'))
          }
        } else {
          const message =
            error instanceof Error ? error.message : i18n.t('sdui.requestError')
          showToast('error', message)
        }
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
