import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import noContentImg from '@/shared/assets/info/no-content.png'

export const NoContent = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <img src={noContentImg} alt="" width={250} height={250} />
      <Typography variant="h6" className="text-ui-06">
        {t('noContent.title')}
      </Typography>
      <Typography
        variant="body2"
        className="text-ui-05 whitespace-pre-line text-center"
      >
        {t('noContent.description')}
      </Typography>
    </div>
  )
}
