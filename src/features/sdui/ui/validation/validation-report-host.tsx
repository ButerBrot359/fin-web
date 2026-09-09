import { useEffect, useState, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import {
  isTargetNavigable,
  useValidationReportStore,
  type ValidationMessage,
  type ValidationReport,
} from '@/entities/validation-report'

import { findTargetAnchor } from '../../lib/validation/find-target-anchor'
import { revealBinding } from '../../lib/validation/reveal-bus'
import { targetBinding } from '../../lib/validation/target-binding'
import { ValidationPanel } from './validation-panel'
import { ValidationTooltip } from './validation-tooltip'

const POLL_INTERVAL_MS = 80
const POLL_DEADLINE_MS = 2000

/**
 * Хост панели ошибок и тултипа-навигатора (SCRUM-317). Монтируется один раз
 * на SDUI-экран — механизм не знает, какой объект открыт (v2 §4.4). Панель и
 * тултип питаются ОДНИМ отчётом и существуют одновременно (v2 §1).
 *
 * Ведение к цели — на смену АКТИВНОГО сообщения, не на перерисовку дерева
 * (v2 §7): иначе каждый патч формы забирал бы фокус у поля. Ожидание якоря —
 * опрос с дедлайном, не requestAnimationFrame: на неактивном окне rAF душится
 * почти до нуля.
 */
export const ValidationReportHost: FC = () => {
  const { pathname } = useLocation()
  const report = useValidationReportStore(
    (s): ValidationReport | undefined => s.reports[pathname]
  )
  const activeId = useValidationReportStore(
    (s): string | null | undefined => s.activeIds[pathname]
  )
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)

  const active = report?.messages.find((m) => m.id === activeId) ?? null

  useEffect(() => {
    setAnchorEl(null)
    if (!active) return
    const binding = targetBinding(active)
    if (!binding) return

    // Вкладка переключается ДО поиска: содержимое неактивной не смонтировано.
    revealBinding(binding)

    let cancelled = false
    const startedAt = performance.now()
    const scope = document.querySelector('[data-sdui-screen-root]')
    if (!scope) return

    const tryFind = (isFirstHit: boolean) => {
      if (cancelled) return
      const el = findTargetAnchor(scope, active)
      if (el) {
        setAnchorEl(el)
        if (isFirstHit) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        // Фокус/перерисовка могли заменить узел целиком (v2 §7): не угадываем
        // момент, а сходимся — переспрашиваем элемент и переставляем якорь.
        setTimeout(() => {
          if (!el.isConnected) tryFind(false)
        }, 300)
        return
      }
      if (performance.now() - startedAt < POLL_DEADLINE_MS) {
        setTimeout(() => {
          tryFind(isFirstHit)
        }, POLL_INTERVAL_MS)
      }
    }
    tryFind(true)

    return () => {
      cancelled = true
    }
  }, [active, pathname])

  if (!report) return null

  const navigable = report.messages.filter((m) => isTargetNavigable(m.target))
  const activeNavigableIndex = active
    ? navigable.findIndex((m) => m.id === active.id)
    : -1

  const store = useValidationReportStore.getState()

  const selectMessage = (message: ValidationMessage) => {
    // Клик по строке панели ведёт к цели; безадресная строка с легаси-кодом
    // (attributeCode) тоже пробует подсветиться — v2 §2.6.
    store.setActive(pathname, message.id)
  }

  return (
    <>
      <ValidationPanel
        report={report}
        activeId={activeId ?? null}
        onSelect={selectMessage}
        onClose={() => {
          store.clear(pathname)
        }}
      />
      {active && anchorEl && (
        <ValidationTooltip
          anchorEl={anchorEl}
          message={active}
          position={activeNavigableIndex >= 0 ? activeNavigableIndex + 1 : 0}
          total={navigable.length}
          onPrev={() => {
            store.stepActive(pathname, -1)
          }}
          onNext={() => {
            store.stepActive(pathname, 1)
          }}
          onClose={() => {
            store.setActive(pathname, null)
          }}
        />
      )}
    </>
  )
}
