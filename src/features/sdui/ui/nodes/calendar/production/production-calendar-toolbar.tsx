import type { FC, MouseEvent } from 'react'
import { Button } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ProductionCalendarToolbarProps {
  hasSelection: boolean
  canChangeDay: boolean
  canTransferDay: boolean
  canFillYear: boolean
  canPrint: boolean
  busy: boolean
  onChangeDay: (anchorPosition: { left: number; top: number }) => void
  onTransferDay: () => void
  onFillYear: () => void
  onPrint: () => void
}

// Toolbar спец-команд карточки (§5.2). Доступность кнопок — только из
// allowedOperations + локального выбора; фронт права не вычисляет.
// Плашки «Очистить выбор: N» нет (v11 §4.4): выделение одиночное, снять его —
// кликнуть по выбранному дню или выбрать другой.
export const ProductionCalendarToolbar: FC<ProductionCalendarToolbarProps> = ({
  hasSelection,
  canChangeDay,
  canTransferDay,
  canFillYear,
  canPrint,
  busy,
  onChangeDay,
  onTransferDay,
  onFillYear,
  onPrint,
}) => {
  const { t } = useTranslation()

  const handleChangeDay = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onChangeDay({ left: rect.left, top: rect.bottom })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="small"
        variant="outlined"
        disabled={busy || !canChangeDay || !hasSelection}
        onClick={handleChangeDay}
      >
        {t('sdui.productionCalendar.changeDay')}
      </Button>
      <Button
        size="small"
        variant="outlined"
        disabled={busy || !canTransferDay}
        onClick={onTransferDay}
      >
        {t('sdui.productionCalendar.transferDay')}
      </Button>
      <Button
        size="small"
        variant="outlined"
        disabled={busy || !canFillYear}
        onClick={onFillYear}
      >
        {t('sdui.calendar.fillDefaults')}
      </Button>
      <Button
        size="small"
        variant="outlined"
        disabled={busy || !canPrint}
        onClick={onPrint}
      >
        {t('sdui.productionCalendar.print')}
      </Button>
    </div>
  )
}
