import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'

import type {
  ReportAltAvailableFieldDto,
  ReportAltUserOrderDto,
} from '../../types/reportalt'

interface SettingsOrderTabProps {
  /** Поля, доступные в сортировке (availableAsOrder). */
  orderFields: ReportAltAvailableFieldDto[]
  /** Упорядоченные строки сортировки (FIELD asc/desc + маркер «Авто»). */
  rows: ReportAltUserOrderDto[]
  onChange: (rows: ReportAltUserOrderDto[]) => void
  isKz: boolean
}

/**
 * Вкладка «Сортировка» (settings-design §7): упорядоченный список
 * {поле, Asc/Desc} со стрелками вверх/вниз + добавляемый маркер «Авто»
 * (порядок полей группировки). Пустой список — сортировка варианта.
 */
export const SettingsOrderTab = ({
  orderFields,
  rows,
  onChange,
  isKz,
}: SettingsOrderTabProps) => {
  const { t } = useTranslation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const titleOf = (code: string | undefined): string => {
    const f = orderFields.find((of) => of.code === code)
    if (!f) return code ?? ''
    return (isKz ? f.titleKz : f.titleRu) || f.titleRu
  }

  const usedCodes = useMemo(
    () => new Set(rows.filter((r) => r.kind === 'FIELD').map((r) => r.field)),
    [rows]
  )
  const addable = useMemo(
    () => orderFields.filter((f) => !usedCodes.has(f.code)),
    [orderFields, usedCodes]
  )
  const hasAuto = rows.some((r) => r.kind === 'AUTO')

  const addField = (code: string) => {
    onChange([...rows, { kind: 'FIELD', field: code, ascending: true }])
    setMenuAnchor(null)
  }

  const addAuto = () => {
    onChange([...rows, { kind: 'AUTO', ascending: true }])
  }

  const patchRow = (index: number, patch: Partial<ReportAltUserOrderDto>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_r, i) => i !== index))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant="outlined"
          size="small"
          disabled={addable.length === 0}
          onClick={(e) => {
            setMenuAnchor(e.currentTarget)
          }}
        >
          {t('reportalt.settings.addOrder')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          disabled={hasAuto}
          onClick={addAuto}
        >
          {t('reportalt.settings.addAuto')}
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
              key={f.code}
              onClick={() => {
                addField(f.code)
              }}
            >
              {(isKz ? f.titleKz : f.titleRu) || f.titleRu}
            </MenuItem>
          ))}
        </Menu>
      </div>

      {rows.length === 0 ? (
        <Typography variant="caption" className="text-ui-05">
          {t('reportalt.settings.noOrder')}
        </Typography>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((row, index) => (
            <div
              key={row.kind === 'AUTO' ? 'auto' : (row.field ?? String(index))}
              className="flex items-center gap-1"
            >
              <Typography
                variant="body2"
                className={
                  row.kind === 'AUTO'
                    ? 'grow italic text-ui-05'
                    : 'grow text-ui-06'
                }
              >
                {row.kind === 'AUTO'
                  ? t('reportalt.settings.autoOrder')
                  : titleOf(row.field)}
              </Typography>
              {row.kind === 'FIELD' && (
                <Select
                  size="small"
                  value={row.ascending ? 'asc' : 'desc'}
                  onChange={(e) => {
                    patchRow(index, { ascending: e.target.value === 'asc' })
                  }}
                >
                  <MenuItem value="asc">
                    {t('reportalt.settings.ascending')}
                  </MenuItem>
                  <MenuItem value="desc">
                    {t('reportalt.settings.descending')}
                  </MenuItem>
                </Select>
              )}
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
          ))}
        </div>
      )}
    </div>
  )
}
