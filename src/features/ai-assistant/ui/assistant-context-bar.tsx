import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AiAssistantContext } from '@/entities/ai-assistant'

interface AssistantContextBarProps {
  context: AiAssistantContext
}

/**
 * Строка контекста: что именно видит помощник.
 *
 * Показывается всегда, включая случай «документ не открыт». Пустое место здесь
 * читалось бы как «контекст есть, просто не подписан», а бухгалтеру нужно
 * понимать, отвечают ли ему по его документу или по общим знаниям — от этого
 * зависит, можно ли верить числам в ответе.
 */
export const AssistantContextBar = ({ context }: AssistantContextBarProps) => {
  const { t } = useTranslation()
  const hasDocument = context.kind === 'DOCUMENT' && Boolean(context.entryId)

  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-ui-02 px-3 py-2">
      <Typography
        component="span"
        fontSize={11}
        fontWeight={600}
        letterSpacing="0.08em"
        textTransform="uppercase"
        className="text-ui-05"
      >
        {t('aiAssistant.context')}
      </Typography>
      <Typography variant="body2" className="text-ui-06">
        {hasDocument
          ? `${context.typeCode ?? ''} №${String(context.entryId)}`
          : t('aiAssistant.contextNone')}
      </Typography>
    </div>
  )
}
