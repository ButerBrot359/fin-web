import { useTranslation } from 'react-i18next'
import { Tooltip, Typography } from '@mui/material'

interface AiAssistantFabProps {
  onClick: () => void
}

/**
 * Постоянная кнопка запуска помощника.
 *
 * Надпись «AI», а не иконка, — так её описывает концепция, и это удачно вдвойне:
 * в реестре иконок проекта нет глифа чата, а вводить свой ради одной кнопки
 * значило бы обойти правило «иконки только из реестра».
 *
 * Стоит НАД кнопкой поддержки, а не рядом. Правый нижний угол уже занят: во время
 * звонка кнопка поддержки подменяется панелью звонка шириной 288 px по тем же
 * координатам, и сосед слева оказался бы под ней.
 */
export const AiAssistantFab = ({ onClick }: AiAssistantFabProps) => {
  const { t } = useTranslation()

  return (
    <div className="fixed right-6 bottom-24 z-[1050]">
      <Tooltip title={t('aiAssistant.open')} placement="left">
        <button
          type="button"
          aria-label={t('aiAssistant.open')}
          onClick={onClick}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-accent-02 text-ui-01 shadow-call-glow transition-all hover:brightness-110"
        >
          <Typography
            component="span"
            fontSize={17}
            fontWeight={700}
            letterSpacing="0.04em"
          >
            AI
          </Typography>
        </button>
      </Tooltip>
    </div>
  )
}
