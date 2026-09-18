import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import type { AutoAdvanceColumnContext } from '../utils/build-column-defs'
import {
  findAutoAdvanceColumn,
  type AutoAdvanceTarget,
} from '../utils/table-auto-advance'
import type {
  TableColumnDef,
  TableRow,
  UseTableSyncResult,
} from './use-table-sync'

export interface UseAutoAdvanceParams {
  /** SCRUM-363: строго по серверному флагу `props.autoAdvance`. */
  enabled: boolean
  flatColumns: TableColumnDef[]
  /** Актуальный sync (см. syncRef-приём в таблице): rows + flushPending. */
  syncRef: RefObject<UseTableSyncResult>
  /** Тот же addRow, что у кнопки «Добавить» (master-detail пресет включён). */
  handleAdd: () => TableRow | null
  /** Контейнер СВОЕЙ таблицы: цель ищется строго внутри него. */
  containerRef: RefObject<HTMLDivElement | null>
}

export interface UseAutoAdvanceResult {
  /** Контекст для buildColumnDefs; undefined — автопереход выключен. */
  autoAdvanceCtx: AutoAdvanceColumnContext | undefined
  /** Кнопка «Добавить» с автофокусом первой подходящей ячейки (§4.3). */
  handleAddWithAutoAdvance: () => void
}

/**
 * SCRUM-363: потоковый ввод строк «как в 1С» — механика автоперехода
 * (§4.2–§4.5 спеки) между ячейками редактируемой ТЧ.
 */
export function useAutoAdvance({
  enabled,
  flatColumns,
  syncRef,
  handleAdd,
  containerRef,
}: UseAutoAdvanceParams): UseAutoAdvanceResult {
  // ── Одноразовая цель автофокуса ──
  // Цель в ref (не в state): её смена не должна пересобирать колонки —
  // пересборка ремонтирует активный редактор и сбрасывает фокус. Ре-рендер и
  // активацию цели заказывает отдельный tick.
  const autoAdvanceTargetRef = useRef<AutoAdvanceTarget | null>(null)
  const autoAdvanceSeqRef = useRef(0)
  const [autoAdvanceTick, setAutoAdvanceTick] = useState(0)
  // Колбэк commit — через ref: колонки мемоизированы, а замыкание должно быть
  // свежим (тот же приём, что syncRef в таблице).
  const autoAdvanceCommitRef = useRef<(rowId: string, binding: string) => void>(
    () => undefined
  )
  const autoAdvanceCtx = useMemo<AutoAdvanceColumnContext | undefined>(
    () =>
      enabled
        ? {
            targetRef: autoAdvanceTargetRef,
            onCellCommit: (rowId, binding) => {
              autoAdvanceCommitRef.current(rowId, binding)
            },
          }
        : undefined,
    [enabled]
  )

  // Ставит цель на первую подходящую ячейку строки (после afterBinding);
  // false — подходящих справа нет.
  const setAutoAdvanceTarget = (row: TableRow, afterBinding?: string) => {
    const col = findAutoAdvanceColumn(flatColumns, row, afterBinding)
    if (!col) return false
    autoAdvanceTargetRef.current = {
      rowId: row.rowId,
      binding: col.binding,
      cellWidget: col.cellWidget,
      sequence: ++autoAdvanceSeqRef.current,
    }
    setAutoAdvanceTick((t) => t + 1)
    return true
  }

  // Конец строки (§4.5): ровно одна новая строка через тот же addRow, что и
  // кнопка; если и в ней подходящих ячеек нет — стоп, без рекурсии.
  const activateAutoAdvance = (row: TableRow, afterBinding?: string) => {
    if (setAutoAdvanceTarget(row, afterBinding)) return
    if (afterBinding === undefined) return
    const newRow = handleAdd()
    if (newRow) setAutoAdvanceTarget(newRow)
  }

  // Переход после commit (§4.4): только если commit пришёл из ТЕКУЩЕЙ ячейки
  // цепочки (посторонний blur-commit не должен воровать фокус, §4.6), и только
  // после того, как EVENT/PATCH roundtrip завершён и рендер применил патчи —
  // автозаполненные сервером поля (FizicheskoeLitso) уже не пустые и пропускаются.
  const handleAutoAdvanceCommit = (rowId: string, binding: string) => {
    const target = autoAdvanceTargetRef.current
    if (target?.rowId !== rowId || target.binding !== binding) return
    syncRef.current
      .flushPending()
      .then(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
      )
      .then(() => {
        const actualRow = syncRef.current.rows.find((r) => r.rowId === rowId)
        if (!actualRow) return
        activateAutoAdvance(actualRow, binding)
      })
      .catch(() => {
        // Ошибка отправки снимка: цепочку не продолжаем, фокус не трогаем.
      })
  }
  // Пишем в эффекте, а не в теле рендера (react-hooks/refs): читатели ref'а —
  // commit-колбэки cell-редакторов, они срабатывают заведомо после коммита
  // рендера (образец: use-table-sync).
  useEffect(() => {
    autoAdvanceCommitRef.current = handleAutoAdvanceCommit
  })

  // Кнопка «Добавить» (§4.3): в autoAdvance-таблице фокус сам встаёт в первую
  // подходящую ячейку новой строки; обычные таблицы автофокус не получают.
  const handleAddWithAutoAdvance = () => {
    const row = handleAdd()
    if (enabled && row) setAutoAdvanceTarget(row)
  }

  // Активация цели (§5.5): после render находим ячейку СТРОГО внутри своего
  // контейнера (две таблицы на форме — общий document.querySelector нашёл бы
  // чужую), фокусируем её ввод; ссылочной/enum-ячейке раскрываем список.
  // consumed — одноразовость автооткрытия: повторный ручной фокус в той же
  // ячейке список сам не раскрывает (§4.6), но commit по ней цепочку продолжает.
  useEffect(() => {
    if (autoAdvanceTick === 0) return
    const target = autoAdvanceTargetRef.current
    if (!target || target.consumed) return
    const frame = requestAnimationFrame(() => {
      target.consumed = true
      const container = containerRef.current
      if (!container) return
      const cell = container.querySelector(
        `[data-sdui-row-id="${CSS.escape(target.rowId)}"] ` +
          `[data-sdui-cell-binding="${CSS.escape(target.binding)}"]`
      )
      if (!cell) return
      const input = cell.querySelector<HTMLElement>(
        'input, textarea, [role="combobox"]'
      )
      input?.focus()
      if (target.cellWidget === 'REFERENCE_FIELD') {
        // openOnFocus обычно раскрывает список сам; страховка кадром позже —
        // штатный триггер (программный focus при пустых options может не
        // открыть). Проверка aria-expanded защищает от повторного toggle.
        requestAnimationFrame(() => {
          if (input?.getAttribute('aria-expanded') !== 'true') {
            cell
              .querySelector<HTMLElement>('button[aria-label="Open"]')
              ?.click()
          }
        })
      } else if (target.cellWidget === 'ENUM_FIELD') {
        // MUI Select открывается по mousedown на combobox-триггере.
        cell
          .querySelector<HTMLElement>('[role="combobox"]')
          ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      }
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [autoAdvanceTick, containerRef])

  return { autoAdvanceCtx, handleAddWithAutoAdvance }
}
