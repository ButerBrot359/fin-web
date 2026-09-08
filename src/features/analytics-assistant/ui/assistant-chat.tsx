import { useEffect, useRef } from 'react'

import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { useGenerationStage } from '../lib/hooks/use-generation-stage'
import { AssistantEmptyState } from './assistant-empty-state'
import { AssistantMessage } from './assistant-message'
import { AssistantStages } from './assistant-stages'

interface AssistantChatProps {
  messages: AssistantChatMessage[]
  isPending: boolean
  settingsPath: string
  /** Клик по примеру — подставляет текст в поле ввода. */
  onExampleClick: (text: string) => void
  onShowPayload: (llmRequestId: number) => void
}

/** Плавная прокрутка — только если система не просила ограничить движение. */
const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'

/** Лента диалога: пустое состояние, сообщения и этапы текущей генерации. */
export const AssistantChat = ({
  messages,
  isPending,
  settingsPath,
  onExampleClick,
  onShowPayload,
}: AssistantChatProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const stage = useGenerationStage(isPending)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: scrollBehavior(),
      block: 'end',
    })
  }, [messages.length, isPending])

  const isEmpty = messages.length === 0 && !isPending

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {isEmpty && <AssistantEmptyState onExampleClick={onExampleClick} />}

      {messages.map((message) => (
        <AssistantMessage
          key={message.id}
          message={message}
          settingsPath={settingsPath}
          onShowPayload={onShowPayload}
        />
      ))}

      {isPending && <AssistantStages stage={stage} />}

      <div ref={bottomRef} />
    </div>
  )
}
