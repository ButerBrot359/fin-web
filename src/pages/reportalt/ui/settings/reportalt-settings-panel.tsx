import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import {
  ReportAltSettingsBody,
  type ReportAltSettingsBodyProps,
} from './reportalt-settings-body'

export const ReportAltSettingsPanel = (props: ReportAltSettingsBodyProps) => {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('reportalt.settings.panelTitle')}
      className="flex w-full max-w-[720px] flex-col gap-3 rounded border border-ui-03 p-4"
    >
      <Typography variant="h6" className="font-semibold text-ui-06">
        {t('reportalt.settings.panelTitle')}
      </Typography>
      <ReportAltSettingsBody {...props} />
    </section>
  )
}
