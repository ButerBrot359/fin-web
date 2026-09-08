import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { isAiSettingsMissing } from '../lib/utils/assistant-error'

interface AssistantErrorNoteProps {
  text: string
  /** Куда вести из ошибки «не настроен доступ к ИИ». */
  settingsPath: string
}

/**
 * Ошибка построения: что произошло и что с этим делать. Без извинений и без
 * «упс» — человеку нужен факт и следующий шаг.
 */
export const AssistantErrorNote = ({
  text,
  settingsPath,
}: AssistantErrorNoteProps) => {
  const { t } = useTranslation()

  if (isAiSettingsMissing(text)) {
    return (
      <Typography variant="body2" className="text-ui-06">
        {t('analytics.errors.noAiSettings')}{' '}
        <Link to={settingsPath} className="font-semibold text-accent-02">
          {t('analytics.settings.title')}
        </Link>
      </Typography>
    )
  }

  return (
    <Typography variant="body2" className="text-support-01">
      {text || t('analytics.errors.generateFailed')}
    </Typography>
  )
}
