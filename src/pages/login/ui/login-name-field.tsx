import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import {
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material'

import { getKnownLogins } from '@/shared/api/auth/token-storage'

import { loginFieldSx } from './login-field-sx'

interface LoginNameFieldProps {
  value: string
  onChange: (value: string) => void
  hasError: boolean
  disabled: boolean
  autoFocus: boolean
}

/**
 * Поле «Пользователь» — обычный ввод со стрелкой выбора.
 *
 * <b>Стрелка открывает логины, набранные на ЭТОМ устройстве, а не список пользователей
 * системы.</b> В макете у поля есть выпадашка, но серверного перечня учётных записей нет и
 * быть не должно: он раскрыл бы состав пользователей любому, кто открыл страницу входа
 * (ТЗ §А1 — там же отклонён и список пользователей в диалоге запуска 1С). Браузер
 * показывает только то, что и так знает про себя.
 *
 * Поле остаётся вводом, а не выбором из списка: логина может не быть в памяти этого
 * браузера — например, человек сел за чужую машину.
 */
export const LoginNameField = ({
  value,
  onChange,
  hasError,
  disabled,
  autoFocus,
}: LoginNameFieldProps) => {
  const { t } = useTranslation()
  // Якорь меню держим в СОСТОЯНИИ, а не в ref: значение читается во время рендера
  // (позиция и ширина выпадашки), а ref во время рендера трогать нельзя — при его
  // появлении компонент не перерисуется, и меню привяжется в никуда.
  const [anchorElement, setAnchorElement] = useState<HTMLDivElement | null>(
    null
  )
  const [isMenuOpen, setMenuOpen] = useState(false)
  // Читаем при открытии, а не на каждый рендер: список меняется только после входа.
  const [knownLogins, setKnownLogins] = useState<string[]>([])

  const openMenu = () => {
    setKnownLogins(getKnownLogins())
    setMenuOpen(true)
  }

  const pickLogin = (login: string) => {
    onChange(login)
    setMenuOpen(false)
  }

  return (
    <div ref={setAnchorElement}>
      <TextField
        label={t('auth.loginLabel')}
        // Пример подсказывает формат, не занимая места под полем: в 1С логин — это
        // «Фамилия Имя», и без примера его набирают одним словом или латиницей.
        placeholder={t('auth.loginPlaceholder')}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        autoComplete="username"
        autoFocus={autoFocus}
        error={hasError}
        disabled={disabled}
        sx={loginFieldSx}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={t('auth.knownLoginsToggle')}
                  onClick={openMenu}
                  disabled={disabled}
                  edge="end"
                >
                  <KeyboardArrowDownIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Menu
        anchorEl={anchorElement}
        open={isMenuOpen}
        onClose={() => {
          setMenuOpen(false)
        }}
        slotProps={{
          list: { dense: true },
          // Ширина по полю: выпадашка уже поля выглядит как чужой элемент.
          paper: { sx: { width: anchorElement?.clientWidth } },
        }}
      >
        {knownLogins.length === 0 ? (
          <MenuItem disabled>{t('auth.knownLoginsEmpty')}</MenuItem>
        ) : (
          knownLogins.map((login) => (
            <MenuItem
              key={login}
              selected={login === value}
              onClick={() => {
                pickLogin(login)
              }}
            >
              {login}
            </MenuItem>
          ))
        )}
      </Menu>
    </div>
  )
}
