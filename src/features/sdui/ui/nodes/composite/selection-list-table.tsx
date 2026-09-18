import { useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, TextField, Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'
import { AutocompleteInput } from '@/shared/ui/inputs'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { useResolvedOptionsParams } from '../../../lib/hooks/use-resolved-options-params'
import {
  useSelectionPublish,
  type SelectionRow,
} from '../../../lib/hooks/use-selection-publish'
import type { OptionsParamValue } from '../../../lib/utils/resolve-options-params'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { renderCellValue } from '../../../lib/utils/cell-value'
import { extractReadOnlyColumns } from '../../../lib/utils/read-only-header-model'
import { SelectionListRows } from './selection-list-rows'

/**
 * Список-ОТБОР: витрина формы, выбор строки в которой фильтрует другие таблицы
 * (`useExternalRowFilter`). Порт панели «Отбор по сотруднику» формы «Начисление
 * зарплаты сотрудникам»: слева список сотрудников документа, клик по строке
 * оставляет в табличных частях только его записи.
 *
 * Выбор публикуется в сессию под `<binding>.__selectedRowId` — тот же ключ, что
 * у master-detail, поэтому отбирающая сторона одна на оба механизма. Повторный
 * клик по выбранной строке снимает отбор (в эталоне ту же роль играет крестик
 * очистки поля отбора).
 */
export const SelectionListTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const { getValue, setFromServer } = useSduiSession()
  const dispatch = useSduiDispatch()

  const columns = useMemo(
    () => extractReadOnlyColumns(node.children),
    [node.children]
  )

  const rows = useMemo<SelectionRow[]>(() => {
    const raw = node.binding ? getValue(node.binding) : undefined
    return Array.isArray(raw) ? (raw as SelectionRow[]) : []
  }, [getValue, node.binding])

  // Порт «Отбор по сотруднику» → «Показать все» (1С: единое поле отбора и есть
  // автодополнение по справочнику Сотрудники, «Показать все» — ссылка внутри его
  // выпадающего списка, а не отдельная кнопка). domain/targetTypeCode/filter
  // кладёт бэк (emitOtborSotrudnikovPickerProps), фронт их не синтезирует —
  // тот же контракт, что у reference-field-node.
  const pickerDomain = node.props?.domain as string | undefined
  const pickerTypeCode = node.props?.targetTypeCode as string | undefined
  const pickerFilter = node.props?.filter as Record<string, unknown> | undefined
  const pickerSearchParams = pickerFilter
    ? Object.fromEntries(
        Object.entries(pickerFilter).map(([k, v]) => [k, String(v)])
      )
    : undefined

  // optionsSource — тот же RefEndpointResolver.forOptions, что строит поиск
  // ссылочным полям (см. reference-field-node.tsx). Бэк его кладёт не всегда
  // (required=false резолвер) — тогда поле отбора остаётся клиентским фильтром
  // уже загруженных строк ТЧ, без live-поиска по всему справочнику.
  const optionsSource = node.props?.optionsSource as
    | { url: string; params?: Record<string, OptionsParamValue> }
    | undefined
  const url = optionsSource?.url ?? null
  const resolvedParams = useResolvedOptionsParams(optionsSource?.params)
  const [inputValue, setInputValue] = useState('')
  const { options, loading, load, loadDebounced } = useReferenceOptions(
    (search?: string) =>
      url
        ? fetchReferenceOptions({ url, params: resolvedParams, search })
        : Promise.resolve([]),
    JSON.stringify(resolvedParams)
  )

  // Список сотрудников документа может быть длинным (десятки строк), а панель
  // узкая — искать глазами неудобно. Без optionsSource фильтр чисто клиентский:
  // строки уже целиком загружены (витрина формы), сервер тут ни при чём. При
  // наличии optionsSource поиск уходит в справочник — таблица показывает все
  // строки ТЧ как есть, отбор делает сам выбор в автокомплите.
  const [query, setQuery] = useState('')
  const visibleRows = useMemo(() => {
    if (optionsSource) return rows
    const nuzhno = query.trim().toLowerCase()
    if (!nuzhno) return rows
    return rows.filter((row) =>
      columns.some((col) =>
        renderCellValue(col.binding ? row[col.binding] : undefined)
          .toLowerCase()
          .includes(nuzhno)
      )
    )
  }, [rows, columns, query, optionsSource])

  const rowLabel = (row: SelectionRow): string => {
    const firstColumn = columns.at(0)
    const rendered = renderCellValue(
      firstColumn?.binding ? row[firstColumn.binding] : undefined
    )
    return rendered || row.rowId
  }

  const {
    selectedRowId,
    selectedOption,
    publish,
    selectFromDictionary,
    showAllFromDictionary,
  } = useSelectionPublish({
    node,
    rows,
    rowLabel,
    setFromServer,
    dispatch,
    pickerDomain,
    pickerTypeCode,
    pickerSearchParams,
  })

  if ((node.props?.visible as boolean | undefined) === false) return null

  return (
    <Box className="flex min-h-0 flex-1 flex-col">
      <Box className="mb-2 flex items-center gap-2">
        <Typography variant="body2" fontWeight={600}>
          {(node.props?.label as string | undefined) ?? ''}
        </Typography>
        <Button
          variant="secondary"
          disabled={selectedRowId === null}
          onClick={() => {
            publish(null)
          }}
        >
          {t('table.clearFilter')}
        </Button>
        {pickerDomain && pickerTypeCode && !optionsSource && (
          <Button variant="secondary" onClick={showAllFromDictionary}>
            {t('table.showAllEmployees')}
          </Button>
        )}
      </Box>

      {optionsSource ? (
        <Box sx={{ mb: 1 }}>
          <AutocompleteInput
            size="small"
            fullWidth
            value={selectedOption}
            onChange={selectFromDictionary}
            inputValue={inputValue}
            options={options}
            loading={loading}
            label={t('table.searchPlaceholder')}
            onInputChange={(_e, val, reason) => {
              setInputValue(val)
              if (reason === 'input') loadDebounced(val)
            }}
            onOpen={() => {
              if (options.length === 0) load()
            }}
            onShowAll={
              pickerDomain && pickerTypeCode ? showAllFromDictionary : undefined
            }
          />
        </Box>
      ) : (
        <TextField
          size="small"
          fullWidth
          placeholder={t('table.searchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          sx={{ mb: 1 }}
        />
      )}

      <SelectionListRows
        columns={columns}
        rows={visibleRows}
        selectedRowId={selectedRowId}
        onRowClick={(row) => {
          publish(row.rowId === selectedRowId ? null : row)
        }}
      />
    </Box>
  )
}
