import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  AssistantChat,
  AssistantComposer,
  LlmPayloadDialog,
  SaveItemDialog,
  useAssistantSession,
} from '@/features/analytics-assistant'
import type { SaveItemValues } from '@/features/analytics-assistant'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { Button } from '@/shared/ui/buttons'
// Код служебной страницы настроек — один на весь раздел (см. диспетчер).
import { ANALYTICS_SETTINGS_CODE } from '@/pages/analytics/analytics-router/lib/consts/reserved-codes'

import { useSaveCurrentSpec } from '../lib/hooks/use-save-current-spec'
import { AssistantPreview } from './assistant-preview'

/**
 * ИИ-ассистент аналитики: слева диалог, справа живой предпросмотр построенного
 * представления. Ассистент возвращает спецификацию — страница её отрисовывает,
 * кода никто не меняет.
 */
export const AnalyticsAssistantPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '' } = useParams()

  useTabMeta(t('analytics.assistant.title'))

  const session = useAssistantSession()
  const [prompt, setPrompt] = useState('')
  const [payloadId, setPayloadId] = useState<number | null>(null)
  const [isSaveOpen, setIsSaveOpen] = useState(false)

  const lastPrompt =
    [...session.messages].reverse().find((m) => m.role === 'USER')?.text ?? null

  const { save, isPending: isSaving } = useSaveCurrentSpec(
    session.currentSpec,
    lastPrompt
  )

  const settingsPath = pageCode
    ? `/modules/${pageCode}/analytics/${ANALYTICS_SETTINGS_CODE}`
    : `/analytics/${ANALYTICS_SETTINGS_CODE}`

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate('/')
  }

  const handleSend = () => {
    session.send(prompt)
    setPrompt('')
  }

  const handleSave = (values: SaveItemValues) => {
    save(values, () => {
      setIsSaveOpen(false)
    })
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader
        title={t('analytics.assistant.title')}
        onClose={handleClose}
      />

      <div className="flex min-h-0 flex-1 gap-5">
        <div className="flex min-h-0 w-[420px] min-w-80 flex-col gap-3">
          <AssistantChat
            messages={session.messages}
            isPending={session.isPending}
            settingsPath={settingsPath}
            onExampleClick={setPrompt}
            onShowPayload={setPayloadId}
          />
          <AssistantComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSend}
            kind={session.kind}
            onKindChange={session.setKind}
            isPending={session.isPending}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="small"
              variant="tertiary"
              disabled={session.isPending || session.messages.length === 0}
              onClick={session.reset}
            >
              {t('analytics.assistant.newChat')}
            </Button>
            <Button
              size="small"
              variant="primary"
              disabled={session.currentSpec == null}
              onClick={() => {
                setIsSaveOpen(true)
              }}
            >
              {t('analytics.assistant.save')}
            </Button>
          </div>

          {/*
            Холст на тонированной подложке — как у сохранённых дашборда и
            отчёта: виджеты внутри белые и без рамок, отделяет их контраст с
            фоном. Своей рамки у холста нет по той же причине.
          */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-ui-02 pr-1">
            <AssistantPreview
              spec={session.currentSpec}
              isPending={session.isPending}
            />
          </div>
        </div>
      </div>

      <LlmPayloadDialog
        open={payloadId != null}
        llmRequestId={payloadId}
        onClose={() => {
          setPayloadId(null)
        }}
      />

      <SaveItemDialog
        open={isSaveOpen}
        defaultTitle={session.currentSpec?.title ?? ''}
        isPending={isSaving}
        onClose={() => {
          setIsSaveOpen(false)
        }}
        onSave={handleSave}
      />
    </div>
  )
}
