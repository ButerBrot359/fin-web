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

import type { ReportAltFilterFieldDto } from '../../types/reportalt'
import {
  comparisonNeedsValue,
  comparisonsForField,
  defaultComparisonForField,
  type SettingsFilterRow,
} from '../../lib/utils/user-settings'
import { SettingsFilterValue } from './settings-filter-value'

interface SettingsFiltersTabProps {
  /** Доступные поля отбора (settable-узел `meta.filters`). */
  fields: ReportAltFilterFieldDto[]
  rows: SettingsFilterRow[]
  onChange: (rows: SettingsFilterRow[]) => void
  isKz: boolean
}

/** Локализованный заголовок поля отбора. */
const fieldTitle = (f: ReportAltFilterFieldDto, isKz: boolean): string =>
  (isKz ? f.titleKz : f.titleRu) || f.titleRu

/**
 * Вкладка «Отборы» (settings-design §7): таблица строк
 * [использовать] | Поле | Вид сравнения | Значение, кнопка «Добавить» — меню
 * ещё не добавленных полей. Сравнения — из meta по типу поля; редактор
 * значения — по valueType (паттерн `ReportAltParamField`).
 */
export const SettingsFiltersTab = ({
  fields,
  rows,
  onChange,
  isKz,
}: SettingsFiltersTabProps) => {
  const { t } = useTranslation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const fieldByCode = useMemo(() => {
    const map = new Map<string, ReportAltFilterFieldDto>()
    for (const f of fields) map.set(f.field, f)
    return map
  }, [fields])

  const usedCodes = useMemo(() => new Set(rows.map((r) => r.field)), [rows])
  const addable = useMemo(
    () => fields.filter((f) => !usedCodes.has(f.field)),
    [fields, usedCodes]
  )

  const addField = (f: ReportAltFilterFieldDto) => {
    onChange([
      ...rows,
      {
        field: f.field,
        comparison: defaultComparisonForField(f),
        values: [],
        use: true,
      },
    ])
    setMenuAnchor(null)
  }

  const patchRow = (index: number, patch: Partial<SettingsFilterRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_r, i) => i !== index))
  }

  const comparisonLabel = (code: string): string =>
    t(`reportalt.settings.comparisons.${code}`, { defaultValue: code })

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="outlined"
          size="small"
          disabled={addable.length === 0}
          onClick={(e) => {
            setMenuAnchor(e.currentTarget)
          }}
        >
          {t('reportalt.settings.addFilter')}
        </Button>
        <Menu
          anchorEl={menuAnchor}
          open={menuAnchor != null}
          onClose={() => {
            setMenuAnchor(null)
          }}
        >
          {addable.map((f) => (
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

      {rows.length === 0 ? (
        <Typography variant="caption" className="text-ui-05">
          {t('reportalt.settings.noFilters')}
        </Typography>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const meta = fieldByCode.get(row.field)
            const comparisons = meta
              ? comparisonsForField(meta)
              : [row.comparison]
            const label = meta ? fieldTitle(meta, isKz) : row.field
            return (
              <div
                key={`${row.field}-${String(index)}`}
                className="flex items-start gap-1"
              >
                <Checkbox
                  size="small"
                  checked={row.use}
                  aria-label={t('reportalt.settings.use')}
                  onChange={() => {
                    patchRow(index, { use: !row.use })
                  }}
                />
                <div className="flex min-w-0 grow flex-col gap-1">
                  <Typography variant="body2" className="text-ui-06">
                    {label}
                  </Typography>
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
                        {comparisonLabel(c)}
                      </MenuItem>
                    ))}
                  </Select>
                  {meta && comparisonNeedsValue(row.comparison) && (
                    <SettingsFilterValue
                      field={meta}
                      comparison={row.comparison}
                      values={row.values}
                      onChange={(values) => {
                        patchRow(index, { values })
                      }}
                      label={t('reportalt.settings.value')}
                    />
                  )}
                </div>
                <IconButton
                  size="small"
                  aria-label={t('reportalt.settings.remove')}
                  onClick={() => {
                    removeRow(index)
                  }}
                >
                  ✕
                </IconButton>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
