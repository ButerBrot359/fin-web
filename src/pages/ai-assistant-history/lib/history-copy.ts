import { localizeDeep } from '@/shared/lib/i18n'

const ru = {
  title: 'История ИИ-помощника',
  shortTitle: 'История чатов',
  chats: 'Ваши диалоги',
  subtitle: 'Сохранённые вопросы и ответы',
  empty: 'Диалогов пока нет',
  emptyHint: 'Переписка появится здесь после обращения к ИИ-помощнику.',
  choose: 'Выберите диалог',
  chooseHint: 'Здесь можно перечитать ответы и открыть связанные документы.',
  untitled: 'Диалог без названия',
  conversation: 'Сохранённый диалог',
  loading: 'Загрузка…',
  failed: 'Не удалось загрузить историю',
  retry: 'Повторить',
  more: 'Больше диалогов',
  earlier: 'Ранние сообщения',
  noMessages: 'В этом диалоге пока нет сообщений',
  readOnly: 'Сохранённая переписка',
  back: 'К списку диалогов',
  user: 'Вы',
  assistant: 'ИИ-помощник',
  unknownTime: 'Время не сохранено',
}
export type HistoryCopy = typeof ru
export const historyCopy = (language: string): HistoryCopy =>
  localizeDeep(ru, language)
