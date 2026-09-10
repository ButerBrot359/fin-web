import { useTranslation } from 'react-i18next'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import CloseIcon from '@mui/icons-material/Close'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import MinimizeIcon from '@mui/icons-material/Minimize'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { IconButton, Tooltip, Typography } from '@mui/material'

import type { TranslationKey } from '@/shared/types/i18n.types'

interface AssistantPanelHeaderProps {
  minimized: boolean
  enlarged: boolean
  /** Вместо ленты диалога показана справка. */
  helpOpen: boolean
  onToggleHelp: () => void
  onToggleSize: () => void
  onToggleMinimize: () => void
  onClose: () => void
}

/**
 * Шапка панели помощника.
 *
 * <p>Управление иконками, а не надписями: три текстовые кнопки съедали половину ширины
 * панели в 26rem, и заголовок обрезался до пары слов. Иконки — стандартные оконные,
 * их читают без подписи, а подпись остаётся во всплывающей подсказке.
 *
 * <p>Иконки из `@mui/icons-material`: оконных глифов (свернуть, развернуть, закрыть) в
 * реестре Figma нет, а прецедент рядом — `features/support-call` берёт их оттуда же.
 */
export const AssistantPanelHeader = ({
  minimized,
  enlarged,
  helpOpen,
  onToggleHelp,
  onToggleSize,
  onToggleMinimize,
  onClose,
}: AssistantPanelHeaderProps) => {
  const { t } = useTranslation()

  const action = (
    titleKey: TranslationKey,
    icon: React.ReactNode,
    onClick: () => void
  ) => (
    <Tooltip title={t(titleKey)}>
      <IconButton size="small" aria-label={t(titleKey)} onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  )

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ui-03 px-3 py-2">
      <Typography variant="subtitle2" className="min-w-0 truncate text-ui-06">
        {helpOpen ? t('aiAssistant.helpTitle') : t('aiAssistant.title')}
      </Typography>

      <div className="flex shrink-0 items-center">
        {/* В справке та же кнопка ведёт обратно: стрелка «назад» читается однозначно,
            а знак вопроса в положении «уже открыто» непонятно чем работает. Заголовок
            при этом меняется — вместе они говорят, где человек находится. */}
        {!minimized &&
          action(
            helpOpen ? 'aiAssistant.helpBack' : 'aiAssistant.helpOpen',
            helpOpen ? (
              <ArrowBackIcon fontSize="small" />
            ) : (
              <HelpOutlineIcon fontSize="small" />
            ),
            onToggleHelp
          )}

        {/* Размер прячем в свёрнутом состоянии: менять габариты полоски заголовка
            бессмысленно, а лишняя кнопка сбивает. */}
        {!minimized &&
          action(
            enlarged ? 'aiAssistant.shrink' : 'aiAssistant.enlarge',
            enlarged ? (
              <CloseFullscreenIcon fontSize="small" />
            ) : (
              <OpenInFullIcon fontSize="small" />
            ),
            onToggleSize
          )}

        {action(
          minimized ? 'aiAssistant.expand' : 'aiAssistant.minimize',
          <MinimizeIcon fontSize="small" />,
          onToggleMinimize
        )}

        {action('actions.close', <CloseIcon fontSize="small" />, onClose)}
      </div>
    </div>
  )
}
