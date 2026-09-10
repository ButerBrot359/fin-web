import {
  AI_WIDGET_NEW_CHAT_EVENT,
  AI_WIDGET_OPEN_EVENT,
} from '@/shared/lib/widgets/widget-launchers'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import {
  useAiAssistantSettings,
  useConfirmAssistantAction,
  type AiAssistantAction,
  type AiAssistantAnswer,
} from '@/entities/ai-assistant'
import { showToast } from '@/shared/ui/toast/show-toast'

import { useAssistantPrint } from '../lib/hooks/use-assistant-print'
import { useRestoredAssistantSession } from '../lib/hooks/use-restored-assistant-session'
import { useFormContext } from '../lib/hooks/use-form-context'
import { AiAssistantFab } from './ai-assistant-fab'
import { AiAssistantPanel } from './ai-assistant-panel'

/**
 * Адрес карточки документа.
 *
 * Раздел берётся из адреса текущей страницы: помощник живёт в макете и открывается
 * откуда угодно, а `Main` — запасной вариант для страниц вне разделов.
 */
const documentPath = (
  pageCode: string | undefined,
  typeCode: string,
  entryId: number
): string =>
  `/modules/${pageCode ?? 'Main'}/document/${typeCode}/${String(entryId)}`

/**
 * Корень контура помощника: кнопка, панель, восстановление переписки и обработка действий.
 *
 * <p>Монтируется один раз в макете и доступен с любой страницы — концепция требует
 * постоянного доступа из документов, отчётов и справочников.
 *
 * <p>Переписка восстанавливается с сервера по текущему объекту. Диалоги сохранялись и
 * раньше, но наружу не отдавались, и панель начинала с чистого листа при каждом открытии:
 * человек не станет заново описывать ситуацию, чтобы задать второй вопрос.
 */
