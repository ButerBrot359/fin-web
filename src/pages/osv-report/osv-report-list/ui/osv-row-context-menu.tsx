import { Menu, MenuItem } from '@mui/material'

/** Позиция контекстного меню (координаты курсора). */
export interface OsvMenuPosition {
  top: number
  left: number
}

interface OsvRowContextMenuProps {
  /** Координаты открытия; `null` — меню закрыто. */
  position: OsvMenuPosition | null
  onClose: () => void
  /** Подпись пункта «Открыть …»; `null` — пункт скрыт (открывать нечего). */
  openLabel: string | null
  onOpen: () => void
  /** Подпись пункта «Карточка счёта N». */
  accountCardLabel: string
  onOpenAccountCard: () => void
}

/**
 * Меню выбора по строке ОСВ (двойной клик), как в 1С: «Открыть <элемент>»
 * (карточка справочника/документа — если строка ссылается на элемент) и
 * «Карточка счёта N» (движения по счёту). Презентационный компонент —
 * навигацию выполняет страница.
 */
export const OsvRowContextMenu = ({
  position,
  onClose,
  openLabel,
  onOpen,
  accountCardLabel,
  onOpenAccountCard,
}: OsvRowContextMenuProps) => (
  <Menu
    open={position != null}
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={
      position ? { top: position.top, left: position.left } : undefined
    }
  >
    {openLabel != null && (
      <MenuItem
        onClick={() => {
          onOpen()
          onClose()
        }}
      >
        {openLabel}
      </MenuItem>
    )}
    <MenuItem
      onClick={() => {
        onOpenAccountCard()
        onClose()
      }}
    >
      {accountCardLabel}
    </MenuItem>
  </Menu>
)
