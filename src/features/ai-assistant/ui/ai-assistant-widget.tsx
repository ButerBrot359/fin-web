import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import {
  useConfirmAssistantAction,
  type AiAssistantAction,
} from '@/entities/ai-assistant'
import { showToast } from '@/shared/ui/toast/show-toast'

import { useAssistantSession } from '../lib/hooks/use-assistant-session'
import { useFormContext } from '../lib/hooks/use-form-context'
import { AiAssistantFab } from './ai-assistant-fab'
import { AiAssistantPanel } from './ai-assistant-panel'

/**
 * Корень контура помощника: кнопка, панель и обработка предложенных действий.
 *
 * Монтируется один раз в макете и доступен с любой страницы — концепция требует
 * постоянного доступа из документов, отчётов и справочников.
 *
 * Действия разделены по последствиям. Навигационные выполняются сразу: они
 * ничего не меняют. `CREATE_DOCUMENT` уходит отдельным подтверждённым вызовом —
 * критерий приёмки требует, чтобы создание было невозможно без явного согласия
 * человека, и нажатие на кнопку с ценой действия в подписи и есть это согласие.
 */
export const AiAssistantWidget = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const context = useFormContext()
  const session = useAssistantSession(context)
  const confirmAction = useConfirmAssistantAction()
  const navigate = useNavigate()
  const { pageCode } = useParams<{ pageCode: string }>()

  const handleAction = (action: AiAssistantAction) => {
    if (action.kind === 'OPEN_DOCUMENT' && action.typeCode && action.entryId) {
      void navigate(
        `/modules/${pageCode ?? 'Main'}/document/${action.typeCode}/${String(action.entryId)}`
      )
      setOpen(false)
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
            void navigate(
              `/modules/${pageCode ?? 'Main'}/document/${created.typeCode}/${String(created.entryId)}`
            )
            setOpen(false)
          },
          onError: () => {
            showToast('error', t('aiAssistant.createFailed'))
          },
        }
      )
      return
    }

    // SHOW_ROWS ведёт к строкам уже открытого документа: панель не закрываем,
    // человек читает расшифровку рядом с таблицей.
  }

  return (
    <>
      {!open && (
        <AiAssistantFab
          onClick={() => {
            setOpen(true)
          }}
        />
      )}
      <AiAssistantPanel
        open={open}
        context={context}
        messages={session.messages}
        isPending={session.isPending || confirmAction.isPending}
        onClose={() => {
          setOpen(false)
        }}
        onSend={session.send}
        onAction={handleAction}
      />
    </>
  )
}
