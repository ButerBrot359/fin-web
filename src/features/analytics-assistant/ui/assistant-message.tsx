import { Typography } from '@mui/material'

import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { AssistantResultCard } from './assistant-result-card'

interface AssistantMessageProps {
  message: AssistantChatMessage
  /** Куда вести из ошибки «не настроен доступ к ИИ». */
  settingsPath: string
  onShowPayload: (llmRequestId: number) => void
}

/**
 * Сообщение ленты. Реплика пользователя — короткая подложка справа, ответ
 * ассистента — карточка результата: это не переписка равных, а запрос и
 * построенное по нему представление.
 */
export const AssistantMessage = ({
  message,
  settingsPath,
  onShowPayload,
}: AssistantMessageProps) => {
  if (message.role === 'USER') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-ui-04 px-3 py-2">
          <Typography
            variant="body2"
            className="whitespace-pre-wrap text-ui-06"
          >
            {message.text}
          </Typography>
        </div>
      </div>
    )
  }

  return (
    <AssistantResultCard
      message={message}
      settingsPath={settingsPath}
      onShowPayload={onShowPayload}
    />
  )
}
