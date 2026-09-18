import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AiAssistantCapability } from '@/entities/ai-assistant'
import type { TranslationKey } from '@/shared/types/i18n.types'
import { Button } from '@/shared/ui/buttons'
import { cn } from '@/shared/lib/utils/cn'

import {
  DEFAULT_CAPABILITIES,
  isCapabilityAllowed,
  READ_CAPABILITIES,
  WRITE_CAPABILITIES,
  type CapabilityDescriptor,
} from '../lib/consts/capability-catalog'

interface AssistantHelpProps {
  /** Разрешения организации; `null` — ещё не загружены. */
  capabilities: AiAssistantCapability[] | null
  disabled: boolean
  onAsk: (question: string) => void
}

const LIMIT_KEYS: TranslationKey[] = [
  'aiAssistant.helpLimitUnposted',
  'aiAssistant.helpLimitNoDelete',
  'aiAssistant.helpLimitOwnOrg',
  'aiAssistant.helpLimitNoSettings',
  'aiAssistant.helpLimitCheck',
]

/**
 * Справка: что помощник умеет, чем это просят и что из этого разрешено здесь.
 *
 * <p>Перечень действий один и тот же и в настройках, и здесь — общий каталог
 * разрешений. Справка, живущая своим списком, начинает обещать то, чего нет.
 *
 * <p>Показываются ВСЕ действия, включая выключенные, и выключенные помечены явно.
 * Спрятать их значило бы отвечать на «что умеет помощник» словами «то, что вам
 * разрешили»: человек не поймёт, чего просить у того, кто ставит галочки.
 *
 * <p>Пример — рабочая фраза, а не образец стиля: нажатие отправляет её помощнику.
 * У выключенного действия пример показан, но нажать нельзя — отправлять запрос,
 * который сервер заведомо отклонит, незачем.
 */
export const AssistantHelp = ({
  capabilities,
  disabled,
  onAsk,
}: AssistantHelpProps) => {
  const { t } = useTranslation()
  const allowed = capabilities ?? DEFAULT_CAPABILITIES
  const hasDisabled = [...READ_CAPABILITIES, ...WRITE_CAPABILITIES].some(
    (row) => !isCapabilityAllowed(row.value, allowed)
  )

  const renderRow = (row: CapabilityDescriptor) => {
    const isAllowed = isCapabilityAllowed(row.value, allowed)

    return (
      <div
        key={row.value}
        className="flex min-w-0 flex-col gap-1 rounded-md bg-ui-02 px-3 py-2"
      >
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <Typography
            variant="body2"
            fontWeight={600}
            className={cn(
              'min-w-0 break-words',
              row.critical ? 'text-support-01' : 'text-ui-06'
            )}
          >
            {t(row.labelKey)}
          </Typography>
          {!isAllowed && (
            <Typography
              component="span"
              variant="caption"
              className="shrink-0 rounded-sm bg-ui-04 px-1.5 py-0.5 text-ui-05"
            >
              {t('aiAssistant.helpOff')}
            </Typography>
          )}
        </div>

        <Typography variant="caption" className="break-words text-ui-05">
          {t(row.hintKey)}
        </Typography>

        <Button
          size="small"
          variant="tertiary"
          disabled={disabled || !isAllowed}
          className="min-w-0 justify-start px-0 text-left whitespace-normal"
          onClick={() => {
            onAsk(t(row.exampleKey))
          }}
        >
          {`«${t(row.exampleKey)}»`}
        </Button>
      </div>
    )
  }

  const renderGroup = (
    titleKey: TranslationKey,
    rows: CapabilityDescriptor[]
  ) => (
    <div className="flex flex-col gap-2">
      <Typography
        component="span"
        fontSize={11}
        fontWeight={600}
        letterSpacing="0.08em"
        textTransform="uppercase"
        className="text-ui-05"
      >
        {t(titleKey)}
      </Typography>
      {rows.map(renderRow)}
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Typography variant="body2" className="break-words text-ui-05">
        {t('aiAssistant.helpIntro')}
      </Typography>

      {renderGroup('aiAssistant.capabilitiesRead', READ_CAPABILITIES)}
      {renderGroup('aiAssistant.capabilitiesWrite', WRITE_CAPABILITIES)}

      {hasDisabled && (
        <Typography variant="caption" className="break-words text-ui-05">
          {t('aiAssistant.helpOffHint')}
        </Typography>
      )}

      <div className="flex flex-col gap-1">
        <Typography variant="subtitle2" className="text-ui-06">
          {t('aiAssistant.helpLimitsTitle')}
        </Typography>
        {LIMIT_KEYS.map((key) => (
          <Typography
            key={key}
            variant="caption"
            className="break-words text-ui-05"
          >
            {`— ${t(key)}`}
          </Typography>
        ))}
      </div>

      <Typography variant="caption" className="break-words text-ui-05">
        {t('aiAssistant.helpFooter')}
      </Typography>
    </div>
  )
}
