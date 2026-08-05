import type { NavigateFunction } from 'react-router-dom'

import i18n from '@/app/config/i18n'
import { apiService } from '@/shared/api/api'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'
import { parseContentDispositionFilename } from './parse-content-disposition'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

export interface EffectHandlerDeps {
  navigate: NavigateFunction
  closeSession: () => Promise<void>
  openDialog: (effect: ViewEffect) => void
  closeDialog: (effect: ViewEffect) => void
  invalidateLists: () => void
  // Мост эффекта confirm (SCRUM-244 v3 §1.2): показать диалог с message и по
  // «Да» отправить command в ту же сессию; по «Нет» — no-op. Реализация в dispatch.
  confirm: (command: string, message: string) => void
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
        // SCRUM-244 v3 §1: message уже билингвально резолвлен сервером,
        // confirmCommand передаём как есть. Провод (диалог + COMMAND по «Да») —
        // в dispatch, здесь только вызываем мост.
        deps.confirm(effect.confirmCommand ?? '', effect.message ?? '')
        break

      case 'download': {
        if (!effect.url) break
        void apiService
          .getFileBlob({ url: effect.url })
          .then((res) => {
            const objectUrl = URL.createObjectURL(res.data)
            const disposition = res.headers['content-disposition'] as
              | string
              | undefined

            if (disposition && /attachment/i.test(disposition)) {
              // Сервер требует сохранение на диск (§3.5 SCRUM-268)
              const a = document.createElement('a')
              a.href = objectUrl
              a.download =
                parseContentDispositionFilename(disposition) || 'download'
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

  return { play, playAll }
}
