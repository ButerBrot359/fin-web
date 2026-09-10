import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import {
  useAiAssistantSettings,
  useAiConversationMessages,
  useAiConversations,
  useConfirmAssistantAction,
  type AiAssistantAction,
  type AiAssistantAnswer,
} from '@/entities/ai-assistant'
import { showToast } from '@/shared/ui/toast/show-toast'

import {
  useAssistantSession,
  type AssistantChatMessage,
} from '../lib/hooks/use-assistant-session'
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
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const context = useFormContext()
  const confirmAction = useConfirmAssistantAction()
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

  /**
   * Созданный документ открывается сразу, без нажатия.
   *
   * <p>Помощник создаёт документ сам, в ответе; раньше о нём сообщала только строка
   * «Создано помощником», и человек шёл искать документ в списке — то есть повторял
   * руками ровно ту работу, ради которой звал помощника.
   *
   * <p>Уведомление обязательно: страница меняется не от нажатия, и без подписи это
   * читается как сбой, а не как результат.
   */
  const openCreatedDocument = useCallback(
    (answer: AiAssistantAnswer) => {
      // Индексом, а не optional chaining: при выключенном noUncheckedIndexedAccess
      // TypeScript считает элемент всегда заданным, и линтер называет проверку лишней.
      if (answer.created.length === 0) return
      const created = answer.created[0]
      showToast('success', t('aiAssistant.created'), created.presentation)
      openDocument(created.typeCode, created.entryId)
    },
    [openDocument, t]
  )

  const session = useAssistantSession(context, openCreatedDocument)

  // Разрешения нужны, чтобы не предлагать заготовку, которую сервер отклонит, и
  // чтобы справка называла выключенное выключенным. Тоже только при открытой панели.
  const { settings } = useAiAssistantSettings(open)
  const capabilities = settings?.capabilities ?? null

  // Диалог по этому объекту тянем только при открытой панели: закрытый помощник
  // не повод дёргать сервер на каждой смене страницы.
  const { conversations } = useAiConversations(
    { typeCode: context.typeCode, entryId: context.entryId },
    open
  )
  // Индексом, а не optional chaining: при выключенном noUncheckedIndexedAccess
  // TypeScript считает элемент всегда заданным, и линтер справедливо называет
  // проверку лишней. Длина массива — единственный честный признак.
  const restoredId = conversations.length > 0 ? conversations[0].id : null
  const { messages: storedMessages } = useAiConversationMessages(
    open && session.isEmpty ? restoredId : null
  )

  // Восстановление в рендере, а не в эффекте: линтер проекта запрещает setState
  // в эффекте, и лишний проход показал бы пустую ленту поверх уже полученной.
  if (
    open &&
    session.isEmpty &&
    restoredId != null &&
    storedMessages.length > 0
  ) {
    session.restore(
      restoredId,
      storedMessages
        // Роль TOOL — что помощник прочитал из базы. В журнале она нужна, в ленте
        // диалога это шум: человек перечитывает разговор, а не протокол чтений.
        .filter((message) => message.role !== 'TOOL')
        .map<AssistantChatMessage>((message) => ({
          id: `stored-${String(message.id)}`,
          role: message.role === 'USER' ? 'USER' : 'ASSISTANT',
          text: message.content,
        }))
    )
  }

  const handleAction = (action: AiAssistantAction) => {
    if (action.kind === 'OPEN_DOCUMENT' && action.typeCode && action.entryId) {
      openDocument(action.typeCode, action.entryId)
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
    }
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
        isPending={session.isPending || confirmAction.isPending}
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
