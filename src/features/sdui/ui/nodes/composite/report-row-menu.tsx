import { Menu, MenuItem } from '@mui/material'

/** Позиция меню — координаты курсора, у которого оно открылось. */
export interface ReportRowMenuPosition {
  top: number
  left: number
}

/** Пункт меню строки: подпись и действие. */
export interface ReportRowMenuAction {
  key: string
  label: string
  onSelect: () => void
}

interface ReportRowMenuProps {
  /** Координаты открытия; `null` — меню закрыто. */
  position: ReportRowMenuPosition | null
  onClose: () => void
  actions: ReportRowMenuAction[]
}

/**
 * Меню действий по строке результата отчёта, как в 1С: открывается и двойным
 * кликом, и правой кнопкой, а выбор пункта выполняет переход. Презентационный
 * компонент — состав пунктов и навигацию задаёт владелец результата.
 *
 * <p>Пустой список действий меню не показывает: строка, у которой открывать
 * нечего (итог, группа без ссылки), не должна давать пустую рамку.
 */
export const ReportRowMenu = ({
  position,
  onClose,
  actions,
}: ReportRowMenuProps) => (
  <Menu
    open={position != null && actions.length > 0}
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={
      position ? { top: position.top, left: position.left } : undefined
    }
  >
    {actions.map((action) => (
      <MenuItem
        key={action.key}
        onClick={() => {
          action.onSelect()
          onClose()
        }}
      >
        {action.label}
      </MenuItem>
    ))}
  </Menu>
)
