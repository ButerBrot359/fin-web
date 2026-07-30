import { useState, useEffect, useRef } from 'react'

import type { ViewNode } from '../../types/view'
import { useSduiSession, useBindingValue } from '../sdui-session-context'
import { useSduiDispatch } from '../dispatch'
import {
  registerPendingFlush,
  unregisterPendingFlush,
} from '../pending-table-commits'

export interface TableColumnDef {
  id: string
  label: string
  binding: string
  flex?: number | string
  cellWidget: string
  dataType: string
  readonly?: boolean
  required?: boolean
  props: Record<string, unknown>
}

export interface TableRow {
  rowId: string
  [key: string]: unknown
}

const EMPTY_ROWS: TableRow[] = []

export interface UseTableSyncResult {
  rows: TableRow[]
  updateCell: (rowId: string, binding: string, value: unknown) => void
  commitCell: () => void
  addRow: (
    columns: TableColumnDef[],
    presetValues?: Record<string, unknown>
  ) => void
  deleteRow: (index: number) => void
  moveRow: (from: number, to: number) => void
}

function buildEmptyRow(columns: TableColumnDef[]): TableRow {
  const row: TableRow = { rowId: `tmp-${crypto.randomUUID()}` }
  for (const col of columns) {
    switch (col.dataType) {
      case 'STRING':
      case 'TEXT':
        row[col.binding] = ''
        break
      case 'INTEGER':
      case 'DECIMAL':
        row[col.binding] = 0
        break
      case 'BOOLEAN':
        row[col.binding] = false
        break
      default:
        row[col.binding] = null
        break
    }
  }
  return row
}

/**
 * Сериализация с сортировкой ключей — для сравнения «локальный снимок vs
 * отправленный». Обычный JSON.stringify считал бы расхождением разный порядок
 * ключей: локальная строка собирается спредом `{ ...r, [binding]: value }`, а
 * канон приходит с сервера в своём порядке. Ложное расхождение стоило бы
 * лишнего EVENT'а на каждом сохранении.
 */
