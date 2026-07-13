import { useNavigate } from 'react-router-dom'
import { IconButton } from '@mui/material'
import { useTranslation } from 'react-i18next'

import ArrowLeftIcon from '@/shared/assets/navigation/arrow-left-default.svg'
import ArrowRightIcon from '@/shared/assets/navigation/arrow-right-default.svg'

interface NavigationButtonsProps {
  // Панельная workspace-вкладка живёт вне роутера: «назад» там — закрытие
  // вкладки, а не navigate(-1). Без пропа поведение прежнее.
  onBack?: () => void
}

export const NavigationButtons = ({ onBack }: NavigationButtonsProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleBack = async () => {
    if (onBack) {
      onBack()
      return
    }
    await navigate(-1)
  }

  return (
    <div className="flex items-center">
      <IconButton aria-label={t('actions.back')} onClick={handleBack}>
        <ArrowLeftIcon className="h-5 w-5" />
      </IconButton>
      <IconButton aria-label={t('actions.forward' as never)} disabled>
        <ArrowRightIcon className="h-5 w-5" />
      </IconButton>
    </div>
  )
}
