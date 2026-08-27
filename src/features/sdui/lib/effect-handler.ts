import type { NavigateFunction } from 'react-router-dom'

import i18n from '@/app/config/i18n'
import { apiService } from '@/shared/api/api'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'
import { createActionRequestExecutor } from './action-request'
import { parseContentDispositionFilename } from './parse-content-disposition'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

// SCRUM-288 §3.1: сохранение/превью blob — общая логика для GET (url) и POST
// (request) веток download, вынесена, чтобы не дублировать между ними.
function saveOrPreviewBlob(res: {
  data: Blob
  headers: Record<string, unknown>
}): void {
  const objectUrl = URL.createObjectURL(res.data)
  const disposition = res.headers['content-disposition'] as string | undefined

  if (disposition && /attachment/i.test(disposition)) {
    // Сервер требует сохранение на диск (§3.5 SCRUM-268)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = parseContentDispositionFilename(disposition) || 'download'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } else {
    // inline или без заголовка — превью в новой вкладке (как раньше)
    window.open(objectUrl, '_blank')
  }
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 60_000)
}

export interface EffectHandlerDeps {
  navigate: NavigateFunction
  closeSession: () => Promise<void>
  openDialog: (effect: ViewEffect) => void
  closeDialog: (effect: ViewEffect) => void
  invalidateLists: () => void
  // SCRUM-288 §2.3/§2.4: мост получает ВЕСЬ эффект (confirmCommand ИЛИ confirmRequest,
  // + confirmBehavior). Диалог и ветвление — в реализации (dispatch / use-sdui-effects).
  confirm: (effect: ViewEffect) => void
  // Замена панели: closeDialog(ы) + openDialog из ОДНОГО ответа исполняются
  // одной транзакцией стора, без анимации появления. Необязательный: без него
  // playAll играет ту же пару по очереди, как раньше (session-less путь).
  replaceDialog?: (closes: ViewEffect[], open: ViewEffect) => void
  // Диалог «Сохранить изменения?» с тремя ответами (эффект unsavedChanges).
  // Мост получает весь эффект: пара команд save/discard и их behavior —
  // серверные, фронт их не выводит. Реализация в dispatch, как у confirm.
  unsavedChanges: (effect: ViewEffect) => void
  // navigate с openInNewTab: маршрут открывается ОТДЕЛЬНОЙ рабочей вкладкой,
  // вкладка-источник остаётся жить. Реализация в dispatch.
  openRouteInNewTab: (route: string) => void
  // Мост эффекта replaceUrl (SCRUM-291 §7): обновить query-строку адресной
  // строки на месте (setSearchParams + replace:true) — БЕЗ push в историю,
  // БЕЗ ремаунта экрана, БЕЗ повторного OPEN сессии. В отличие от navigate,
  // сессию не трогает. Реализация в dispatch.
  replaceUrl: (route: string) => void
  // taskStarted (SCRUM-330 §3.3): фоновая операция запущена — регистрация
  // задачи под поллинг. Реализация в dispatch (нужен formSessionId сессии);
  // session-less путь (use-sdui-effects) деп не даёт — эффект туда прийти
  // не должен, отсутствие = warn.
  taskStarted?: (effect: ViewEffect) => void
}

/**
 * Пара «закрыть панель(и) → открыть панель» в ОДНОМ ответе — признак того, что
 * сервер пересобрал то же окно, а не открыл новое (смена режима формы строки,
 * переключение работника, пересчёт).
 *
 * Условия намеренно узкие: ровно один `openDialog`, и он идёт ПОСЛЕ закрытий.
 * Всё прочее (одиночное закрытие, одиночное открытие, открытие до закрытия)
 * остаётся на прежнем последовательном пути — swap там ничего не улучшает, а
 * порядок эффектов ломать нельзя.
 */
function planDialogSwap(
  effects: ViewEffect[]
): { closes: ViewEffect[]; open: ViewEffect } | null {
  const opens = effects.filter((e) => e.type === 'openDialog')
  if (opens.length !== 1) return null
  const open = opens[0]
  const closes = effects
    .slice(0, effects.indexOf(open))
    .filter((e) => e.type === 'closeDialog' && typeof e.id === 'string')
  return closes.length > 0 ? { closes, open } : null
}

