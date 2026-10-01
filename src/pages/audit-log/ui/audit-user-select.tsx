import { useTranslation } from 'react-i18next'

import { Autocomplete, ListItemText, TextField } from '@mui/material'

import type { AuditUserOption } from '../api/audit-log-api'

interface AuditUserSelectProps {
  value: string
  options: AuditUserOption[]
  onChange: (login: string) => void
  disabled: boolean
}

export const AuditUserSelect = ({
  value,
  options,
  onChange,
  disabled,
}: AuditUserSelectProps) => {
  const { t } = useTranslation()

  return (
    <Autocomplete<AuditUserOption | string, false, false, true>
      freeSolo
      size="small"
      options={options}
      value={null}
      inputValue={value}
      disabled={disabled}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.login
      }
      filterOptions={(all, state) => {
        const query = state.inputValue.trim().toLowerCase()
        if (!query) return all
        return all.filter(
          (option) =>
            typeof option !== 'string' &&
            (option.login.toLowerCase().includes(query) ||
              option.name.toLowerCase().includes(query))
        )
      }}
      onInputChange={(_event, next) => {
        onChange(next)
      }}
      onChange={(_event, next) => {
        onChange(typeof next === 'string' ? next : (next?.login ?? ''))
      }}
      renderOption={({ key, ...props }, option) => {
        const login = typeof option === 'string' ? option : option.login
        const name = typeof option === 'string' ? '' : option.name
        return (
          <li key={key} {...props}>
            <ListItemText
              primary={login}
              secondary={name && name !== login ? name : undefined}
            />
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t('auditLog.userLogin')}
          placeholder={t('auditLog.userPlaceholder')}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      )}
    />
  )
}
