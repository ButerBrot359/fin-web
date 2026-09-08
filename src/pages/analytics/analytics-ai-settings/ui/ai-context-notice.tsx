import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

/**
 * Обещание фичи, вынесенное в интерфейс: в модель уходит только структура
 * данных — витрины, колонки, типы и названия. Суммы, ФИО и реквизиты
 * контрагентов не отправляются никогда.
 *
 * Не алерт, а плашка с линией accent-02 слева: бухгалтер должен прочитать
 * это как заявление продукта, а не как системное предупреждение. Текст на
 * подсветке ui-04 держим цветом ui-06 — вторичный ui-05 на ней нечитаем.
 */
export const AiContextNotice = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1 rounded-r-lg border-l-2 border-accent-02 bg-ui-04 px-4 py-3">
      <Typography variant="body2" fontWeight={600}>
        {t('analytics.settings.context')}
      </Typography>
      <Typography variant="body2" className="text-ui-06">
        {t('analytics.settings.contextHint')}
      </Typography>
    </div>
  )
}
