import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type {
  AiAssistantAction,
  AiAssistantContext,
} from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'
import { cn } from '@/shared/lib/utils/cn'

import { QUICK_QUESTION_KEYS } from '../lib/consts/quick-questions'
import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { AssistantAnswerCard } from './assistant-answer-card'
import { AssistantComposer } from './assistant-composer'
import { AssistantContextBar } from './assistant-context-bar'

interface AiAssistantPanelProps {
  open: boolean
  minimized: boolean
  context: AiAssistantContext
  messages: AssistantChatMessage[]
  isPending: boolean
  onClose: () => void
  onToggleMinimize: () => void
  onSend: (question: string) => void
  onAction: (action: AiAssistantAction) => void
  historySlot?: React.ReactNode
}

/**
 * Панель помощника — плавающее окно, а НЕ модальный ящик.
 *
 * <p>Первая версия использовала MUI Drawer: он затемняет приложение подложкой и перехватывает
 * клики, то есть на время разговора работать было нельзя. Для помощника это неверно по сути —
 * он нужен как раз ПОВЕРХ работы, чтобы смотреть в документ и спрашивать о нём. Здесь обычный
 * `fixed`-контейнер: подложки нет, приложение под панелью остаётся кликабельным, прокрутка
 * страницы работает.
 *
 * <p>`z-[1050]` — тот же слой, что у кнопки поддержки, и НИЖЕ диалогов приложения
 * (`OVERLAY_Z_BASE` = 1300). Панель не должна перекрывать модальное окно, которое сама же
 * и могла открыть переходом к документу.
 *
 * <p>Свёрнутое состояние оставляет заголовок: разговор не теряется, а место освобождается.
 */
export const AiAssistantPanel = ({
  open,
  minimized,
  context,
  messages,
  isPending,
  onClose,
  onToggleMinimize,
  onSend,
  onAction,
  historySlot,
}: AiAssistantPanelProps) => {
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || minimized) return
    bottomRef.current?.scrollIntoView({
      // Плавную прокрутку отключаем для тех, кто просил меньше движения.
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [messages.length, isPending, open, minimized])

  if (!open) return null

  const hasDocument =
    context.kind !== 'NONE' && context.kind !== 'DICTIONARY_LIST'

  return (
    <div
      className={cn(
        'fixed right-6 bottom-6 z-[1050] flex w-[26rem] max-w-[92vw] flex-col',
        'overflow-hidden rounded-2xl bg-ui-01 shadow-popup',
        minimized ? 'h-auto' : 'h-[min(38rem,75vh)]'
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ui-03 px-3 py-2">
        <Typography variant="subtitle2" className="min-w-0 truncate text-ui-06">
          {t('aiAssistant.title')}
        </Typography>
        <div className="flex shrink-0 items-center gap-0.5">
          {historySlot}
          <Button size="small" variant="tertiary" onClick={onToggleMinimize}>
            {t(minimized ? 'aiAssistant.expand' : 'aiAssistant.minimize')}
          </Button>
          <Button size="small" variant="tertiary" onClick={onClose}>
            {t('actions.close')}
          </Button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
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

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-3 pb-3">
            {messages.length === 0 && (
              <Typography variant="body2" className="text-ui-05">
                {t('aiAssistant.empty')}
              </Typography>
            )}

            {messages.map((message) =>
              message.role === 'USER' ? (
                <div key={message.id} className="flex min-w-0 justify-end">
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
                  <Typography
                    variant="body2"
                    className="break-words text-ui-06"
                  >
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
              ) : (
                <div
                  key={message.id}
                  className="min-w-0 rounded-lg bg-ui-02 p-3"
                >
                  <Typography
                    variant="body2"
                    className="break-words whitespace-pre-wrap text-ui-06"
                  >
                    {message.text}
                  </Typography>
                </div>
              )
            )}

            {isPending && (
              <Typography variant="body2" className="text-ui-05">
                {t('aiAssistant.thinking')}
              </Typography>
            )}
            <div ref={bottomRef} />
          </div>

          <AssistantComposer disabled={isPending} onSend={onSend} />
        </>
      )}
    </div>
  )
}
