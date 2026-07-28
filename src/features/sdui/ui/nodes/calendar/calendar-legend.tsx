import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const CalendarLegend: FC = () => {
  const { t } = useTranslation()

  const items = [
    { key: 'working', swatch: 'bg-[#2a75f4]', label: t('sdui.calendar.legend.working') },
    { key: 'nonWorking', swatch: 'bg-gray-400', label: t('sdui.calendar.legend.nonWorking') },
    { key: 'manual', swatch: 'bg-amber-100', label: t('sdui.calendar.legend.manual') },
  ]

  return (
    <div className="flex items-center gap-4 text-sm">
      {items.map((it) => (
        <span key={it.key} className="flex items-center gap-1">
          <span className={`inline-block w-3 h-3 rounded-sm ${it.swatch}`} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
