import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import LogoutIcon from '@mui/icons-material/Logout'
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'

import { LOGIN_ROUTE, useAuthStore } from '@/features/auth'
import UserIcon from '@/shared/assets/icons/user.svg'
import { Button } from '@/shared/ui/buttons'

/**
 * Текущий пользователь в шапке и меню с выходом.
 *
 * <p>Пока пользователь не определён — а это штатное состояние, пока проверка доступа
 * выключена (`VITE_AUTH_ENABLED`), — блок выглядит ровно как раньше: значок и подпись,
 * ничего не нажимается. Предлагать «Выход» тому, кто не входил, бессмысленно, а
 * неработающая кнопка хуже её отсутствия.
 */
export const TopBarUser = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)
  // Якорь меню — в состоянии, а не в ref: значение читается во время рендера.
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null)

  if (!user) {
    return (
      <div className="mx-1 flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-ui-03" />
        <Typography variant="body2" className="text-ui-06">
          {t('topBar.userName')}
        </Typography>
      </div>
    )
  }

  // ФИО, а если его нет — логин: пустая шапка хуже технического написания имени.
  const displayName = user.displayName ?? user.login

  const handleLogout = async () => {
    setAnchorElement(null)
    await signOut()
    // Уводим явно, а не полагаемся на гвард: при выключенном `VITE_AUTH_ENABLED` гварда
    // нет вовсе, и человек остался бы стоять на странице, из которой только что вышел.
    void navigate(LOGIN_ROUTE, { replace: true })
  }

  return (
    <>
      <Button
        variant="tertiary"
        className="mx-1 gap-2"
        aria-label={t('topBar.userMenu')}
        aria-haspopup="menu"
        aria-expanded={!!anchorElement}
        onClick={(event) => {
          setAnchorElement(event.currentTarget)
        }}
        startIcon={<UserIcon className="h-5 w-5 text-ui-03" />}
      >
        <Typography variant="body2" className="text-ui-06">
          {displayName}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorElement}
        open={!!anchorElement}
        onClose={() => {
          setAnchorElement(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { dense: true } }}
      >
        <MenuItem
          onClick={() => {
            void handleLogout()
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('topBar.logout')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}
