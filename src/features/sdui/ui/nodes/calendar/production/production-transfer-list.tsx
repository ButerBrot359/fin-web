import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ProductionCalendarTransferRow } from '../../../../lib/calendar/production-calendar-types'

// Список переносов (§5.1): presentation уже подготовлен бэком — фронт не
// строит русский текст переноса из дат.
export const ProductionTransferList: FC<{
  transfers: ProductionCalendarTransferRow[]
}> = ({ transfers }) => {
  const { t } = useTranslation()

  if (transfers.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <Typography variant="subtitle2">
        {t('sdui.productionCalendar.transfersTitle')}
      </Typography>
      <ul className="list-disc pl-5 text-sm">
        {transfers.map((row) => (
          <li key={`${row.sourceDate}:${row.destinationDate}`}>
            {row.presentation}
          </li>
        ))}
      </ul>
    </div>
  )
}
