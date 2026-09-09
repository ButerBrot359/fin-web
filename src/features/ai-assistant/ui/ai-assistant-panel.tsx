import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer, Typography } from '@mui/material'

import type {
  AiAssistantAction,
  AiAssistantContext,
} from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'

import { QUICK_QUESTION_KEYS } from '../lib/consts/quick-questions'
import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { AssistantAnswerCard } from './assistant-answer-card'
import { AssistantComposer } from './assistant-composer'
import { AssistantContextBar } from './assistant-context-bar'

interface AiAssistantPanelProps {
  open: boolean
  context: AiAssistantContext
  messages: AssistantChatMessage[]
  isPending: boolean
  onClose: () => void
  onSend: (question: string) => void
  onAction: (action: AiAssistantAction) => void
}

/**
 * Панель помощника — выезжает справа ПОВЕРХ формы.
 *
 * Поверх, а не врезкой в разметку: концепция прямо требует не сжимать и не
 * перестраивать типовую форму, потому что так внедрение не задевает
 * существующие экраны. Drawer справа это и даёт.
 *
 * Панель — колонка фиксированной высоты: контекст и быстрые команды сверху,
 * прокручиваемая история посередине, закреплённый ввод снизу. Прокрутка живёт
 * ровно в одном месте, иначе поле ввода уезжает вместе с длинным ответом.
 */
export const AiAssistantPanel = ({
  open,
  context,
  messages,
  isPending,
  onClose,
  onSend,
  onAction,
}: AiAssistantPanelProps) => {
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      // Плавную прокрутку отключаем для тех, кто просил меньше движения:
      // панель дёргается на каждом ответе, и это заметно сильнее, чем кажется.
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [messages.length, isPending])

  const hasDocument = context.kind === 'DOCUMENT' && Boolean(context.entryId)

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <div className="flex h-full w-[30rem] max-w-[92vw] flex-col bg-ui-02">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ui-03 bg-ui-01 px-4 py-3">
          <Typography variant="subtitle2" className="text-ui-06">
            {t('aiAssistant.title')}
          </Typography>
          <Button size="small" variant="tertiary" onClick={onClose}>
            {t('actions.close')}
          </Button>
        </div>

        <div className="flex shrink-0 flex-col gap-2 px-4 py-3">
          <AssistantContextBar context={context} />
          {hasDocument && messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTION_KEYS.map((key) => (
                <Button
                  key={key}
                  size="small"
                  variant="tertiary"
                  disabled={isPending}
                  onClick={() => {
                    onSend(t(key))
                  }}
                >
                  {t(key)}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
          {messages.length === 0 && (
            <Typography variant="body2" className="text-ui-05">
              {t('aiAssistant.empty')}
            </Typography>
          )}

          {messages.map((message) =>
            message.role === 'USER' ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-ui-04 px-3 py-2">
                  <Typography
                    variant="body2"
                    className="whitespace-pre-wrap text-ui-06"
                  >
                    {message.text}
                  </Typography>
                </div>
              </div>
            ) : message.error ? (
              <div
                key={message.id}
                className="rounded-lg bg-ui-01 p-3 outline outline-support-01"
              >
                <Typography variant="body2" className="text-ui-06">
                  {message.error}
                </Typography>
              </div>
            ) : message.answer ? (
              <AssistantAnswerCard
                key={message.id}
                answer={message.answer}
                onAction={(index) => {
                  const action = message.answer?.actions[index]
                  if (action) onAction(action)
                }}
              />
            ) : null
          )}

          {isPending && (
            <Typography variant="body2" className="text-ui-05">
              {t('aiAssistant.thinking')}
            </Typography>
          )}
          <div ref={bottomRef} />
        </div>

        <AssistantComposer disabled={isPending} onSend={onSend} />
      </div>
    </Drawer>
  )
}