export function createEffectHandler(deps: EffectHandlerDeps) {
  function play(effect: ViewEffect): void {
    switch (effect.type) {
      case 'navigate':
        // Единственный переключатель — флаг бэка. Состав маршрута (basisId,
        // dictBasisId, copyFrom) и имя команды фронт не разбирает: решение
        // «новой вкладкой или нет» принимает сервер, фронт исполняет.
        if (effect.openInNewTab) {
          // Сессию источника НЕ закрываем: его вкладка остаётся открытой, а её
          // кэш (sdui-cache-store) держит formSessionId с несохранёнными правками.
          deps.openRouteInNewTab(effect.route!)
          break
        }
        void deps.closeSession()
        void deps.navigate(effect.route!)
        break

      case 'openDialog':
        deps.openDialog(effect)
        break

      case 'closeDialog':
        deps.closeDialog(effect)
        break

      case 'replaceUrl':
        // Персист фильтра/сортировки/периода (SCRUM-291 §7): только query,
        // сессия и история не трогаются — см. комментарий на EffectHandlerDeps.
        if (effect.route) deps.replaceUrl(effect.route)
        break

      case 'notify':
        showToast((effect.level ?? 'info') as ToastLevel, effect.message ?? '')
        break

      case 'refresh':
        // Списки (LIST-ноды) перечитываются через TanStack Query. Payload
        // эффекта игнорируем намеренно: адресации в контракте нет (SCRUM-244 v3
        // §2 — поле id зарезервировано, но сервером не заполняется), инвалидация
        // всех SDUI-списков — ровно то поведение, на которое эффект рассчитан.
        deps.invalidateLists()
        break

      case 'confirm':
        // SCRUM-244 v3 §1: message уже билингвально резолвлен сервером.
        // Провод (диалог + ветвление по confirmCommand/confirmRequest) —
        // в dispatch, здесь только вызываем мост с целым эффектом.
        deps.confirm(effect)
        break

      case 'unsavedChanges':
        // Текста у эффекта нет: вопрос один и тот же во всех формах, поэтому
        // формулировки живут в i18n клиента (как у карточки документа).
        deps.unsavedChanges(effect)
        break

      case 'taskStarted':
        if (deps.taskStarted) {
          deps.taskStarted(effect)
        } else {
          console.warn('[sdui] эффект taskStarted вне форм-сессии', effect)
        }
        break

      case 'download': {
        // SCRUM-288 §3.1: есть request — исполняем его; иначе прежний GET по url.
        // SCRUM-362 B-7: метод читается из request.method (не «всегда POST»),
        // неизвестное значение — warn + отказ вместо тихого GET. Рантайм-гард
        // шире типа сознательно: контракту не доверяем на границе провода.
        const reqMethod: string | undefined = effect.request?.method
        if (effect.request && reqMethod !== 'GET' && reqMethod !== 'POST') {
          console.warn('[sdui] download request с неизвестным method', effect)
          break
        }
        const blobPromise = effect.request
          ? effect.request.method === 'POST'
            ? apiService.postFileBlob({
                url: effect.request.url,
                data: effect.request.body ?? undefined,
              })
            : apiService.getFileBlob({ url: effect.request.url })
          : effect.url
            ? apiService.getFileBlob({ url: effect.url })
            : null
        if (!blobPromise) break
        void blobPromise
          .then((res) => {
            saveOrPreviewBlob(res as never)
          })
          .catch(() => {
            showToast('error', i18n.t('sdui.downloadError'))
          })
        break
      }
    }
  }

  function playAll(effects: ViewEffect[]): void {
    // Пересборка окна приезжает парой «закрыть старую панель + открыть новую»
    // (у формы строки id несёт режим и поколение, поэтому он ДРУГОЙ). Играть их
    // по очереди — значит на кадр остаться без панели и заново проиграть
    // анимацию появления: пользователь видит, как окно закрывается и
    // открывается. Поэтому пара исполняется одним swap'ом.
    const swap = deps.replaceDialog ? planDialogSwap(effects) : null

    for (const effect of effects) {
      if (swap?.closes.includes(effect)) continue // сыграет replaceDialog
      if (effect === swap?.open) {
        deps.replaceDialog?.(swap.closes, effect)
        continue
      }
      play(effect)
      // confirm эксклюзивен (SCRUM-244 v3 §1.3): сервер обязан слать его
      // единственным, но обрываем массив на первом сами — двойная гарантия,
      // что за модальным подтверждением не сыграет второй эффект.
      // unsavedChanges — тот же контракт эксклюзивности (EffectType javadoc).
      if (effect.type === 'confirm' || effect.type === 'unsavedChanges') break
    }
  }

  const executeActionRequest = createActionRequestExecutor(playAll)

  return { play, playAll, executeActionRequest }
}
