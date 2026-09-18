import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type {
  AiAssistantCapability,
  AiAssistantContext,
} from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'

import { selectPresets } from '../lib/consts/assistant-presets'

interface AssistantPresetsProps {
  context: AiAssistantContext
  /** Разрешения организации; `null` — ещё не загружены. */
  capabilities: AiAssistantCapability[] | null
  disabled: boolean
  onSelect: (prompt: string) => void
}

/**
 * Готовые формулировки под текущим положением помощника.
 *
 * <p>Нажатие отправляет вопрос целиком, а не подставляет его в поле: заготовка нужна
 * тому, кто ещё не знает, о чём здесь можно спросить, и промежуточный шаг
 * «дописать и нажать отправить» этому человеку ничего не даёт.
 */
export const AssistantPresets = ({
  context,
  capabilities,
  disabled,
  onSelect,
}: AssistantPresetsProps) => {
  const { t } = useTranslation()
  const presets = selectPresets(context, capabilities)

  if (presets.length === 0) return null

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Typography
        component="span"
        fontSize={11}
        fontWeight={600}
        letterSpacing="0.08em"
        textTransform="uppercase"
        className="text-ui-05"
      >
        {t('aiAssistant.presets')}
      </Typography>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            size="small"
            variant="tertiary"
            disabled={disabled}
            onClick={() => {
              onSelect(t(preset.promptKey))
            }}
          >
            {t(preset.labelKey)}
          </Button>
        ))}
      </div>
    </div>
  )
}
