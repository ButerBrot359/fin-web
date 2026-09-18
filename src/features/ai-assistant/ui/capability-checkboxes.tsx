import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'

import type { AiAssistantCapability } from '@/entities/ai-assistant'
import { cn } from '@/shared/lib/utils/cn'

import {
  isCapabilityAllowed,
  READ_CAPABILITIES,
  WRITE_CAPABILITIES,
  type CapabilityDescriptor,
} from '../lib/consts/capability-catalog'

interface CapabilityCheckboxesProps {
  value: AiAssistantCapability[]
  onChange: (capabilities: AiAssistantCapability[]) => void
}

/**
 * Что помощнику разрешено делать.
 *
 * <p>Помощник умеет всё перечисленное; галочки решают, что ему позволено. Тот же набор
 * проверяется на сервере перед каждым действием — форма выражает решение, а не исполняет
 * его: снятая галочка должна останавливать и прямой вызов API.
 *
 * <p>Чтение открытой формы галочки не имеет намеренно: помощник, которому нельзя
 * посмотреть документ, перед которым стоит человек, бесполезен целиком.
 */
export const CapabilityCheckboxes = ({
  value,
  onChange,
}: CapabilityCheckboxesProps) => {
  const { t } = useTranslation()

  const toggle = (capability: AiAssistantCapability, checked: boolean) => {
    onChange(
      checked
        ? [...value, capability]
        : value.filter((item) => item !== capability)
    )
  }

  const renderRow = (row: CapabilityDescriptor) => (
    <div key={row.value} className="flex flex-col">
      <FormControlLabel
        control={
          <Checkbox
            checked={value.includes(row.value)}
            onChange={(event) => {
              toggle(row.value, event.target.checked)
            }}
          />
        }
        label={
          <Typography
            variant="body2"
            fontWeight={row.critical ? 700 : 400}
            className={row.critical ? 'text-support-01' : 'text-ui-06'}
          >
            {t(row.labelKey)}
          </Typography>
        }
      />
      <Typography
        variant="caption"
        className={cn('pl-8', row.critical ? 'text-support-01' : 'text-ui-05')}
      >
        {t(row.hintKey)}
      </Typography>
      {value.includes(row.value) && !isCapabilityAllowed(row.value, value) && (
        <Typography variant="caption" className="pl-8 text-support-01">
          {t('aiAssistant.capRequires', {
            capabilities: [...READ_CAPABILITIES, ...WRITE_CAPABILITIES]
              .filter(
                (item) =>
                  row.requires?.includes(item.value) &&
                  !value.includes(item.value)
              )
              .map((item) => t(item.labelKey))
              .join(', '),
          })}
        </Typography>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Typography variant="subtitle2">
          {t('aiAssistant.capabilitiesTitle')}
        </Typography>
        <Typography variant="body2" className="text-ui-05">
          {t('aiAssistant.capabilitiesHint')}
        </Typography>
      </div>

      <div className="flex flex-col">
        <Typography
          component="span"
          fontSize={11}
          fontWeight={600}
          letterSpacing="0.08em"
          textTransform="uppercase"
          className="text-ui-05"
        >
          {t('aiAssistant.capabilitiesRead')}
        </Typography>
        {READ_CAPABILITIES.map(renderRow)}
      </div>

      <div className="flex flex-col">
        <Typography
          component="span"
          fontSize={11}
          fontWeight={600}
          letterSpacing="0.08em"
          textTransform="uppercase"
          className="text-ui-05"
        >
          {t('aiAssistant.capabilitiesWrite')}
        </Typography>
        {WRITE_CAPABILITIES.map(renderRow)}
      </div>
    </div>
  )
}
