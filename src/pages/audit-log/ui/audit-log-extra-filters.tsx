import { useTranslation } from 'react-i18next'

import { MenuItem, TextField } from '@mui/material'

import type { AuditLogFilterValues } from '../lib/audit-log-filters'

interface AuditLogExtraFiltersProps {
  value: AuditLogFilterValues
  onChange: (patch: Partial<AuditLogFilterValues>) => void
  disabled: boolean
  /** Код приложения → подпись; см. `useSeenApplications`. */
  applicationOptions: Record<string, string>
}

// Виды метаданных, у объектов которых есть история в журнале. Литеральные ключи — чтобы
// компилятор ловил забытый перевод.
const DOMAIN_KINDS = [
  ['DOCUMENT', 'auditLog.domainKinds.DOCUMENT'],
  ['DICTIONARY', 'auditLog.domainKinds.DICTIONARY'],
  ['ACCOUNT_PLAN', 'auditLog.domainKinds.ACCOUNT_PLAN'],
  ['CHARACTERISTICS_PLAN', 'auditLog.domainKinds.CHARACTERISTICS_PLAN'],
  ['CALCULATION_PLAN', 'auditLog.domainKinds.CALCULATION_PLAN'],
  ['EXCHANGE_PLAN', 'auditLog.domainKinds.EXCHANGE_PLAN'],
  ['INFORMATION_REGISTER', 'auditLog.domainKinds.INFORMATION_REGISTER'],
  ['ACCUMULATION_REGISTER', 'auditLog.domainKinds.ACCUMULATION_REGISTER'],
  ['ACCOUNTING_REGISTER', 'auditLog.domainKinds.ACCOUNTING_REGISTER'],
] as const

const TEXT_FIELDS = [
  ['typeCode', 'auditLog.typeCode'],
  ['entryId', 'auditLog.entryId'],
  ['ip', 'auditLog.ipFilter'],
  ['sessionId', 'auditLog.sessionId'],
  ['deviceId', 'auditLog.deviceId'],
  ['serverNode', 'auditLog.serverNode'],
] as const

/** Второй ряд отбора: «откуда» и «над чем» — метаданные, объект, IP, сеанс, компьютер, сервер. */
export const AuditLogExtraFilters = ({
  value,
  onChange,
  disabled,
  applicationOptions,
}: AuditLogExtraFiltersProps) => {
  const { t } = useTranslation()
  // Выбранное приложение остаётся в списке, даже если в загруженных строках его ещё не было
  // (пришло из адресной строки).
  const applications = { ...applicationOptions }
  if (value.application && !(value.application in applications)) {
    applications[value.application] = value.application
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-end gap-4">
      <TextField
        select
        label={t('auditLog.domainKind')}
        size="small"
        value={value.domainKind}
        onChange={(event) => {
          onChange({ domainKind: event.target.value })
        }}
        disabled={disabled}
        slotProps={{
          select: { displayEmpty: true },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value="">{t('auditLog.anyValue')}</MenuItem>
        {DOMAIN_KINDS.map(([code, labelKey]) => (
          <MenuItem key={code} value={code}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </TextField>

      {TEXT_FIELDS.map(([key, labelKey]) => (
        <TextField
          key={key}
          label={t(labelKey)}
          size="small"
          value={value[key]}
          onChange={(event) => {
            onChange({ [key]: event.target.value })
          }}
          disabled={disabled}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      ))}

      <TextField
        select
        label={t('auditLog.application')}
        size="small"
        value={value.application}
        onChange={(event) => {
          onChange({ application: event.target.value })
        }}
        disabled={disabled}
        slotProps={{
          select: { displayEmpty: true },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value="">{t('auditLog.anyValue')}</MenuItem>
        {Object.entries(applications).map(([code, label]) => (
          <MenuItem key={code} value={code}>
            {label}
          </MenuItem>
        ))}
      </TextField>
    </div>
  )
}
