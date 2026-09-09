import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'

import type { AiAssistantCapability } from '@/entities/ai-assistant'
import type { TranslationKey } from '@/shared/types/i18n.types'
import { cn } from '@/shared/lib/utils/cn'

interface CapabilityRow {
  value: AiAssistantCapability
  labelKey: TranslationKey
  hintKey: TranslationKey
  /** Действие меняет учёт, а не готовит данные — помечается красным. */
  critical?: boolean
}

/**
 * Порядок не алфавитный, а по нарастанию последствий: сначала чтение, затем запись,
 * затем то, что трогает учёт. Так галочка, которую опасно ставить не глядя, оказывается
 * внизу, а не между двумя безобидными.
 */
const READ_ROWS: CapabilityRow[] = [
  {
    value: 'SEARCH_DATA',
    labelKey: 'aiAssistant.capSearch',
    hintKey: 'aiAssistant.capSearchHint',
  },
  {
    value: 'QUERY_TOTALS',
    labelKey: 'aiAssistant.capTotals',
    hintKey: 'aiAssistant.capTotalsHint',
  },
]

const WRITE_ROWS: CapabilityRow[] = [
  {
    value: 'CREATE_DOCUMENT',
    labelKey: 'aiAssistant.capCreateDocument',
    hintKey: 'aiAssistant.capCreateDocumentHint',
  },
  {
    value: 'UPDATE_DOCUMENT',
    labelKey: 'aiAssistant.capUpdateDocument',
    hintKey: 'aiAssistant.capUpdateDocumentHint',
  },
  {
    value: 'CREATE_DICTIONARY_ENTRY',
    labelKey: 'aiAssistant.capCreateDictionary',
    hintKey: 'aiAssistant.capCreateDictionaryHint',
  },
  {
    value: 'POST_DOCUMENT',
    labelKey: 'aiAssistant.capPost',
    hintKey: 'aiAssistant.capPostHint',
    critical: true,
  },
  {
    value: 'UNPOST_DOCUMENT',
    labelKey: 'aiAssistant.capUnpost',
    hintKey: 'aiAssistant.capUnpostHint',
    critical: true,
  },
  {
    value: 'DELETE_DOCUMENT',
    labelKey: 'aiAssistant.capDelete',
    hintKey: 'aiAssistant.capDeleteHint',
    critical: true,
  },
]

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

  const renderRow = (row: CapabilityRow) => (
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
        {READ_ROWS.map(renderRow)}
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
        {WRITE_ROWS.map(renderRow)}
      </div>
    </div>
  )
}
