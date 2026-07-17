import { useTranslation } from 'react-i18next'
import { Checkbox, IconButton, Typography } from '@mui/material'

import type {
  ReportAltAvailableFieldDto,
  ReportAltSelectedFieldDto,
} from '../../types/reportalt'

interface SettingsFieldsTabProps {
  /** Доступные колонки (availableAsColumn) — источник подписей. */
  availableFields: ReportAltAvailableFieldDto[]
  /** Текущий список строк (поля + маркер «Авто»), в порядке вывода. */
  rows: ReportAltSelectedFieldDto[]
  onChange: (rows: ReportAltSelectedFieldDto[]) => void
  isKz: boolean
}

/**
 * Вкладка «Поля»: чекбокс-список выбранных колонок с переупорядочиванием
 * стрелками вверх/вниз; специальная строка «Авто (остальные поля)» — маркер
 * 1С SelectedItemAuto, тоже перемещаемый (settings-design §7).
 */
export const SettingsFieldsTab = ({
  availableFields,
  rows,
  onChange,
  isKz,
}: SettingsFieldsTabProps) => {
  const { t } = useTranslation()

  const titleOf = (code: string | undefined): string => {
    const f = availableFields.find((af) => af.code === code)
    if (!f) return code ?? ''
    return (isKz ? f.titleKz : f.titleRu) || f.titleRu
  }

  const toggle = (index: number) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, use: !r.use } : r)))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onChange(next)
  }

  if (rows.length === 0) {
    return (
      <Typography variant="caption" className="text-ui-05">
        {t('reportalt.settings.noFields')}
      </Typography>
    )
  }

  return (
    <div className="flex flex-col">
      {rows.map((row, index) => (
        <div
          key={row.kind === 'AUTO' ? 'auto' : (row.field ?? String(index))}
          className="flex items-center gap-1"
        >
          <Checkbox
            size="small"
            checked={row.use}
            onChange={() => {
              toggle(index)
            }}
          />
          <Typography
            variant="body2"
            className={
              row.kind === 'AUTO' ? 'grow italic text-ui-05' : 'grow text-ui-06'
            }
          >
            {row.kind === 'AUTO'
              ? t('reportalt.settings.autoFields')
              : titleOf(row.field)}
          </Typography>
          <IconButton
            size="small"
            disabled={index === 0}
            aria-label={t('reportalt.settings.moveUp')}
            onClick={() => {
              move(index, -1)
            }}
          >
            ↑
          </IconButton>
          <IconButton
            size="small"
            disabled={index === rows.length - 1}
            aria-label={t('reportalt.settings.moveDown')}
            onClick={() => {
              move(index, 1)
            }}
          >
            ↓
          </IconButton>
        </div>
      ))}
    </div>
  )
}
