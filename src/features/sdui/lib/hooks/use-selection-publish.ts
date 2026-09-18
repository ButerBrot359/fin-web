import { useRef, useState } from 'react'

import type { SelectOption } from '@/shared/types/select-option'

import type { ViewAction, ViewNode } from '../../types/view'
import { fromSelectOption } from '../utils/reference-value'
import { openReferencePicker } from '../reference-picker-gateway'

export interface SelectionRow {
  rowId: string
  [key: string]: unknown
}

interface UseSelectionPublishArgs {
  node: ViewNode
  rows: SelectionRow[]
  rowLabel: (row: SelectionRow) => string
  setFromServer: (binding: string, value: unknown) => void
  dispatch: (action: ViewAction) => Promise<unknown>
  pickerDomain?: string
  pickerTypeCode?: string
  pickerSearchParams?: Record<string, string>
}

/**
 * Публикация выбора списка-ОТБОРА (вынесено из selection-list-table.tsx,
 * поведение 1:1 при декомпозиции): владеет выбранной строкой/опцией и очередью
 * EVENT'ов, через которую выбор уходит на сервер строго в порядке кликов.
 */
export function useSelectionPublish({
  node,
  rows,
  rowLabel,
  setFromServer,
  dispatch,
  pickerDomain,
  pickerTypeCode,
  pickerSearchParams,
}: UseSelectionPublishArgs) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
    null
  )

  // Хвост очереди отправленных EVENT'ов этого узла. dispatch.ts даёт in-flight-
  // гард от параллельных запросов ТОЛЬКО action.type === 'COMMAND' (SCRUM-330,
  // строка 71); EVENT-путь им не защищён. При быстром переключении сотрудников
  // это гонка: два запроса уходят параллельно, и если ответ на БОЛЕЕ РАННИЙ
  // клик придёт по сети ПОЗЖЕ ответа на следующий, его patches применяются
  // последними и откатывают своды/подвалы «Итого» на прошлого сотрудника —
  // воспроизведено на стенде 03.09.2026 (footer показывал суммы предыдущего
  // выбора, хотя строки таблицы уже отфильтрованы по новому). Сериализация
  // очередью промисов гарантирует, что ответы применяются строго в порядке
  // кликов, а не в порядке прихода по сети.
  const pendingRef = useRef<Promise<unknown>>(Promise.resolve())

  // Выбор публикуется дважды: в сессию — для клиентского отбора строк ТЧ
  // (ОтборСтрокТабЧастей), и EVENT'ом на сервер — потому что от того же выбора
  // зависят свод «Итоги» (набор ФизЛица) и подвалы «Итого» вкладок
  // (ЗаполнитьПоляИтогиПоТабЧастям). Порт СписокСотрудниковВыбор :1103.
  const publish = (row: SelectionRow | null, option?: SelectOption | null) => {
    const rowId = row?.rowId ?? null
    setSelectedRowId(rowId)
    setSelectedOption(
      row
        ? (option ?? { id: row.rowId, code: row.rowId, label: rowLabel(row) })
        : null
    )
    if (node.binding) {
      setFromServer(node.binding + '.__selectedRowId', rowId)
    }
    if (
      node.actions?.some(
        (a) => a.trigger === 'change' && a.actionId === 'fieldEvent'
      )
    ) {
      pendingRef.current = pendingRef.current.then(() =>
        dispatch({
          type: 'EVENT',
          sourceNodeId: node.id,
          trigger: 'change',
          value: row,
        })
      )
    }
  }

  // Выбор из справочника (и live-поиск в поле отбора, и «Показать все» —
  // ссылка footer'а автокомплита): если сотрудник уже виден в панели (есть в ТЧ
  // документа), публикуем ЕГО строку, с обоими ключами отбора (Sotrudnik +
  // FizicheskoeLitso). Иначе строим минимальную: ФизЛицо сервер не пришлёт по
  // голому справочнику Sotrudniki, отбор восьми налоговых ТЧ по такому
  // сотруднику не сработает — деградация терпимая (нечего фильтровать, раз его
  // нет ни в одной ТЧ), а не потеря данных.
  const selectFromDictionary = (opt: SelectOption | null) => {
    if (!opt) {
      publish(null)
      return
    }
    const existing = rows.find((r) => r.rowId === String(opt.id))
    publish(
      existing ?? {
        rowId: String(opt.id),
        Sotrudnik: fromSelectOption(opt),
      },
      opt
    )
  }

  const showAllFromDictionary = () => {
    if (!pickerDomain || !pickerTypeCode) return
    openReferencePicker({
      mode: 'list',
      domain: pickerDomain,
      typeCode: pickerTypeCode,
      searchParams: pickerSearchParams,
      selectedId: selectedRowId ?? undefined,
      onSelect: selectFromDictionary,
    })
  }

  return {
    selectedRowId,
    selectedOption,
    publish,
    selectFromDictionary,
    showAllFromDictionary,
  }
}
