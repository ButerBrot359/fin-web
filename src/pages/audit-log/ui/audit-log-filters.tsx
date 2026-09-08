import { useTranslation } from 'react-i18next'

import { MenuItem, TextField } from '@mui/material'

import { Button } from '@/shared/ui/buttons/button'

export interface AuditLogFilterValues {
  from: string
  to: string
  userLogin: string
  action: string
  outcome: string
}

interface AuditLogFiltersProps {
  value: AuditLogFilterValues
  onChange: (next: AuditLogFilterValues) => void
  onApply: () => void
  onReset: () => void
  disabled: boolean
}

/**
 * Отборы журнала: период, пользователь, действие, исход.
 *
 * <b>Список действий и исходов захардкожен, а подписи берутся с сервера.</b> Коды перечислений
 * (`LOGIN`, `POST`, …) — часть контракта и меняются вместе с ним, а вот переводить их на клиенте
 * нельзя: сервер отдаёт готовые `actionPresentation`/`outcomePresentation`, и второй перевод
 * рядом однажды разойдётся с первым. Здесь подписи нужны ДО загрузки данных, поэтому взяты из
 * i18n — единственное место, где дублирование неизбежно; список сверен с handoff §3.
 */
export const AuditLogFilters = ({
  value,
  onChange,
  onApply,
  onReset,
  disabled,
}: AuditLogFiltersProps) => {
  const { t } = useTranslation()

  // Пары «код перечисления → ключ перевода» ЛИТЕРАЛАМИ, а не шаблонной строкой: ключи i18n в
  // проекте типизированы, и `auditLog.actions.${code}` компилятор проверить не может — забытый
  // перевод всплыл бы только на экране.
  const actions = [
    ['CREATE', 'auditLog.actions.CREATE'],
    ['UPDATE', 'auditLog.actions.UPDATE'],
    ['POST', 'auditLog.actions.POST'],
    ['UNPOST', 'auditLog.actions.UNPOST'],
    ['DELETION_MARK', 'auditLog.actions.DELETION_MARK'],
    ['DELETE', 'auditLog.actions.DELETE'],
    ['LOGIN', 'auditLog.actions.LOGIN'],
    ['LOGOUT', 'auditLog.actions.LOGOUT'],
    ['SESSION_REFRESH', 'auditLog.actions.SESSION_REFRESH'],
    ['PASSWORD_CHANGED', 'auditLog.actions.PASSWORD_CHANGED'],
    ['LOGIN_SETTINGS_CHANGED', 'auditLog.actions.LOGIN_SETTINGS_CHANGED'],
  ] as const
  const outcomes = [
    ['SUCCESS', 'auditLog.outcomes.SUCCESS'],
    ['DENIED', 'auditLog.outcomes.DENIED'],
    ['FAILED', 'auditLog.outcomes.FAILED'],
  ] as const

  const set = (patch: Partial<AuditLogFilterValues>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <TextField
        label={t('auditLog.from')}
        type="datetime-local"
        size="small"
        value={value.from}
        onChange={(event) => {
          set({ from: event.target.value })
        }}
        disabled={disabled}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <TextField
        label={t('auditLog.to')}
        type="datetime-local"
        size="small"
        value={value.to}
        onChange={(event) => {
          set({ to: event.target.value })
        }}
        disabled={disabled}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <TextField
        label={t('auditLog.userLogin')}
        size="small"
        // Сервер сравнивает логин ТОЧНО, поэтому подсказываем формат: «Фамилия Имя», как в 1С.
        placeholder={t('auth.loginPlaceholder')}
        value={value.userLogin}
        onChange={(event) => {
          set({ userLogin: event.target.value })
        }}
        disabled={disabled}
      />

      <TextField
        select
        label={t('auditLog.action')}
        size="small"
        className="min-w-52"
        value={value.action}
        onChange={(event) => {
          set({ action: event.target.value })
        }}
        disabled={disabled}
      >
        <MenuItem value="">{t('auditLog.anyValue')}</MenuItem>
        {actions.map(([code, labelKey]) => (
          <MenuItem key={code} value={code}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label={t('auditLog.outcome')}
        size="small"
        className="min-w-40"
        value={value.outcome}
        onChange={(event) => {
          set({ outcome: event.target.value })
        }}
        disabled={disabled}
      >
        <MenuItem value="">{t('auditLog.anyValue')}</MenuItem>
        {outcomes.map(([code, labelKey]) => (
          <MenuItem key={code} value={code}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </TextField>

      <Button variant="primary" onClick={onApply} disabled={disabled}>
        {t('auditLog.apply')}
      </Button>

      <Button variant="secondary" onClick={onReset} disabled={disabled}>
        {t('auditLog.reset')}
      </Button>
    </div>
  )
}
