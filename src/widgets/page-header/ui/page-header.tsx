import { useNavigate } from 'react-router-dom'
import { IconButton, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { FavoriteButton } from '@/features/favorite-button'
import { NavigationButtons } from '@/features/navigation-buttons'
import LinkIcon from '@/shared/assets/icons/link.svg'
import DotsIcon from '@/shared/assets/icons/dots.svg'
import CrossIcon from '@/shared/assets/icons/cross.svg'

interface PageHeaderProps {
  title: string
}

export const PageHeader = ({ title }: PageHeaderProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleClose = async () => {
    await navigate(-1)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <NavigationButtons />
        <FavoriteButton />

        <Typography variant="h5" fontWeight={600}>
          {title}
        </Typography>
      </div>

      <div className="flex items-center">
        <IconButton aria-label={t('actions.link')}>
          <LinkIcon className="h-5 w-5" />
        </IconButton>
        <IconButton aria-label={t('actions.more')}>
          <DotsIcon className="h-5 w-5" />
        </IconButton>
        <IconButton aria-label={t('actions.close')} onClick={handleClose}>
          <CrossIcon className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  )
}
