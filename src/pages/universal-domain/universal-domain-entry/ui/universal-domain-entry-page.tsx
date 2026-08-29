import { useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import {
  SduiScreen,
  useSduiDispatch,
  useTreeStore,
  useViewStateStore,
} from '@/features/sdui'
import {
  useFormCacheStore,
  useTabMeta,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { useUnsavedChangesDialog } from '@/pages/documents/documents-entry/lib/hooks/use-unsaved-changes-dialog'
import { useUniversalDomainType } from '../../universal-domain-list'

/**
 * SDUI-карточка записи универсального домена (SCRUM-388, ADR-0048 Tier R):
 * CALCULATION_PLAN «Виды начислений/удержаний организации» и будущие домены
 * без выделенной страницы. Маршрут — модульный, той же формы, что список
 * (`…/calculationplan/:moduleCode/:entryId?domain=…`): бэк резолвит его в
 * OPEN напрямую, отдельный плоский route не нужен.
 *
 * <p>КАРТОЧКА РЕДАКТИРУЕМАЯ (правки ПВР, 29.08.2026). Изначально домен был
 * read-only, и обвязки записи здесь не было вовсе. Теперь сервер сам отдаёт
 * тулбар `page.{TypeCode}.toolbar` с командами `dict.saveAndClose` / `dict.save`
 * и editable-поля — поэтому хосту нужно то же, что у карточки справочника:
 * пометка «грязной» вкладки, отложенное «Записать и закрыть» из панели вкладок,
 * закрытие вкладки ПОСЛЕ подтверждённой записи и диалог несохранённых правок.
 * Своих кнопок записи хост не рисует: их источник — серверный тулбар, вторая
 * пара кнопок сохраняла бы мимо SDUI-сессии.
 *
 * <p>Неуспех команды (`commandFailed: true`) закрытием и сбросом dirty не
 * оборачивается — это гарантирует общий dispatch (`features/sdui/lib/dispatch`),
 * который в таком случае не зовёт `closeAfter`/`resetDirty`.
 *
 * <p>Легаси-фолбэка у универсального домена нет: пока бэк-гейт выключен
 * (`sdui.object-form.enabled-domains` пуст / new_view=false) или OPEN отвечает
 * 422 — показываем нейтральное сообщение, не белый экран.
 */
export const UniversalDomainEntryPage = () => {
  const { pageCode = '', moduleCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'CALCULATION_PLAN'
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()

  const {
    title: typeTitle,
    newView,
    isLoading,
  } = useUniversalDomainType(domain, moduleCode)
  const [sduiFailed, setSduiFailed] = useState(false)

  const dirty = useViewStateStore((s) => s.dirty)
  const [tabTitle, setTabTitle] = useState('')
  const baseTitle = tabTitle || typeTitle
  useTabMeta(baseTitle)

  const listPath = `/modules/${pageCode}/calculationplan/${moduleCode}?domain=${domain}`

  const closeCurrentTab = () => {
    useFormCacheStore.getState().removeTab(location.pathname)
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
  }

  const unsavedDialog = useUnsavedChangesDialog({
    onSave: () => {
      // Команда записи и её поведение — из серверного дескриптора onDirtyClose
      // (SCRUM-283 §4.6), своей команды хост не придумывает.
      const desc = useTreeStore.getState().onDirtyClose
      if (!desc?.command) return
      void dispatch({ type: 'COMMAND', command: desc.command }, desc.behavior)
    },
    onDiscard: () => {
      closeCurrentTab()
      void navigate(listPath)
    },
  })

  const handleClose = () => {
    if (dirty) {
      unsavedDialog.open()
      return
    }
    closeCurrentTab()
    void navigate(listPath)
  }

  const screenApi = useMemo(
    () => ({
      shouldPersistSession: (route: string) =>
        useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === route),
      onDirtyChange: (route: string, isDirty: boolean) => {
        useFormCacheStore.getState().setDirty(route, isDirty)
      },
      consumePendingAction: (route: string) =>
        useFormCacheStore.getState().consumePendingAction(route),
      onCloseAfter: (route: string) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
      },
      onSavedAndClosed: (route: string) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        void navigate(listPath)
      },
      onOpenFailed: () => {
        setSduiFailed(true)
      },
    }),
    [navigate, listPath]
  )

  if (isLoading) return <PageSkeleton />

  if (!newView || sduiFailed) {
    return (
      <div className="flex h-full flex-col gap-5 pt-5">
        <PageHeader title={typeTitle} onClose={handleClose} />
        <Typography variant="body2" className="text-ui-03">
          {t('universalDomain.cardUnavailable')}
        </Typography>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader
        title={dirty ? `${baseTitle} *` : baseTitle}
        onClose={handleClose}
      />
      <SduiScreen {...screenApi} onTitleChange={setTabTitle} />
      <UnsavedChangesDialog
        open={unsavedDialog.isOpen}
        onSave={unsavedDialog.handleSave}
        onDiscard={unsavedDialog.handleDiscard}
        onCancel={unsavedDialog.handleCancel}
      />
    </div>
  )
}
