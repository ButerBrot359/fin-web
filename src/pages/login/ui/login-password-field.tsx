import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { IconButton, InputAdornment, TextField } from '@mui/material'

import { loginFieldSx } from './login-field-sx'

interface LoginPasswordFieldProps {
  value: string
  onChange: (value: string) => void
  /** Текст отказа под полем; `null` — ошибки нет. */
  error: string | null
  disabled: boolean
  autoFocus: boolean
}

/**
 * Поле «Пароль» с показом введённого.
 *
 * Показ по умолчанию выключен и сбрасывается только пользователем — это единственное
 * место, где пароль виден, и открывать его самостоятельно (например, после отказа) нельзя:
 * рядом может стоять кто угодно.
 */
export const LoginPasswordField = ({
  value,
  onChange,
  error,
  disabled,
  autoFocus,
}: LoginPasswordFieldProps) => {
  const { t } = useTranslation()
  const [isVisible, setVisible] = useState(false)

  return (
    <TextField
      label={t('auth.passwordLabel')}
      type={isVisible ? 'text' : 'password'}
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      autoComplete="current-password"
      autoFocus={autoFocus}
      error={!!error}
      helperText={error ?? ' '}
      disabled={disabled}
      sx={loginFieldSx}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={
                  isVisible ? t('auth.hidePassword') : t('auth.showPassword')
                }
                onClick={() => {
                  setVisible((previous) => !previous)
                }}
                // Кнопка показа не должна попадать в обход по Tab между полем и «Войти»:
                // клавиатурный путь ко входу — логин, пароль, кнопка.
                tabIndex={-1}
                edge="end"
              >
                {isVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
