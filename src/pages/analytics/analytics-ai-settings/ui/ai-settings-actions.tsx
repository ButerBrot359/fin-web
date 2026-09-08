import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

interface AiSettingsActionsProps {
  isSaving: boolean
  isTesting: boolean
  /**
   * Форму трогали после последнего сохранения. Проверка идёт сохранёнными
   * настройками, а не значениями полей, поэтому на изменённой форме она
   * проверяла бы не то, что видит человек.
   */
  isDirty: boolean
  onSave: () => void
  onTest: () => void
}

/**
 * Строка действий формы настроек: прилипает к низу панели, поэтому кнопки
 * видны на любой прокрутке — искать «Сохранить» под параметрами генерации не
 * приходится. Отрицательные поля вытягивают строку на края панели (p-5).
 */
export const AiSettingsActions = ({
  isSaving,
  isTesting,
  isDirty,
  onSave,
  onTest,
}: AiSettingsActionsProps) => {
  const { t } = useTranslation()

  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-2 rounded-b-lg border-t border-ui-03 bg-ui-01 px-5 py-4">
      <Button variant="primary" disabled={isSaving} onClick={onSave}>
        {t('analytics.settings.save')}
      </Button>
      <Button
        variant="secondary"
        disabled={isTesting || isDirty}
        onClick={onTest}
      >
        {isTesting
          ? t('analytics.settings.testing')
          : t('analytics.settings.test')}
      </Button>
    </div>
  )
}
