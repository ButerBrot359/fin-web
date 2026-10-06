import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

/**
 * Экран «Объект не найден» (SCRUM-400 §9.5): 404 на открытии SDUI-формы.
 * Запись не существует ЛИБО вне области пользователя (RLS) — сервер их
 * намеренно не различает, и фронт не должен. НЕ «Страница не найдена»
 * (это про маршрут, который не распознал сам фронт) и не «Нет доступа».
 */
export const ObjectNotFound: FC = () => {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Typography variant="h5">{t('sdui.objectNotFound.title')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('sdui.objectNotFound.description')}
      </Typography>
    </div>
  )
}
