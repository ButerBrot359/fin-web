import { useTranslation } from 'react-i18next'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { Tooltip } from '@mui/material'
import { FLOATING_BOTTOM_SECOND } from '@/shared/lib/utils/floating-widgets'
import { cn } from '@/shared/lib/utils/cn'

interface AiAssistantFabProps {
  onClick: () => void
}

/**
 * Постоянная кнопка запуска помощника.
 *
 * <p>Иконка «искры» ({@code AutoAwesome}) — сложившийся общий знак ИИ: её узнают без
 * подписи, потому что она стоит на этом месте у всех. Надпись «AI», которую предлагала
 * концепция, требовала прочтения; символ работает быстрее.
 *
 * <p>Иконка из `@mui/icons-material`, а не из реестра Figma: глифа искр там нет, а заводить
 * свой ради одной кнопки — обходить правило вместо того, чтобы его дополнить. Прецедент
 * рядом: `features/support-call` берёт иконки оттуда же.
 *
 * <p>Кнопка стоит НАД кнопкой поддержки, а не рядом. Правый нижний угол уже занят: во время
 * звонка кнопка поддержки подменяется панелью звонка шириной 288 px по тем же координатам,
 * и сосед слева оказался бы под ней.
 */
export const AiAssistantFab = ({ onClick }: AiAssistantFabProps) => {
  const { t } = useTranslation()

  return (
    <div className={cn('fixed right-6 z-[1050]', FLOATING_BOTTOM_SECOND)}>
      <Tooltip title={t('aiAssistant.open')} placement="left">
        <button
          type="button"
          aria-label={t('aiAssistant.open')}
          onClick={onClick}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-accent-02 text-ui-01 shadow-call-glow transition-all hover:brightness-110"
        >
          <AutoAwesomeIcon sx={{ fontSize: 26 }} />
        </button>
      </Tooltip>
    </div>
  )
}
