import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import {
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material'

import { requestSelectionList } from '@/shared/api/auth/auth-endpoints'
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
 * Поле «Пользователь» — ввод со стрелкой выбора, как в диалоге запуска 1С.
 *
 * <b>Список приходит с сервера</b> (`GET /api/auth/selection-list`) и повторяет список выбора
 * 1С: в нём те, у кого в карточке пользователя стоит флаг «Показывать в списке выбора», и кому
 * при этом не запрещён вход — снятая аутентификация, пометка удаления и «Недействителен»
 * убирают человека из списка так же, как в 1С их снимает «ВходВПрограммуРазрешен».
 *
 * <b>Пустой список — не ошибка.</b> В 1С без флага ни у кого поле остаётся обычным вводом; здесь
 * так же, только вместо пустого меню показываются логины, набранные на ЭТОМ устройстве, — они и
 * так известны браузеру, и терять эту подсказку при недоступном сервере незачем.
 *
 * Поле остаётся вводом, а не выбором из списка: логина может не быть в списке — человек с
 * снятым флагом входит, просто набрав своё имя, ровно как в 1С.
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
  const [logins, setLogins] = useState<string[]>([])

  // Список запрашивается один раз при открытии экрана, а не на каждый клик по стрелке:
  // состав списка меняет администратор в карточке пользователя, а не то, что происходит
  // на этой странице. Отказ сервера гасится молча — вход по набранному логину от списка
  // не зависит, и сообщать об этом человеку нечего.
  useEffect(() => {
    let isCurrent = true

    void requestSelectionList()
      .then((selectionList) => {
        if (isCurrent) {
          setLogins(selectionList.length > 0 ? selectionList : getKnownLogins())
        }
      })
      .catch(() => {
        if (isCurrent) {
          setLogins(getKnownLogins())
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

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
                  aria-label={t('auth.selectionListToggle')}
                  onClick={() => {
                    setMenuOpen(true)
                  }}
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
        {logins.length === 0 ? (
          <MenuItem disabled>{t('auth.selectionListEmpty')}</MenuItem>
        ) : (
          logins.map((login) => (
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