export const AiAssistantWidget = () => {
  const { t } = useTranslation()
  const [chatVersion, setChatVersion] = useState(0)
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => {
    const openWidget = () => {
      setOpen(true)
      setMinimized(false)
      setHelpOpen(false)
    }
    window.addEventListener(AI_WIDGET_OPEN_EVENT, openWidget)
    return () => {
      window.removeEventListener(AI_WIDGET_OPEN_EVENT, openWidget)
    }
  }, [])
  const context = useFormContext()
  const confirmAction = useConfirmAssistantAction()
  const printDocument = useAssistantPrint()
  const navigate = useNavigate()
  const { pageCode } = useParams<{ pageCode: string }>()

  const openDocument = useCallback(
    (typeCode: string, entryId: number) => {
      // Панель не закрываем: помощник затем и нужен, чтобы смотреть в документ
      // и продолжать спрашивать о нём.
      void navigate(documentPath(pageCode, typeCode, entryId))
    },
    [navigate, pageCode]
  )

  /** Результат мутации открывается для проверки пользователем. */
  const openAffectedDocument = useCallback(
    (answer: AiAssistantAnswer) => {
      // Индексом, а не optional chaining: при выключенном noUncheckedIndexedAccess
      // TypeScript считает элемент всегда заданным, и линтер называет проверку лишней.
      if (answer.created.length === 0) return
      const created = answer.created[0]
      showToast(
        'success',
        t('aiAssistant.actionCompleted'),
        created.presentation
      )
      if (
        context.kind !== 'DOCUMENT' ||
        context.typeCode !== created.typeCode ||
        context.entryId !== created.entryId
      ) {
        openDocument(created.typeCode, created.entryId)
      }
    },
    [openDocument, t, context.kind, context.typeCode, context.entryId]
  )

  const session = useRestoredAssistantSession(
    context,
    open,
    openAffectedDocument
  )

  const newChatDisabled =
    session.isPending || confirmAction.isPending || printDocument.isPending
  const startNewChat = session.startNewChat
  const handleNewChat = useCallback(() => {
    setOpen(true)
    setMinimized(false)
    setHelpOpen(false)
    if (!newChatDisabled) {
      startNewChat()
      setChatVersion((current) => current + 1)
    }
  }, [newChatDisabled, startNewChat])

  useEffect(() => {
    window.addEventListener(AI_WIDGET_NEW_CHAT_EVENT, handleNewChat)
    return () => {
      window.removeEventListener(AI_WIDGET_NEW_CHAT_EVENT, handleNewChat)
    }
  }, [handleNewChat])

  // Разрешения нужны, чтобы не предлагать заготовку, которую сервер отклонит, и
  // чтобы справка называла выключенное выключенным. Тоже только при открытой панели.
  const { settings } = useAiAssistantSettings(open)
  const capabilities = settings?.capabilities ?? null

  const handleAction = (action: AiAssistantAction) => {
    if (session.isPending || confirmAction.isPending || printDocument.isPending)
      return
    if (action.error) return
    if (
      (action.kind === 'PRINT_DOCUMENT' || action.kind === 'CREATE_DOCUMENT') &&
      (!settings?.enabled || !capabilities?.includes(action.kind))
    ) {
      showToast('error', t('aiAssistant.actionUnavailable'))
      return
    }
    if (action.kind === 'SHOW_ROWS' && action.tableCode) {
      session.send(t('aiAssistant.showRowsPrompt', { table: action.tableCode }))
      return
    }
    if (action.kind === 'OPEN_DOCUMENT' && action.typeCode && action.entryId) {
      openDocument(action.typeCode, action.entryId)
      return
    }

    if (action.kind === 'PRINT_DOCUMENT' && action.typeCode && action.entryId) {
      printDocument.mutate(
        { typeCode: action.typeCode, entryId: action.entryId },
        {
          onError: () => {
            showToast('error', t('aiAssistant.printFailed'))
          },
        }
      )
      return
    }

    if (action.kind === 'CREATE_DOCUMENT' && action.typeCode) {
      confirmAction.mutate(
        {
          kind: 'CREATE_DOCUMENT',
          typeCode: action.typeCode,
          attributes: action.attributes ?? {},
        },
        {
          onSuccess: (created) => {
            showToast('success', t('aiAssistant.created'), created.presentation)
            openDocument(created.typeCode, created.entryId)
          },
          onError: () => {
            showToast('error', t('aiAssistant.createFailed'))
          },
        }
      )
      return
    }
    showToast('error', t('aiAssistant.actionUnavailable'))
  }

  return (
    <>
      {!open && (
        <AiAssistantFab
          onClick={() => {
            setOpen(true)
            setMinimized(false)
          }}
        />
      )}
      <AiAssistantPanel
        key={chatVersion}
        open={open}
        minimized={minimized}
        enlarged={enlarged}
        helpOpen={helpOpen}
        onToggleHelp={() => {
          setHelpOpen((current) => !current)
        }}
        onToggleSize={() => {
          setEnlarged((current) => !current)
        }}
        context={context}
        capabilities={capabilities}
        messages={session.messages}
        historyLoading={session.historyLoading}
        historyError={session.historyError}
        onRetryHistory={session.retryHistory}
        hasOlderMessages={session.hasOlderMessages}
        isLoadingOlder={session.isLoadingOlder}
        olderMessagesError={session.olderMessagesError}
        onLoadOlder={session.loadOlder}
        isPending={
          session.isPending ||
          confirmAction.isPending ||
          printDocument.isPending
        }
        onNewChat={handleNewChat}
        newChatDisabled={newChatDisabled}
        onOpenHistory={() => {
          setOpen(false)
          const query =
            session.conversationId != null
              ? `?conversationId=${String(session.conversationId)}`
              : ''
          void navigate(`/modules/${pageCode ?? 'Main'}/ai-history${query}`)
        }}
        onClose={() => {
          setOpen(false)
          // Следующее открытие — снова диалог: кнопка внизу экрана обещает помощника,
          // а не справку, на которой его закрыли.
          setHelpOpen(false)
        }}
        onToggleMinimize={() => {
          setMinimized((current) => !current)
        }}
        onSend={session.send}
        onAction={handleAction}
        onOpenDocument={openDocument}
      />
    </>
  )
}
