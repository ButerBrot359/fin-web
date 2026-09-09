import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AiAssistantContext } from '@/entities/ai-assistant'

interface AssistantContextBarProps {
  context: AiAssistantContext
}

/**
 * Строка контекста: что именно видит помощник.
 *
 * <p>Показывается всегда, включая случай «ничего не открыто». Пустое место здесь читалось
 * бы как «контекст есть, просто не подписан», а бухгалтеру нужно понимать, отвечают ли ему
 * по его документу или по общим знаниям — от этого зависит, можно ли верить числам.
 *
 * <p>Различаются все положения, а не только открытая карточка. Раньше список и новая
 * карточка подписывались как «документ не открыт», хотя тип из адреса уже известен, и
 * помощник по нему вполне может работать.
 */
export const AssistantContextBar = ({ context }: AssistantContextBarProps) => {
  const { t } = useTranslation()

  const label = (): string => {
    const type = context.typeCode ?? ''
    switch (context.kind) {
      case 'DOCUMENT':
        return context.entryId
          ? `${type} №${String(context.entryId)}`
          : `${type} — список документов`
      case 'DOCUMENT_LIST':
        return `${type} — список документов`
      case 'DOCUMENT_NEW':
        return `${type} — новый документ`
      case 'DICTIONARY':
        return context.entryId
          ? `${type} — запись №${String(context.entryId)}`
          : `${type} — справочник`
      case 'DICTIONARY_LIST':
        return `${type} — справочник`
      default:
        return t('aiAssistant.contextNone')
    }
  }

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
        {label()}
      </Typography>
    </div>
  )
}
