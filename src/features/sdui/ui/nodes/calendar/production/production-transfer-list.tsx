import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ProductionCalendarTransferRow } from '../../../../lib/calendar/production-calendar-types'

// Список переносов (v5 §2.5): presentation уже подготовлен бэком — фронт не
// строит русский текст переноса из дат. Семантическая таблица, одна текстовая
// строка на перенос.
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
      <table className="text-sm">
        <tbody>
          {transfers.map((row) => (
            <tr key={`${row.sourceDate}:${row.destinationDate}`}>
              <td className="py-0.5">{row.presentation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
