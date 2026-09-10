import { Fragment, useMemo } from 'react'
import { Typography } from '@mui/material'
import type { AiAssistantAction } from '@/entities/ai-assistant'
import { cn } from '@/shared/lib/utils/cn'
import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { buildAssistantMessageTimeline } from '../lib/message-time'
import { AssistantAnswerCard } from './assistant-answer-card'
import {
  assistantMessageCopyText,
  failedQuestionFor,
} from '../lib/message-copy'
import { AssistantMessageTools } from './assistant-message-tools'

/** Shared message rendering for the live assistant and saved conversation history. */
export function AssistantMessageTimeline({
  messages,
  language,
  disabled,
  onAction,
  onOpenDocument,
  onEditQuestion,
}: {
  messages: AssistantChatMessage[]
  language: string
  disabled: boolean
  onAction?: (action: AiAssistantAction) => void
  onOpenDocument: (typeCode: string, entryId: number) => void
  onEditQuestion?: (question: string) => void
}) {
  const timeline = useMemo(
    () => buildAssistantMessageTimeline(messages, language),
    [messages, language]
  )
  return (
    <>
      {timeline.map(({ message, timestamp, startsDay }, index) => (
        <Fragment key={message.id}>
          {startsDay && timestamp && (
            <div
              role="separator"
              aria-label={timestamp.dayLabel}
              className="flex justify-center py-1 text-xs text-ui-05"
            >
              <time dateTime={timestamp.dayKey}>{timestamp.dayLabel}</time>
            </div>
          )}
          <div data-assistant-message-id={message.id} className="min-w-0">
            {message.role === 'USER' ? (
              <div className="flex min-w-0 justify-end">
                <div className="min-w-0 max-w-[85%] rounded-lg bg-ui-04 px-3 py-2">
                  <Typography
                    variant="body2"
                    className="break-words whitespace-pre-wrap text-ui-06"
                  >
                    {message.text}
                  </Typography>
                </div>
              </div>
            ) : message.error ? (
              <div
                key={message.id}
                className="min-w-0 rounded-lg bg-ui-02 p-3 outline outline-support-01"
              >
                <Typography variant="body2" className="break-words text-ui-06">
                  {message.error}
                </Typography>
              </div>
            ) : message.answer ? (
              <AssistantAnswerCard
                key={message.id}
                answer={message.answer}
                disabled={disabled}
                onOpenDocument={onOpenDocument}
                onAction={(index) => {
                  const action = message.answer?.actions[index]
                  if (action) onAction?.(action)
                }}
              />
            ) : (
              <div key={message.id} className="min-w-0 rounded-lg bg-ui-02 p-3">
                <Typography
                  variant="body2"
                  className="break-words whitespace-pre-wrap text-ui-06"
                >
                  {message.text}
                </Typography>
              </div>
            )}
            {timestamp && (
              <time
                dateTime={timestamp.dateTime}
                title={timestamp.title}
                className={cn(
                  'mt-1 block text-[11px] leading-4 text-ui-05',
                  message.role === 'USER' ? 'text-right' : 'text-left'
                )}
              >
                {timestamp.time}
              </time>
            )}
            <AssistantMessageTools
              text={assistantMessageCopyText(message)}
              failedQuestion={failedQuestionFor(messages, index)}
              onEditQuestion={onEditQuestion}
            />
          </div>
        </Fragment>
      ))}
    </>
  )
}
