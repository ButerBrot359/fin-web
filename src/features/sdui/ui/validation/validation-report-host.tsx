import { useEffect, useState, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import { tabRouteKey } from '@/shared/lib/router/form-instance-route'
import {
  isTargetNavigable,
  useValidationReportStore,
  type ValidationMessage,
  type ValidationReport,
} from '@/entities/validation-report'

import { findTargetAnchor } from '../../lib/validation/find-target-anchor'
import { registerFieldEditHandler } from '../../lib/validation/field-edit-bus'
import { revealBinding } from '../../lib/validation/reveal-bus'
import { targetBinding } from '../../lib/validation/target-binding'
import { ValidationPanel } from './validation-panel'
import { ValidationTooltip } from './validation-tooltip'

const POLL_INTERVAL_MS = 80
const POLL_DEADLINE_MS = 2000

/**
 * Хост панели ошибок и тултипа-навигатора (SCRUM-317). Монтируется один раз
 * на SDUI-экран — механизм не знает, какой объект открыт (v2 §4.4). Панель и
 * тултип питаются ОДНИМ отчётом; видимость тултипа — отдельное состояние
 * `tooltipOpen` (v4 §4.4): активное сообщение — «куда ведём», тултип — окно.
 *
 * Ведение к цели — на смену АКТИВНОГО сообщения, не на перерисовку дерева
 * (v2 §7): иначе каждый патч формы забирал бы фокус у поля. Ожидание якоря —
 * опрос с дедлайном, не requestAnimationFrame: на неактивном окне rAF душится
 * почти до нуля.
 */
export const ValidationReportHost: FC = () => {
  const location = useLocation()
  // Тот же ключ экрана, что у sdui-screen (SCRUM-360 v6 §6.3: pathname +
  // маркер isGroup) — отчёт «Создать группу» не смешивается с «Создать».
  const route = tabRouteKey(location.pathname, location.search)
  const report = useValidationReportStore(
    (s): ValidationReport | undefined => s.reports[route]
  )
  const activeId = useValidationReportStore(
    (s): string | null | undefined => s.activeIds[route]
  )
  // Отсутствие ключа = окно не открывалось; сравнение с undefined тут
  // прячет индексация без noUncheckedIndexedAccess — берём значение как есть,
  // рендер-условие ниже трактует undefined как false.
  const tooltipOpen = useValidationReportStore((s) => s.tooltipOpen[route])
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)

  const active = report?.messages.find((m) => m.id === activeId) ?? null

  // v4 §4.4 шаг 2: правка поля пользователем вычёркивает из панели строки
  // ТОЛЬКО полей шапки (FIELD) и безадресные с совпадающим легаси-кодом. У
  // сообщений о ТЧ binding — код всей таблицы, правка одной ячейки не должна
  // вычёркивать сообщения обо всех строках.
  useEffect(
    () =>
      registerFieldEditHandler((binding) => {
        const store = useValidationReportStore.getState()
        if (!(route in store.reports)) return
        const current = store.reports[route]
        const fixed = current.messages
          .filter(
            (m) =>
              (m.target?.kind === 'FIELD' || m.target == null) &&
              targetBinding(m) === binding
          )
          .map((m) => m.id)
        if (fixed.length > 0) store.dismiss(route, fixed)
      }),
    [route]
  )

  useEffect(() => {
    setAnchorEl(null)
    if (!active) return
    const binding = targetBinding(active)
    if (!binding) return

    // Вкладка переключается ДО поиска: содержимое неактивной не смонтировано.
    // v4 §4.5: вид цели сужает поиск вкладки (поле шапки ≠ колонка ТЧ).
    revealBinding(binding, active.target?.kind ?? null)

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
  }, [active, route])

  if (!report) return null

  const navigable = report.messages.filter((m) => isTargetNavigable(m.target))
  const activeNavigableIndex = active
    ? navigable.findIndex((m) => m.id === active.id)
    : -1

  const store = useValidationReportStore.getState()

  return (
    <>
      <ValidationPanel
        report={report}
        activeId={activeId ?? null}
        onSelect={(message: ValidationMessage) => {
          // Одиночный клик ведёт к цели, окно тултипа не трогает (v4 §4.4);
          // безадресная строка с легаси-кодом тоже пробует подсветиться (v2 §2.6).
          store.setActive(route, message.id)
        }}
        onActivate={(message: ValidationMessage) => {
          // Двойной клик возвращает окно тултипа (v4 §4.4).
          store.setActive(route, message.id)
          store.openTooltip(route)
        }}
        onClose={() => {
          store.clear(route)
        }}
      />
      {active && anchorEl && tooltipOpen && (
        <ValidationTooltip
          anchorEl={anchorEl}
          message={active}
          position={activeNavigableIndex >= 0 ? activeNavigableIndex + 1 : 0}
          total={navigable.length}
          onPrev={() => {
            store.stepActive(route, -1)
          }}
          onNext={() => {
            store.stepActive(route, 1)
          }}
          onClose={() => {
            // Крестик закрывает окно, активная строка панели остаётся (v4 §4.4).
            store.closeTooltip(route)
          }}
        />
      )}
    </>
  )
}
