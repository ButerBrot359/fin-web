import { useEffect, useRef, useState } from 'react'

import { useSduiSession } from '../sdui-session-context'
import { rowContentSignature } from '../utils/master-detail'
import type { TableRow } from './use-table-sync'

export interface UseRowSelectionIdentityResult {
  selectedRowId: string | null
  /** Индекс выбранной строки в видимом наборе; -1 — выбора нет. */
  selectedVisibleIndex: number
  /** Клик по строке: выделение + публикация `__selectedRowId` для detail-ТЧ. */
  selectRow: (rowId: string) => void
  /** Локальный сброс выделения (после удаления строки). */
  clearSelection: () => void
  /**
   * Правка пользователя в ячейке: у ВЫБРАННОЙ строки взводит одноразовое
   * эхо-разрешение (см. serverEchoAllowedRef ниже). Зовётся обёрткой updateCell.
   */
  noteUserEdit: (rowId: string) => void
}

/**
 * Идентичность выбранной строки ТЧ (SCRUM-291 §0.5 дефект 2): выделение по
 * rowId + подпись содержимого, публикация выбора для master-detail и сброс,
 * когда строка выпала из набора или была подменена сервером.
 */
export function useRowSelectionIdentity(
  binding: string | undefined,
  visibleRows: TableRow[]
): UseRowSelectionIdentityResult {
  const { setFromServer } = useSduiSession()

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  // Подпись содержимого выбранной строки на момент выбора — пара «id +
  // подпись» (SCRUM-291 §0.5 дефект 2). Устойчивого id строки в контракте
  // нет: у части типов документов (ИПН) rowId — порядковый номер, и
  // пересборка ТЧ перенумеровывает строки заново, поэтому «та же запись»
  // определяется по содержимому, а не по rowId. Пара, а не голая строка:
  // без rowId в паре переход на другую строку (другое содержимое, другой
  // rowId) выглядел бы как подмена под старым rowId.
  const selectedSignatureRef = useRef<{
    rowId: string
    signature: string
  } | null>(null)
  // Правка пользователя в ВЫБРАННОЙ строке взводит одноразовое разрешение принять
  // следующее серверное изменение её содержимого как ОТВЕТ на эту правку, а не как
  // подмену записи. Иначе документ, где сервер дозаполняет строку по выбранной
  // ссылке («Корректировка параметров учёта ОС»: выбрал ОС → приехали инв. номер,
  // счёт и стоимости), снимал выделение сам, и следующая построчная команда
  // («Удалить», «Скопировать») отвечала «Выберите строку». Разрешение одноразовое:
  // перестройка ТЧ, не вызванная правкой, выделение по-прежнему снимает.
  const serverEchoAllowedRef = useRef(false)

  // Правка ВЫБРАННОЙ строки — собственный ввод пользователя, а не подмена
  // записи сервером. Сброс захваченной подписи ПЕРЕД вызовом настоящего
  // updateCell — эффект ниже увидит «подписи ещё нет» на следующем рендере и
  // просто пере-снимет свежую, не сочтя правку подменой (иначе обе
  // редактируемые таблицы ИПН теряли бы выделение на каждый введённый символ).
  const noteUserEdit = (rowId: string) => {
    if (rowId === selectedRowId) {
      selectedSignatureRef.current = null
      serverEchoAllowedRef.current = true
    }
  }

  // Publish selected rowId to session for detail tables
  const selectRow = (rowId: string) => {
    if (rowId !== selectedRowId) serverEchoAllowedRef.current = false
    setSelectedRowId(rowId)
    if (binding) {
      setFromServer(binding + '.__selectedRowId', rowId)
    }
  }

  const clearSelection = () => {
    setSelectedRowId(null)
  }

  // Индекс выбранной строки в текущем видимом наборе (не в полном sync.rows —
  // при активном master-detail фильтре это разные массивы, SCRUM-282 C1).
  const selectedVisibleIndex =
    selectedRowId != null
      ? visibleRows.findIndex((r) => r.rowId === selectedRowId)
      : -1

  // Сброс выбора, если выбранная строка выпала из видимого набора (смена
  // master-строки, удаление/фильтрация — SCRUM-282 I2) ИЛИ была подменена
  // сервером под тем же rowId (SCRUM-291 §0.5 дефект 2): у части типов
  // документов (ИПН и другие, где строки ТЧ собирает хендлер) rowId —
  // порядковый номер, и пересборка ТЧ перенумеровывает строки заново — номер
  // остаётся, запись за ним меняется. Устойчивого id строки в контракте пока
  // нет, поэтому «та же запись» определяется по содержимому
  // (`rowContentSignature`), а не по rowId.
  //
  // ВАЖНО: сброс снимает и публикацию выбора в сторе
  // (`setFromServer(..., null)`), не только локальный `selectedRowId` —
  // detail-таблица фильтрует именно по опубликованному значению
  // (`masterTable + '.__selectedRowId'`), и без снятия публикации она
  // продолжила бы показывать чужой график даже после локального сброса.
  //
  // Остаточная неточность (сознательный размен): серверная нормализация
  // значения уже ВЫБРАННОЙ строки (например, округление) тоже прочитается
  // как подмена и сбросит выделение — «безопасный», хоть и избыточный, сброс
  // предпочтительнее «опасной» пропущенной подмены, пока нет устойчивого id
  // строки (ADR-0027 или его аналог).
  useEffect(() => {
    if (selectedRowId == null) {
      selectedSignatureRef.current = null
      return
    }

    const resetSelection = () => {
      selectedSignatureRef.current = null
      setSelectedRowId(null)
      if (binding) {
        setFromServer(binding + '.__selectedRowId', null)
      }
    }

    const row = visibleRows.find((r) => r.rowId === selectedRowId)
    if (row === undefined) {
      resetSelection()
      return
    }

    const signature = rowContentSignature(row)
    const captured = selectedSignatureRef.current
    const substituted =
      captured !== null &&
      captured.rowId === selectedRowId &&
      captured.signature !== signature

    if (substituted && serverEchoAllowedRef.current) {
      // Ответ сервера на собственную правку пользователя — принимаем новую подпись.
      serverEchoAllowedRef.current = false
    } else if (substituted) {
      resetSelection()
      return
    }

    selectedSignatureRef.current = { rowId: selectedRowId, signature }
  }, [visibleRows, selectedRowId, binding, setFromServer])

  return {
    selectedRowId,
    selectedVisibleIndex,
    selectRow,
    clearSelection,
    noteUserEdit,
  }
}
