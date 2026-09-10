import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useAiDisclosure, type AiDisclosure } from '@/entities/ai-assistant'
import { cn } from '@/shared/lib/utils/cn'

/**
 * Что уходит в ИИ — по обоим контурам сразу, рядом.
 *
 * Рядом намеренно: у аналитики и помощника разный класс отправляемых данных, и
 * понять это можно только сравнив. Два отдельных предупреждения на разных
 * экранах читались бы как одно и то же, сказанное дважды.
 *
 * Текст приходит с сервера. Промпты собирает он, и список, зашитый во фронт,
 * разошёлся бы с правдой при первой правке контекста — а предупреждение,
 * которому нельзя верить, хуже отсутствующего.
 */
export const AiDisclosurePanel = () => {
  const { t } = useTranslation()
  const { disclosures, isLoading } = useAiDisclosure()

  if (isLoading || disclosures.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <Typography variant="subtitle2">
        {t('aiAssistant.disclosureTitle')}
      </Typography>
      {/* Один столбец: панель стоит в узкой колонке справа, и два контура рядом
          в ней ужимаются до нечитаемого. Друг под другом они всё так же
          сравниваются — глазом сверху вниз. */}
      <div className="grid gap-3">
        {disclosures.map((disclosure) => (
          <DisclosureCard key={disclosure.kind} disclosure={disclosure} />
        ))}
      </div>
    </div>
  )
}

const DisclosureCard = ({ disclosure }: { disclosure: AiDisclosure }) => {
  const { t } = useTranslation()
  const isWarning = disclosure.severity === 'WARNING'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-r-lg border-l-2 bg-ui-04 px-4 py-3',
        // Цвет несёт смысл, а не украшает: красная линия ставится только тогда,
        // когда учётные данные фактически уходят за периметр организации.
        isWarning ? 'border-support-01' : 'border-accent-02'
      )}
    >
      <Typography variant="body2" fontWeight={600}>
        {disclosure.kind === 'ANALYTICS'
          ? t('aiAssistant.disclosureAnalytics')
          : t('aiAssistant.disclosureAssistant')}
      </Typography>

      <Typography variant="body2" className="text-ui-06">
        {disclosure.summary}
      </Typography>

      <Typography variant="caption" className="text-ui-05">
        {`${disclosure.provider} · ${disclosure.model} · ${
          disclosure.external
            ? t('aiAssistant.disclosureExternal')
            : t('aiAssistant.disclosureInternal')
        }`}
      </Typography>

      <DisclosureList
        label={t('aiAssistant.disclosureSent')}
        items={disclosure.sent}
        // Красным именно перечень уходящего наружу: это единственное здесь,
        // что необратимо, — отправленное обратно не забирается.
        danger={disclosure.external}
      />
      <DisclosureList
        label={t('aiAssistant.disclosureNeverSent')}
        items={disclosure.neverSent}
      />
      <DisclosureList
        label={t('aiAssistant.disclosurePowers')}
        items={disclosure.capabilities}
        danger={disclosure.kind === 'ASSISTANT'}
      />
    </div>
  )
}

const DisclosureList = ({
  label,
  items,
  danger = false,
}: {
  label: string
  items: string[]
  danger?: boolean
}) => {
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5">
      <Typography
        component="span"
        fontSize={11}
        fontWeight={600}
        letterSpacing="0.08em"
        textTransform="uppercase"
        className="text-ui-05"
      >
        {label}
      </Typography>
      {items.map((item) => (
        <Typography
          key={item}
          variant="caption"
          className={danger ? 'text-support-01' : 'text-ui-06'}
        >
          {`— ${item}`}
        </Typography>
      ))}
    </div>
  )
}
