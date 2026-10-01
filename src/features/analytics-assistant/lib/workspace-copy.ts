import { useTranslation } from 'react-i18next'
import type { AnalyticsItemKind } from '@/entities/analytics'
import { localizeDeep } from '@/shared/lib/i18n'
const ru = {
  shortDashboard: 'ИИ · Дашборды',
  shortReport: 'ИИ · Отчёты',
  shortBack: 'Режим',
  shortNew: 'Новый чат',
  landingTitle: 'Что вы хотите создать?',
  landingHint:
    'Опишите задачу своими словами. Ассистент поможет выбрать данные и уточнит детали.',
  dashboardTitle: 'Ассистент дашбордов',
  reportTitle: 'Ассистент отчётов',
  dashboardHint:
    'Наглядная картина: показатели, графики и сравнения на одном экране.',
  reportHint: 'Подробная таблица для проверки, анализа и дальнейшей работы.',
  dashboardStart: 'Создать дашборд',
  reportStart: 'Создать отчёт',
  dashboardExamples: [
    'Хочу видеть, как меняются расходы по месяцам',
    'Помоги сравнить расходы разных подразделений',
    'Какие показатели стоит вынести на главный экран?',
  ],
  reportExamples: [
    'Нужен список расходов за выбранный период',
    'Помоги разобраться, кому и сколько мы должны',
    'Хочу проверить данные по сотрудникам. С чего начать?',
  ],
  friendly:
    'Не нужно знать названия таблиц или писать запросы. Расскажите, что хотите узнать — детали уточним вместе.',
  examples: 'Можно начать так',
  chat: 'Диалог',
  result: 'Результат',
  expand: 'Расширить результат',
  collapse: 'Вернуться к диалогу',
  previewEmpty: 'Здесь появится результат',
  previewHint:
    'Сначала расскажите о задаче. Если данных недостаточно, ассистент задаст уточняющие вопросы.',
  placeholder: 'Что вы хотите узнать или сравнить?',
  send: 'Отправить',
  keyHint: 'Enter — отправить · Shift+Enter — новая строка',
  clarify: 'Уточним детали',
  suggestions: 'Что можно сделать дальше',
  restore: 'Восстанавливаем диалог…',
  restoreError: 'Не удалось открыть сохранённый диалог.',
  retry: 'Попробовать снова',
  wrongKind: 'Ответ относится к другому режиму. Предыдущий результат сохранён.',
  newChat: 'Новый диалог',
  save: 'Сохранить результат',
  back: 'Выбрать другой режим',
  preserved:
    'Последний готовый результат сохранён. Продолжите диалог, чтобы его уточнить.',
}
export function useAnalyticsWorkspaceCopy(
  kind: AnalyticsItemKind = 'DASHBOARD'
) {
  const { i18n } = useTranslation()
  const copy = localizeDeep(ru, i18n.language)
  return {
    ...copy,
    title: kind === 'REPORT' ? copy.reportTitle : copy.dashboardTitle,
    hint: kind === 'REPORT' ? copy.reportHint : copy.dashboardHint,
    examplesList:
      kind === 'REPORT' ? copy.reportExamples : copy.dashboardExamples,
  }
}
