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
  // navigate с openInNewTab: маршрут открывается ОТДЕЛЬНОЙ рабочей вкладкой,
  // вкладка-источник остаётся жить. Реализация в dispatch.
  openRouteInNewTab: (route: string) => void
  // Мост эффекта replaceUrl (SCRUM-291 §7): обновить query-строку адресной
  // строки на месте (setSearchParams + replace:true) — БЕЗ push в историю,
  // БЕЗ ремаунта экрана, БЕЗ повторного OPEN сессии. В отличие от navigate,
  // сессию не трогает. Реализация в dispatch.
  replaceUrl: (route: string) => void
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
    for (const effect of effects) {
      play(effect)
      // confirm эксклюзивен (SCRUM-244 v3 §1.3): сервер обязан слать его
      // единственным, но обрываем массив на первом сами — двойная гарантия,
      // что за модальным подтверждением не сыграет второй эффект.
      if (effect.type === 'confirm') break
    }
  }

  const executeActionRequest = createActionRequestExecutor(playAll)

  return { play, playAll, executeActionRequest }
}
