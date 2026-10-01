import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { MenuItem, TextField } from '@mui/material'

import { Button } from '@/shared/ui/buttons/button'
import { DateTimeInput } from '@/shared/ui/inputs'

import type { AuditActionOption, AuditUserOption } from '../api/audit-log-api'
import {
  countExtraFilters,
  type AuditLogFilterValues,
} from '../lib/audit-log-filters'
import { AuditEventsSelect } from './audit-events-select'
import { AuditLogExtraFilters } from './audit-log-extra-filters'
import { AuditUserSelect } from './audit-user-select'

interface AuditLogFiltersProps {
  value: AuditLogFilterValues
  onChange: (next: AuditLogFilterValues) => void
  onApply: (values: AuditLogFilterValues) => void
  onReset: () => void
  disabled: boolean
  actions: AuditActionOption[]
  users: AuditUserOption[]
  applicationOptions: Record<string, string>
  extraOpen: boolean
  onToggleExtra: () => void
}

/**
 * Отбор журнала, как в 1С: первый ряд — период, пользователь, события, статус и строка поиска;
 * «Ещё отборы» — метаданные, объект, IP, сеанс, компьютер, рабочий сервер, приложение.
 *
 * <b>Подписи событий и статусов — с сервера</b> (`/api/audit/actions`, `outcomePresentation` в
 * строках); коды статусов (`SUCCESS`/`DENIED`/`FAILED`) — часть контракта, их подписи здесь
 * нужны до загрузки данных, поэтому взяты из i18n.
 */
export const AuditLogFilters = ({
  value,
  onChange,
  onApply,
  onReset,
  disabled,
  actions,
  users,
  applicationOptions,
  extraOpen,
  onToggleExtra,
}: AuditLogFiltersProps) => {
  const { t } = useTranslation()

  const outcomes = [
    ['SUCCESS', 'auditLog.outcomes.SUCCESS'],
    ['DENIED', 'auditLog.outcomes.DENIED'],
    ['FAILED', 'auditLog.outcomes.FAILED'],
  ] as const

  const latestRef = useRef(value)
  useEffect(() => {
    latestRef.current = value
  }, [value])

  const set = (patch: Partial<AuditLogFilterValues>) => {
    const next = { ...latestRef.current, ...patch }
    latestRef.current = next
    onChange(next)
  }
  const extraCount = countExtraFilters(value)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        // Enter в любом поле — «Применить», как в форме отбора 1С.
        event.preventDefault()
        onApply(latestRef.current)
      }}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-end gap-4">
        <DateTimeInput
          label={t('auditLog.from')}
          size="small"
          value={value.from}
          onChange={(next) => {
            set({ from: next })
          }}
          disabled={disabled}
        />

        <DateTimeInput
          label={t('auditLog.to')}
          size="small"
          value={value.to}
          onChange={(next) => {
            set({ to: next })
          }}
          disabled={disabled}
        />

        <AuditUserSelect
          value={value.userLogin}
          options={users}
          onChange={(next) => {
            set({ userLogin: next })
          }}
          disabled={disabled}
        />

        <AuditEventsSelect
          value={value.actions}
          options={actions}
          onChange={(next) => {
            set({ actions: next })
          }}
          disabled={disabled}
        />

        <TextField
          select
          label={t('auditLog.status')}
          size="small"
          value={value.outcome}
          onChange={(event) => {
            set({ outcome: event.target.value })
          }}
          disabled={disabled}
          slotProps={{
            select: { displayEmpty: true },
            inputLabel: { shrink: true },
          }}
        >
          <MenuItem value="">{t('auditLog.anyValue')}</MenuItem>
          {outcomes.map(([code, labelKey]) => (
            <MenuItem key={code} value={code}>
              {t(labelKey)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label={t('auditLog.search')}
          size="small"
          placeholder={t('auditLog.searchPlaceholder')}
          value={value.search}
          onChange={(event) => {
            set({ search: event.target.value })
          }}
          disabled={disabled}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </div>

      {extraOpen && (
        <AuditLogExtraFilters
          value={value}
          onChange={set}
          disabled={disabled}
          applicationOptions={applicationOptions}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" type="submit" disabled={disabled}>
          {t('auditLog.apply')}
        </Button>
        <Button variant="secondary" onClick={onReset} disabled={disabled}>
          {t('auditLog.reset')}
        </Button>
        <Button variant="tertiary" onClick={onToggleExtra}>
          {extraOpen
            ? t('auditLog.hideFilters')
            : extraCount > 0
              ? `${t('auditLog.moreFilters')} (${String(extraCount)})`
              : t('auditLog.moreFilters')}
        </Button>
      </div>
    </form>
  )
}
