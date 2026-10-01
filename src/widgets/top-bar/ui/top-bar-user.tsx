import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import ComputerIcon from '@mui/icons-material/Computer'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import FaceIcon from '@mui/icons-material/Face'
import LogoutIcon from '@mui/icons-material/Logout'
import PaletteIcon from '@mui/icons-material/Palette'
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'

import { LOGIN_ROUTE, useAuthStore } from '@/features/auth'
import { DeviceNameDialog } from '@/features/client-device-name'
import { FacePhotoDialog } from '@/features/face-auth'
import { viewSettingsAdminApi } from '@/features/sdui'
import { ThemeSettingsDialog } from '@/features/theme-settings'
import UserIcon from '@/shared/assets/icons/user.svg'
import { Button } from '@/shared/ui/buttons'
import { figmaIcons } from '@/shared/ui/icons'

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
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [themeDialogOpen, setThemeDialogOpen] = useState(false)
  const [deviceNameDialogOpen, setDeviceNameDialogOpen] = useState(false)

  // Вход в админку конструктора — только админам; признак считает бэк.
  // Ключ включает пользователя: staleTime Infinity без него показывал пункт
  // меню следующему вошедшему из кэша предыдущего (админ вышел → бух видел).
  const { data: adminInfo } = useQuery({
    queryKey: ['view-settings-admin-me', user?.id ?? null],
    queryFn: ({ signal }) => viewSettingsAdminApi.me(signal),
    enabled: user != null,
    staleTime: Infinity,
  })

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
            setAnchorElement(null)
            setPhotoDialogOpen(true)
          }}
        >
          <ListItemIcon>
            <FaceIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('auth.face.photo.title')}</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorElement(null)
            void navigate('/profile/face-id')
          }}
        >
          <ListItemIcon>{figmaIcons['eye-opened']}</ListItemIcon>
          <ListItemText>
            <Typography variant="body2">
              {t('faceId.selfPhotoTitle')}
            </Typography>
          </ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorElement(null)
            setThemeDialogOpen(true)
          }}
        >
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('themeSettings.menuItem')}</ListItemText>
        </MenuItem>

        {/* Подпись рабочего места для журнала регистрации (SCRUM-371). */}
        <MenuItem
          onClick={() => {
            setAnchorElement(null)
            setDeviceNameDialogOpen(true)
          }}
        >
          <ListItemIcon>
            <ComputerIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('deviceName.menuItem')}</ListItemText>
        </MenuItem>

        {adminInfo?.admin === true && (
          <MenuItem
            onClick={() => {
              setAnchorElement(null)
              void navigate('/admin/design-constructor')
            }}
          >
            <ListItemIcon>
              <DashboardCustomizeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('sdui.designAdmin.menuItem')}</ListItemText>
          </MenuItem>
        )}

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

      <FacePhotoDialog
        open={photoDialogOpen}
        userId={user.id}
        onClose={() => {
          setPhotoDialogOpen(false)
        }}
      />

      <ThemeSettingsDialog
        open={themeDialogOpen}
        onClose={() => {
          setThemeDialogOpen(false)
        }}
      />

      <DeviceNameDialog
        open={deviceNameDialogOpen}
        onClose={() => {
          setDeviceNameDialogOpen(false)
        }}
      />
    </>
  )
}
