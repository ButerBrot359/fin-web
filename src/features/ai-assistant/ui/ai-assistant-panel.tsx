import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type {
  AiAssistantAction,
  AiAssistantCapability,
  AiAssistantContext,
} from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'
import { FLOATING_BOTTOM } from '@/shared/lib/utils/floating-widgets'
import { cn } from '@/shared/lib/utils/cn'

import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { useAssistantHistoryScroll } from '../lib/hooks/use-assistant-history-scroll'
import { AssistantMessageTimeline } from './assistant-message-timeline'
import { AssistantPendingStatus } from './assistant-pending-status'
import { AssistantComposer } from './assistant-composer'
import { AssistantContextBar } from './assistant-context-bar'
import { AssistantHelp } from './assistant-help'
import { AssistantPanelHeader } from './assistant-panel-header'
import { AssistantPresets } from './assistant-presets'

interface AiAssistantPanelProps {
  open: boolean
  minimized: boolean
  /** Увеличенный размер окна. Не полноэкранный: панель работает ПОВЕРХ формы. */
  enlarged: boolean
  /** Вместо ленты диалога показана справка. */
  helpOpen: boolean
  onToggleHelp: () => void
  onToggleSize: () => void
  context: AiAssistantContext
  /** Разрешения организации; `null` — ещё не загружены. */
  capabilities: AiAssistantCapability[] | null
  messages: AssistantChatMessage[]
  isPending: boolean
  pendingStartedAt?: number
  draft?: string
  onDraftChange?: (value: string) => void
  unavailableReason?: string
  onRetrySettings?: () => void
  historyLoading?: boolean
  historyError?: boolean
  onRetryHistory?: () => void
  hasOlderMessages?: boolean
  isLoadingOlder?: boolean
  olderMessagesError?: boolean
  onLoadOlder?: () => void
  onOpenHistory?: () => void
  onNewChat?: () => void
  newChatDisabled?: boolean
  onClose: () => void
  onToggleMinimize: () => void
  onSend: (question: string) => void
  onAction: (action: AiAssistantAction) => void
  /** Открыть документ, созданный помощником. */
  onOpenDocument: (typeCode: string, entryId: number) => void
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
  enlarged,
  helpOpen,
  onToggleHelp,
  onToggleSize,
  context,
  capabilities,
  messages,
  isPending,
  pendingStartedAt,
  draft,
  onDraftChange,
  unavailableReason,
  onRetrySettings,
  historyLoading = false,
  historyError = false,
  onRetryHistory,
  hasOlderMessages = false,
  isLoadingOlder = false,
  olderMessagesError = false,
  onLoadOlder,
  onClose,
  onOpenHistory,
  onNewChat,
  newChatDisabled,
  onToggleMinimize,
  onSend,
  onAction,
  onOpenDocument,
}: AiAssistantPanelProps) => {
  const { t, i18n } = useTranslation()
  const [localDraft, setLocalDraft] = useState('')
  const value = draft ?? localDraft
  const changeDraft = onDraftChange ?? setLocalDraft
  const sendDisabled =
    isPending || historyLoading || historyError || !!unavailableReason
  const messageIds = useMemo(
    () => messages.map((message) => message.id),
    [messages]
  )
  const { scrollRef, onScroll, loadOlder } = useAssistantHistoryScroll({
    active: open && !minimized && !helpOpen,
    messageIds,
    isPending,
    hasOlderMessages,
    isLoadingOlder,
    olderMessagesError,
    onLoadOlder,
  })

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed right-6 z-[1050] flex max-w-[92vw] flex-col',
        FLOATING_BOTTOM,
        'overflow-hidden rounded-2xl bg-ui-01 shadow-popup',
        // Увеличенный размер намеренно НЕ во весь экран: смысл панели в том, чтобы
        // под ней оставался виден документ, о котором идёт разговор.
        enlarged ? 'w-[42rem]' : 'w-[26rem]',
        minimized
          ? 'h-auto'
          : enlarged
            ? 'h-[min(50rem,88vh)]'
            : 'h-[min(38rem,75vh)]'
      )}
    >
      <AssistantPanelHeader
        minimized={minimized}
        enlarged={enlarged}
        helpOpen={helpOpen}
        onToggleHelp={onToggleHelp}
        onToggleSize={onToggleSize}
        onToggleMinimize={onToggleMinimize}
        onClose={onClose}
        onOpenHistory={onOpenHistory}
        onNewChat={onNewChat}
        newChatDisabled={newChatDisabled}
      />

      {!minimized && helpOpen && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-3">
          <AssistantHelp
            capabilities={capabilities}
            disabled={sendDisabled}
            onAsk={(question) => {
              onSend(question)
              // Возврат к ленте: ответ придёт туда, и оставаться в справке значило бы
              // ждать его на экране, где он не появится.
              onToggleHelp()
            }}
          />
        </div>
      )}

      {!minimized && !helpOpen && (
        <>
          <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
            <AssistantContextBar context={context} />
            {messages.length === 0 && !historyLoading && !historyError && (
              <AssistantPresets
                context={context}
                capabilities={capabilities}
                disabled={sendDisabled}
                onSelect={onSend}
              />
            )}
          </div>

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-3 pb-3"
          >
            {isLoadingOlder && (
              <Typography variant="body2" role="status" className="text-ui-05">
                {t('aiAssistant.historyLoading')}
              </Typography>
            )}
            {olderMessagesError && (
              <div>
                <Typography variant="body2">
                  {t('aiAssistant.historyLoadFailed')}
                </Typography>
                <Button
                  variant="tertiary"
                  disabled={isLoadingOlder}
                  onClick={loadOlder}
                >
                  {t('aiAssistant.historyRetry')}
                </Button>
              </div>
            )}
            {messages.length === 0 && !historyLoading && !historyError && (
              <Typography variant="body2" className="text-ui-05">
                {t('aiAssistant.empty')}
              </Typography>
            )}

            <AssistantMessageTimeline
              messages={messages}
              language={i18n.language}
              disabled={sendDisabled}
              onEditQuestion={changeDraft}
              onAction={onAction}
              onOpenDocument={onOpenDocument}
            />

            {isPending && pendingStartedAt != null && (
              <AssistantPendingStatus startedAt={pendingStartedAt} />
            )}
          </div>

          {historyLoading && (
            <Typography variant="body2" className="px-3 text-ui-05">
              {t('aiAssistant.historyLoading')}
            </Typography>
          )}
          {historyError && (
            <div className="px-3">
              <Typography variant="body2">
                {t('aiAssistant.historyLoadFailed')}
              </Typography>
              <Button variant="tertiary" onClick={onRetryHistory}>
                {t('aiAssistant.historyRetry')}
              </Button>
            </div>
          )}
          {unavailableReason && (
            <div className="px-3 py-2" role="status">
              <Typography variant="body2" className="text-ui-05">
                {unavailableReason}
              </Typography>
              {onRetrySettings && (
                <Button variant="tertiary" onClick={onRetrySettings}>
                  {t('aiAssistant.historyRetry')}
                </Button>
              )}
            </div>
          )}
          <AssistantComposer
            value={value}
            onChange={changeDraft}
            disabled={sendDisabled}
            onSend={onSend}
          />
        </>
      )}
    </div>
  )
}
