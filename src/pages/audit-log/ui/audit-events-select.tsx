import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Checkbox,
  ListItemText,
  ListSubheader,
  MenuItem,
  TextField,
} from '@mui/material'

import type { AuditActionOption } from '../api/audit-log-api'

interface AuditEventsSelectProps {
  value: string[]
  options: AuditActionOption[]
  onChange: (next: string[]) => void
  disabled: boolean
}

interface OptionGroup {
  key: string
  title: string | null
  items: AuditActionOption[]
}

/** Группы в порядке первого появления: порядок задаёт сервер. */
const groupOptions = (options: AuditActionOption[]): OptionGroup[] => {
  const groups: OptionGroup[] = []
  for (const option of options) {
    const key = option.group ?? ''
    let group = groups.find((candidate) => candidate.key === key)
    if (!group) {
      group = { key, title: option.groupPresentation ?? null, items: [] }
      groups.push(group)
    }
    group.items.push(option)
  }
  return groups
}

/**
 * Отбор по событиям — мультивыбор, сгруппированный как в 1С («Сеанс», «Данные», «Запуск»,
 * «Администрирование», «Безопасность»). Ничего не выбрано — «Любое».
 */
export const AuditEventsSelect = ({
  value,
  options,
  onChange,
  disabled,
}: AuditEventsSelectProps) => {
  const { t } = useTranslation()
  const labels = new Map(
    options.map((option) => [option.code, option.presentation])
  )

  const renderValue = (selected: unknown): ReactNode => {
    const codes = selected as string[]
    if (codes.length === 0) return t('auditLog.anyValue')
    if (codes.length === 1) return labels.get(codes[0]) ?? codes[0]
    return t('auditLog.eventsSelected', { count: codes.length })
  }

  const items = groupOptions(options).flatMap((group) => [
    ...(group.title
      ? [
          <ListSubheader key={`group-${group.key}`}>
            {group.title}
          </ListSubheader>,
        ]
      : []),
    ...group.items.map((option) => (
      <MenuItem key={option.code} value={option.code}>
        <Checkbox size="small" checked={value.includes(option.code)} />
        <ListItemText primary={option.presentation} />
      </MenuItem>
    )),
  ])

  return (
    <TextField
      select
      label={t('auditLog.events')}
      size="small"
      value={value}
      onChange={(event) => {
        // При multiple MUI отдаёт массив, а типы TextField знают только строку.
        const raw = event.target.value as unknown
        onChange(
          Array.isArray(raw)
            ? (raw as string[])
            : String(raw).split(',').filter(Boolean)
        )
      }}
      disabled={disabled}
      slotProps={{
        select: {
          multiple: true,
          displayEmpty: true,
          renderValue,
          MenuProps: { slotProps: { paper: { sx: { maxHeight: 480 } } } },
        },
        inputLabel: { shrink: true },
      }}
    >
      {items}
    </TextField>
  )
}
