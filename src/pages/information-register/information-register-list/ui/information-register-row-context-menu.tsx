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
  /** ПКМ по пустой области: строки нет ⇒ команды над записью скрыты. */
  hasEntry: boolean
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
  onRefresh: () => void
}

/**
 * 1С-стиль контекстное меню строки списка регистра сведений (SCRUM-353 §10):
 * тот же набор команд, что на тулбаре и в «Ещё» — в 1С все три точки входа
 * показывают одно меню. Презентационный компонент: навигацию и удаление
 * выполняет страница; образец — OsvRowContextMenu.
 */
export const InformationRegisterRowContextMenu = ({
  position,
  onClose,
  onCreate,
  hasEntry,
  onEdit,
  onCopy,
  onDelete,
  onRefresh,
}: InformationRegisterRowContextMenuProps) => {
  const { t } = useTranslation()

  const run = (command: () => void) => () => {
    command()
    onClose()
  }

  return (
    <Menu
      open={position != null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        position ? { top: position.top, left: position.left } : undefined
      }
    >
      <MenuItem onClick={run(onCreate)}>{t('actions.create')}</MenuItem>
      {hasEntry && (
        <MenuItem onClick={run(onCopy)}>{t('actions.copy')}</MenuItem>
      )}
      {hasEntry && (
        <MenuItem onClick={run(onEdit)}>{t('actions.change')}</MenuItem>
      )}
      {hasEntry && (
        <MenuItem onClick={run(onDelete)}>{t('actions.delete')}</MenuItem>
      )}
      <MenuItem onClick={run(onRefresh)}>
        {t('documentListToolbar.refresh')}
      </MenuItem>
    </Menu>
  )
}
