import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'

import type { ReportFilterDto } from '@/pages/reports/report-list/types/report'

import {
  comparisonIsMulti,
  comparisonLabel,
  comparisonNeedsValue,
  type ReportFilterRow,
} from '../lib/report-filter-model'
import { FilterValueField } from './filter-value-field'

interface ReportFilterTableProps {
  /** Доступные поля отбора (КБП-каталог + субконто счёта) из /filter-fields. */
  fields: ReportFilterDto[]
  /** Текущие строки отбора (модель вкладки «Отборы»). */
  rows: ReportFilterRow[]
  onRowsChange: (rows: ReportFilterRow[]) => void
  isKz: boolean
}

/** Локализованный заголовок поля отбора. */
const fieldTitle = (f: ReportFilterDto, isKz: boolean): string =>
  (isKz ? f.titleKz : f.titleRu) || f.titleRu

/**
 * Таблица «Отборы» (СКД 1С): столбцы [✓] | Поле | Вид сравнения | Значение и
 * кнопка «Добавить» над таблицей. «Добавить» открывает меню доступных полей
 * (из /filter-fields, исключая уже добавленные). Каждая строка: чекбокс
 * (вкл/выкл отбора), поле, выпадашка вида сравнения и пикер значения по типу
 * поля. Значение скрывается для «Заполнено»/«Не заполнено».
 */
export const ReportFilterTable = ({
  fields,
  rows,
  onRowsChange,
  isKz,
}: ReportFilterTableProps) => {
  const { t } = useTranslation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const fieldByKey = useMemo(() => {
    const map = new Map<string, ReportFilterDto>()
    for (const f of fields) map.set(f.field, f)
    return map
  }, [fields])

  // Доступные для добавления поля: ещё не добавленные (субконто — вперёд).
  const usedKeys = useMemo(() => new Set(rows.map((r) => r.field)), [rows])
  const availableFields = useMemo(
    () =>
      fields
        .filter((f) => !usedKeys.has(f.field))
        .sort((a, b) => {
          const ga = a.group === 'subkonto' ? 0 : 1
          const gb = b.group === 'subkonto' ? 0 : 1
          if (ga !== gb) return ga - gb
          return (a.position ?? 99) - (b.position ?? 99)
        }),
    [fields, usedKeys]
  )

  const addField = (f: ReportFilterDto) => {
    const comparison = f.defaultComparison ?? f.comparisons?.[0] ?? 'EQUAL'
    const row: ReportFilterRow = {
      field: f.field,
      ...(f.kindId != null ? { kindId: f.kindId } : {}),
      comparison,
      values: [],
      enabled: true,
    }
    onRowsChange([...rows, row])
    setMenuAnchor(null)
  }

  const patchRow = (index: number, patch: Partial<ReportFilterRow>) => {
    onRowsChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_r, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => {
            setMenuAnchor(e.currentTarget)
          }}
          disabled={availableFields.length === 0}
        >
          {t('reportSettings.addFilter')}
        </Button>
        <Menu
          anchorEl={menuAnchor}
          open={menuAnchor != null}
          onClose={() => {
            setMenuAnchor(null)
          }}
        >
          {availableFields.map((f) => (
            <MenuItem
              key={f.field}
              onClick={() => {
                addField(f)
              }}
            >
              {fieldTitle(f, isKz)}
            </MenuItem>
          ))}
        </Menu>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ui-04 text-left">
            <th className="w-6 px-1 py-1" />
            <th className="px-1 py-1">
              <Typography variant="caption" className="text-ui-05">
                {t('reportSettings.field')}
              </Typography>
            </th>
            <th className="px-1 py-1">
              <Typography variant="caption" className="text-ui-05">
                {t('reportSettings.comparison')}
              </Typography>
            </th>
            <th className="px-1 py-1">
              <Typography variant="caption" className="text-ui-05">
                {t('reportSettings.value')}
              </Typography>
            </th>
            <th className="w-6 px-1 py-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const meta = fieldByKey.get(row.field)
            const comparisons = meta?.comparisons?.length
              ? meta.comparisons
              : [row.comparison]
            const label = meta ? fieldTitle(meta, isKz) : row.field
            const multi =
              (meta?.multi ?? false) || comparisonIsMulti(row.comparison)
            const needsValue = comparisonNeedsValue(row.comparison)
            return (
              <tr key={`${row.field}-${String(index)}`} className="align-top">
                <td className="px-1 py-1">
                  <Checkbox
                    size="small"
                    checked={row.enabled}
                    onChange={() => {
                      patchRow(index, { enabled: !row.enabled })
                    }}
                  />
                </td>
                <td className="px-1 py-2">
                  <Typography variant="body2" className="text-ui-06">
                    {label}
                  </Typography>
                </td>
                <td className="px-1 py-1">
                  <Select
                    size="small"
                    value={row.comparison}
                    onChange={(e) => {
                      patchRow(index, { comparison: e.target.value })
                    }}
                    fullWidth
                  >
                    {comparisons.map((c) => (
                      <MenuItem key={c} value={c}>
                        {comparisonLabel(c, isKz)}
                      </MenuItem>
                    ))}
                  </Select>
                </td>
                <td className="px-1 py-1">
                  {needsValue && (
                    <FilterValueField
                      valueType={meta?.valueType}
                      referenceDomain={meta?.referenceDomain}
                      multi={multi}
                      values={row.values}
                      onChange={(values) => {
                        patchRow(index, { values })
                      }}
                      label={t('reportSettings.value')}
                    />
                  )}
                </td>
                <td className="px-1 py-1">
                  <IconButton
                    size="small"
                    aria-label={t('reportSettings.removeFilter')}
                    onClick={() => {
                      removeRow(index)
                    }}
                  >
                    ✕
                  </IconButton>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-1 py-3">
                <Typography variant="caption" className="text-ui-05">
                  {t('reportSettings.noFilters')}
                </Typography>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
