import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import noContentImg from '@/shared/assets/info/no-content.png'

export const MainPage = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <img src={noContentImg} alt="" width={400} height={400} />
      <Typography variant="h4" fontWeight={600}>
        {t('main.title')}
      </Typography>
    </div>
  )
}
