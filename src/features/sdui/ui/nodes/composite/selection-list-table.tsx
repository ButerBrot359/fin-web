import { useMemo, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { useResolvedOptionsParams } from '../../../lib/hooks/use-resolved-options-params'
import type { OptionsParamValue } from '../../../lib/utils/resolve-options-params'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { renderCellValue } from '../../../lib/utils/cell-value'
import { extractReadOnlyColumns } from '../../../lib/utils/read-only-header-model'
import { openReferencePicker } from '../../../lib/reference-picker-gateway'

interface SelectionRow {
  rowId: string
  [key: string]: unknown
}

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

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
    null
  )

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
        Sotrudnik: { id: Number(opt.id), presentation: opt.label },
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

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ flex: '1 1 auto', overflowY: 'auto' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id}>
                  <Typography variant="body2" fontWeight={600}>
                    {col.label}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)}>
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => (
              <TableRow
                key={row.rowId}
                hover
                selected={row.rowId === selectedRowId}
                className="cursor-pointer"
                onClick={() => {
                  publish(row.rowId === selectedRowId ? null : row)
                }}
              >
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    {renderCellValue(
                      col.binding ? row[col.binding] : undefined
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
