import { useTranslation } from 'react-i18next'

import { formatUi, isKzLanguage, localizeDeep } from '@/shared/lib/i18n'

const ru = {
  details: 'Что получит ИИ',
  shortPolicy: 'Только выбранные справочники',
  revocation:
    'Снятие галочки прекращает добавление значений в новые обращения. Ранее переданные данные не отзываются.',
  title: 'Доступ к справочникам',
  subtitle:
    'Выберите, какие справочники помогают ИИ точнее понимать ваши вопросы.',
  policy:
    'Ассистент аналитики получает структуру данных и коды с названиями только выбранных справочников. Реквизиты документов, суммы и результаты SQL-запросов в модель не отправляются.',
  limits:
    'До {{values}} значений из каждого разрешённого справочника; до {{length}} символов в коде или названии.',
  defaultOff:
    'Без разрешения значения справочника не передаются. Изменения применяются к следующим обращениям к ИИ.',
  allowed: 'Разрешено',
  total: 'Всего справочников',
  found: 'Найдено',
  search: 'Найти по названию или коду',
  empty: 'Справочники не найдены',
  emptyHint: 'Попробуйте другое название или очистите поиск.',
  clear: 'Очистить поиск',
  loadError: 'Не удалось загрузить справочники.',
  retry: 'Повторить',
  saved: 'Сохранено',
  saveError: 'Не удалось сохранить. Попробуйте ещё раз.',
  saving: 'Сохраняем…',
  back: 'Настройки ИИ',
  open: 'Настроить доступ',
  cardHint:
    'Коды и названия выбранных справочников помогут ассистенту правильно понимать ваши формулировки.',
  next: 'Следующая страница',
  previous: 'Предыдущая страница',
  page: 'Страница {{page}} из {{count}}',
}
export function useDictionaryPermissionsCopy() {
  const { i18n } = useTranslation()
  const language = i18n.language
  return {
    copy: {
      ...localizeDeep(ru, language),
      limits: (values: number, length: number) =>
        formatUi(ru.limits, { values, length }, language),
      page: (page: number, count: number) =>
        formatUi(ru.page, { page, count }, language),
    },
    isKz: isKzLanguage(language),
  }
}