function stableStringify(value: unknown): string {
  // JSON.stringify(undefined) === undefined, а тип в lib.d.ts обещает string —
  // отсекаем явной веткой, иначе `?? 'null'` считается лишним и падает лint.
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(',')}}`
}

function sameRows(a: TableRow[] | null, b: TableRow[] | null): boolean {
  return stableStringify(a) === stableStringify(b)
}

/**
 * Синхронизация табличной части с сервером (ADR-0011 §3.4: наверх всегда уезжает
 * ПОЛНЫЙ снимок строк, `fullSnapshot: true`).
 *
 * ## Инвариант flush-before-save (SCRUM-314 §6)
 *
 * `flushPending()` разрешается ТОЛЬКО тогда, когда серверу отправлен актуальный
 * локальный снимок таблицы. Не «когда закончился какой-то запрос» и не «когда
 * канон выглядел чистым».
 *
 * ЧТО БЫЛО СЛОМАНО. `inFlightRef` снимался единственным местом —
 * `useEffect([canonRows])`, то есть жизненный цикл запроса был завязан на
 * серверное эхо. А эхо опционально: `statePatch` в контракте бэка
 * (`ViewResponseDto`) описан как «опциональное зеркало… может отсутствовать…
 * его наличие/отсутствие — деталь реализации бэка», и `merge()` в `dispatch`
 * при отсутствии ключа не меняет идентичность `canonRows` — эффект не
 * срабатывает вовсе. Хук навсегда оставался «в полёте»: `commitCell` молча
 * выходил по раннему `return`, `flushPending` возвращал промис, который никто
 * не разрешал, а предохранитель `withTimeout` через 5 с считал flush
 * состоявшимся. «Записать» уходило по старому состоянию — аналитик описывала
 * это как «данные слетают, нужно опять заполнять».
 *
 * ЧТО СТАЛО. Три опоры:
 *   1. `sentRowsRef` — снимок, реально ушедший последним `sendEvent`. Сравнение
 *      с ним, а не с каноном, отвечает на вопрос «сервер уже знает то, что
 *      набрал пользователь?».
 *   2. `inFlight` снимается по промису `dispatch` — он settl-ится всегда, и на
 *      успехе, и на ошибке, в отличие от серверного эха.
 *   3. `drain()` — ЕДИНСТВЕННАЯ точка решения «дослать или разрешить промис».
 *
 * `useEffect([canonRows])` при этом занимается только реконсиляцией показа:
 * накладывает накопленные правки на канон. Он ничего не шлёт и ничего не
 * разрешает — именно смешение этих ролей и порождало гонку.
 */
export function useTableSync(
  node: ViewNode,
  columns: TableColumnDef[]
): UseTableSyncResult {
  const { setValue } = useSduiSession()
  const dispatch = useSduiDispatch()

  // Реактивная подписка на canon (как master-detail в SCRUM-282 #4): getValue давал
  // разовый снимок — серверный setValue из COMMAND-ответа (например, «Заполнить (ПК)»)
  // не ре-рендерил таблицу, строки молча терялись до следующего чужого рендера.
  const canonRows =
    (useBindingValue(node.binding) as TableRow[] | undefined) ?? EMPTY_ROWS
  const [localRows, setLocalRows] = useState<TableRow[]>(canonRows)

  // Keep a ref in sync with localRows to avoid stale closures
  const localRowsRef = useRef<TableRow[]>(canonRows)
  // Канон тоже в ref: drain() зовётся из .then(dispatch), то есть из замыкания
  // произвольного рендера — читать canonRows из замыкания там нельзя.
  const canonRowsRef = useRef<TableRow[]>(canonRows)

  const inFlightRef = useRef(false)
  const dirtyRef = useRef<Map<string, Record<string, unknown>>>(new Map())
  // Flag to trigger a coalesced commit after in-flight response arrives.
  // Replaces sentinel entries (__delete__, __move__) to avoid phantom rows.
  const needsCoalescedCommitRef = useRef(false)
  // Снимок, ушедший последним sendEvent — опора инварианта flush-before-save.
  const sentRowsRef = useRef<TableRow[] | null>(null)
  // Promise resolve/reject for flush-before-save.
  const flushResolveRef = useRef<(() => void) | null>(null)
  const flushRejectRef = useRef<((err: Error) => void) | null>(null)

  // Track which columns are readonly so re-apply skips them
  const readonlyBindings = useRef(new Set<string>())
  useEffect(() => {
    const s = new Set<string>()
    for (const col of columns) {
      if (col.readonly) s.add(col.binding)
    }
    readonlyBindings.current = s
  }, [columns])

  // ── Flush promise ──

  const settleFlush = (err?: Error) => {
    const resolve = flushResolveRef.current
    const reject = flushRejectRef.current
    flushResolveRef.current = null
    flushRejectRef.current = null
    if (err) reject?.(err)
    else resolve?.()
  }

  // drain() определён ниже, а sendEvent должен его звать — держим через ref,
  // чтобы .then() всегда попадал в актуальную версию, а не в замыкание рендера.
  const drainRef = useRef<() => void>(() => undefined)

  // ── Send EVENT with full row array ──
  const sendEvent = (rows: TableRow[]) => {
    // Единственная точка «мы отправили»: здесь же гасим накопленное. Раньше
    // dirtyRef чистили пять разных мест, и рассинхрон между ними и был гонкой.
    sentRowsRef.current = rows
    dirtyRef.current = new Map()
    needsCoalescedCommitRef.current = false
    inFlightRef.current = true

    void dispatch({
      type: 'EVENT',
      sourceNodeId: node.id,
      trigger: 'change',
      value: rows,
      // rows здесь всегда полный локальный снимок (ADR-0011 §3.4) — маркер безусловный
      fullSnapshot: true,
    }).then((ok) => {
      inFlightRef.current = false
      if (ok) {
        drainRef.current()
        return
      }
      // Ошибка сети/сервера: сервер НЕ получил снимок. Забываем «отправленное»
      // (иначе следующий flush счёл бы состояние синхронным) и роняем промис,
      // чтобы «Записать» не выполнилось по неполному состоянию.
      sentRowsRef.current = null
      dirtyRef.current = new Map()
      needsCoalescedCommitRef.current = false
      settleFlush(new Error('table commit failed'))
    })
  }

  /** Есть ли что-то, чего сервер ещё не видел. */
  const hasPendingWork = (): boolean =>
    dirtyRef.current.size > 0 ||
    needsCoalescedCommitRef.current ||
    !sameRows(localRowsRef.current, sentRowsRef.current ?? canonRowsRef.current)

  /**
   * Единственная точка решения после завершения запроса: дослать накопленное
   * или разрешить flush. Правка, сделанная пока запрос был в полёте, попадает
   * сюда и уезжает следующим EVENT'ом — промис до этого не разрешается.
   */
  const drain = () => {
    if (inFlightRef.current) return
    if (hasPendingWork()) {
      sendEvent(localRowsRef.current)
      return
    }
    settleFlush()
  }

  // ── React to server canon changes: ТОЛЬКО реконсиляция показа ──
  //
  // set-state-in-effect отключён осознанно и точечно. Это ровно тот случай, для
  // которого правило делает исключение по смыслу: локальное состояние таблицы
  // синхронизируется с ВНЕШНИМ источником — канон живёт в zustand-сторе и
  // меняется ответами сервера, а не рендером. Рекомендованная альтернатива
  // (derive-during-render) здесь требует читать dirtyRef/readonlyBindings во
  // время рендера, то есть менять одно нарушение на другое.
  // Правило начало срабатывать только после того, как файл стал компилируемым
  // для React-анализатора (до SCRUM-314 он на нём бейлился) — паттерн старый,
  // не новый. Переезд на useSyncExternalStore — отдельная задача.
  useEffect(() => {
    // Структурная правка (add/delete/move) ещё не доехала до сервера: канон о
    // ней не знает, и пересборка из канона воскресила бы удалённую строку.
    // Локальный снимок здесь авторитетнее — его отправит drain().
    if (needsCoalescedCommitRef.current) return

    const dirty = dirtyRef.current

    if (dirty.size === 0) {
      // Локальных правок поверх канона нет — принимаем канон как есть.
      const next = canonRows
      // eslint-disable-next-line react-hooks/set-state-in-effect -- см. выше
      setLocalRows(next)
      localRowsRef.current = next
      // Канон и есть то, что знает сервер. Синхронизируем «отправленное», иначе
      // серверная нормализация значений (пересчёт итогов и т.п.) выглядела бы
      // расхождением и стоила лишнего EVENT'а на следующем flush.
      if (!inFlightRef.current) sentRowsRef.current = next
      return
    }

    // Re-apply dirty snapshot over canon
    const merged = canonRows.map((row) => {
      const patch = dirty.get(row.rowId)
      if (!patch) return row
      const result = { ...row }
      for (const [key, val] of Object.entries(patch)) {
        // Skip readonly columns — those come from server
        if (!readonlyBindings.current.has(key)) {
          result[key] = val
        }
      }
      return result
    })

    // Keep rows that exist only locally (added while in-flight, with tmp- ids).
    for (const [rowId, patch] of dirty) {
      if (canonRows.some((r) => r.rowId === rowId)) continue
      merged.push({ rowId, ...patch } as TableRow)
    }

    setLocalRows(merged)
    localRowsRef.current = merged
    // Ни sendEvent, ни разрешения промиса здесь нет — этим заведует drain(),
    // привязанный к завершению запроса, а не к приходу канона.
  }, [canonRows])

  // ── Public API ──

  const updateCell = (rowId: string, binding: string, value: unknown) => {
    setLocalRows((prev) => {
      const next = prev.map((r) =>
        r.rowId === rowId ? { ...r, [binding]: value } : r
      )
      // НЕ пишем в session-стор на каждый символ. Запись canon (node.binding)
      // меняла canonRows → срабатывал useEffect([canonRows]) → лишний ре-рендер;
      // вместе с пересозданием колонок это ремонтило ячейку и сбрасывало фокус
      // (баг «ввод по 1 символу»). Правка локальна (localRows); canon
      // синхронизируется на commit (blur/Enter → EVENT → серверный setValue).
      // ADR-0011: оптимистичный локальный эхо, canon — только от сервера.
      localRowsRef.current = next
      return next
    })

    // Record in dirty snapshot — always (not just when in-flight): dirty нужен
    // и для реконсиляции с каноном, и как признак «сервер этого ещё не видел».
    const dirty = dirtyRef.current
    const existing = dirty.get(rowId) ?? {}
    dirty.set(rowId, { ...existing, [binding]: value })
  }

  const commitCell = () => {
    if (inFlightRef.current) {
      // Правка уже в localRows и dirtyRef — её дошлёт drain(), когда завершится
      // текущий запрос. Именно этот ранний выход и терял данные, пока промис
      // flush'а разрешался по приходу «чистого» канона.
      return
    }
    sendEvent(localRowsRef.current)
  }

  const addRow = (
    cols: TableColumnDef[],
    presetValues?: Record<string, unknown>
  ) => {
    // presetValues — например, ключ связи master-detail (SCRUM-282 #4):
    // скрытая readonly-колонка иначе остаётся пустой и строка не матчится фильтром
    const newRow = { ...buildEmptyRow(cols), ...presetValues }
    const next = [...localRowsRef.current, newRow]
    setLocalRows(next)
    localRowsRef.current = next
    if (node.binding) setValue(node.binding, next)
    if (inFlightRef.current) {
      // Record entire new row in dirty; coalesced commit will send on response
      const { rowId, ...rest } = newRow
      dirtyRef.current.set(rowId, rest)
      needsCoalescedCommitRef.current = true
    } else {
      sendEvent(next)
    }
  }

  const deleteRow = (index: number) => {
    const prev = localRowsRef.current
    const next = prev.filter((_, i) => i !== index)
    setLocalRows(next)
    localRowsRef.current = next
    if (node.binding) setValue(node.binding, next)
    if (inFlightRef.current) {
      // Rebuild dirty: remove deleted row, keep rest
      if (index >= 0 && index < prev.length) {
        dirtyRef.current.delete(prev[index].rowId)
      }
      // Signal that a coalesced commit is needed after in-flight response
      needsCoalescedCommitRef.current = true
    } else {
      sendEvent(next)
    }
  }

  const moveRow = (from: number, to: number) => {
    const prev = localRowsRef.current
    const next = [...prev]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setLocalRows(next)
    localRowsRef.current = next
    if (node.binding) setValue(node.binding, next)
    if (inFlightRef.current) {
      // Signal that a coalesced commit is needed after in-flight response
      needsCoalescedCommitRef.current = true
    } else {
      sendEvent(next)
    }
  }

  const flushPending = (): Promise<void> => {
    if (!inFlightRef.current && !hasPendingWork()) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      flushResolveRef.current = resolve
      flushRejectRef.current = reject
      // В полёте — ждём: drain() дошлёт накопленное по завершении запроса и
      // разрешит промис, только когда отправленный снимок совпадёт с локальным.
      if (!inFlightRef.current) drain()
    })
  }

  // Keep a ref always pointing to the latest flushPending to avoid stale
  // closure when registered via useEffect([node.binding])
  const flushPendingRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Свежие значения для асинхронных путей: .then(dispatch) и реестр flush'ей
  // держат замыкания произвольного рендера. Пишем в эффекте, а не в теле
  // рендера: запись ref во время рендера ломает предположения React (и
  // запрещена правилом react-hooks/refs). Все читатели этих ref'ов —
  // обработчики событий и колбэки ответов, то есть заведомо после коммита,
  // поэтому обновления в эффекте им достаточно.
  useEffect(() => {
    canonRowsRef.current = canonRows
    drainRef.current = drain
    flushPendingRef.current = flushPending
  })

  // ── Register/unregister flush for flush-before-save ──
  useEffect(() => {
    if (!node.binding) return
    const token = registerPendingFlush(() => flushPendingRef.current())
    return () => {
      unregisterPendingFlush(token)
    }
  }, [node.binding])

  return {
    rows: localRows,
    updateCell,
    commitCell,
    addRow,
    deleteRow,
    moveRow,
  }
}
