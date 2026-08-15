import type { FC, MouseEventHandler, TouchEventHandler } from 'react'
import { useTranslation } from 'react-i18next'

interface ColumnResizeHandleProps {
  /** Колонку тянут прямо сейчас — ручка подсвечена всё время перетаскивания. */
  isResizing: boolean
  onMouseDown: MouseEventHandler<HTMLDivElement>
  onTouchStart: TouchEventHandler<HTMLDivElement>
}

/**
 * Вертикальная ручка у правой границы ячейки заголовка. Общая для всех
 * SDUI-таблиц: обработчики приходят снаружи — от TanStack
 * (`header.getResizeHandler()`) или от ручного drag'а (`useManualColumnResize`),
 * поэтому типы пропсов — React-овые `MouseEventHandler`/`TouchEventHandler`.
 *
 * <p>Ячейка-родитель обязана иметь `position: relative` (или `sticky`) и
 * `overflow: hidden`, иначе ручка уедет и ширина не применится.
 *
 * <p>`onClick` со `stopPropagation` обязателен: без него клик по ручке
 * всплывает в заголовок (сортировка списка) или в строку (выбор строки).
 */
export const ColumnResizeHandle: FC<ColumnResizeHandleProps> = ({
  isResizing,
  onMouseDown,
  onTouchStart,
}) => {
  const { t } = useTranslation()

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('table.resizeColumn')}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={(event) => {
        event.stopPropagation()
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
      }}
      className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-accent-02 ${
        isResizing ? 'bg-accent-02' : ''
      }`}
    />
  )
}
