import { type FC } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import {
  SduiScreen,
  useViewStateStore,
  useTreeStore,
  useSduiDispatch,
} from '@/features/sdui'
import {
  useWorkspaceTabsStore,
  useFormCacheStore,
} from '@/features/workspace-tabs'

import { PageHeader } from '@/widgets/page-header'

import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { getDocumentListPath } from '../lib/utils/get-document-paths'
import { useUnsavedChangesDialog } from '../lib/hooks/use-unsaved-changes-dialog'

interface SduiDocumentPageProps {
  moduleCode: string
}

export const SduiDocumentPage: FC<SduiDocumentPageProps> = ({ moduleCode }) => {
  const { pageCode = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useSduiDispatch()

  const dirty = useViewStateStore((s) => s.dirty)
  const baseTitle =
    (useTreeStore((s) => s.root?.props?.title) as string | undefined) ?? ''
  const pageTitle = dirty ? `${baseTitle} *` : baseTitle

  const listPath = getDocumentListPath({ pageCode, moduleCode })

  const closeCurrentTab = () => {
    useFormCacheStore.getState().removeTab(location.pathname)
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
  }

  const unsavedDialog = useUnsavedChangesDialog({
    onSave: () => {
      void dispatch({ type: 'COMMAND', command: 'save' }).then(() => {
        closeCurrentTab()
        void navigate(listPath)
      })
    },
    onDiscard: () => {
      closeCurrentTab()
      void navigate(listPath)
    },
  })

  const handleClose = () => {
    if (dirty) {
      unsavedDialog.open()
    } else {
      closeCurrentTab()
      void navigate(listPath)
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />
      <SduiScreen layoutCode={`${moduleCode}.ФормаОбъекта`} />
      <UnsavedChangesDialog
        open={unsavedDialog.isOpen}
        onSave={unsavedDialog.handleSave}
        onDiscard={unsavedDialog.handleDiscard}
        onCancel={unsavedDialog.handleCancel}
      />
    </div>
  )
}
