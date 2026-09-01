import { useTranslation } from 'react-i18next'
import { Menu, MenuItem } from '@mui/material'

/** Позиция контекстного меню (координаты курсора). */
export interface RegisterMenuPosition {
  top: number
  left: number
}

interface InformationRegisterRowContextMenuProps {
  /** Координаты открытия; `null` — меню закрыто. */
  position: RegisterMenuPosition | null
  onClose: () => void
  onCreate: () => void
  /** ПКМ по пустой области: строки нет ⇒ «Изменить» скрыт. */
  hasEntry: boolean
  onEdit: () => void
}

/**
 * 1С-стиль контекстное меню строки списка регистра сведений (SCRUM-353 §10):
 * «Создать» / «Изменить». Презентационный компонент — навигацию выполняет
 * страница; образец — OsvRowContextMenu.
 */
export const InformationRegisterRowContextMenu = ({
  position,
  onClose,
  onCreate,
  hasEntry,
  onEdit,
}: InformationRegisterRowContextMenuProps) => {
  const { t } = useTranslation()

  return (
    <Menu
      open={position != null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        position ? { top: position.top, left: position.left } : undefined
      }
    >
      <MenuItem
        onClick={() => {
          onCreate()
          onClose()
        }}
      >
        {t('actions.create')}
      </MenuItem>
      {hasEntry && (
        <MenuItem
          onClick={() => {
            onEdit()
            onClose()
          }}
        >
          {t('actions.change')}
        </MenuItem>
      )}
    </Menu>
  )
}
