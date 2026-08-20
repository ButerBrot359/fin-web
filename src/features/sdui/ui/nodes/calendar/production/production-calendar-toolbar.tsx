import type { FC, MouseEvent } from 'react'
import { Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ProductionCalendarToolbarProps {
  selectedCount: number
  canChangeDay: boolean
  canTransferDay: boolean
  canFillYear: boolean
  canPrint: boolean
  busy: boolean
  onChangeDay: (anchorPosition: { left: number; top: number }) => void
  onTransferDay: () => void
  onFillYear: () => void
  onPrint: () => void
  onClearSelection: () => void
}

// Toolbar спец-команд карточки (§5.2). Доступность кнопок — только из
// allowedOperations + локального выбора; фронт права не вычисляет.
export const ProductionCalendarToolbar: FC<ProductionCalendarToolbarProps> = ({
  selectedCount,
  canChangeDay,
  canTransferDay,
  canFillYear,
  canPrint,
  busy,
  onChangeDay,
  onTransferDay,
  onFillYear,
  onPrint,
  onClearSelection,
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
        disabled={busy || !canChangeDay || selectedCount === 0}
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
      {selectedCount > 0 && (
        <>
          <Button size="small" onClick={onClearSelection} disabled={busy}>
            {t('sdui.productionCalendar.clearSelection')}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {t('sdui.productionCalendar.selectedCount', {
              count: selectedCount,
            })}
          </Typography>
        </>
      )}
    </div>
  )
}
