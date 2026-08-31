import type { FC } from 'react'

import { SduiScreen } from '@/features/sdui'
import type { ViewTabMeta } from '@/features/sdui'

import { PageHeader } from '@/widgets/page-header'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { useSduiCardBinding } from '../lib/hooks/use-sdui-card-binding'

interface SduiCardScreenProps {
  // Показывать карточную обвязку (PageHeader + диалог несохранённых) — по
  // serverKind ∈ CARD_KINDS со стороны catch-all. SduiScreen рендерится
  // БЕЗУСЛОВНО и держит одну и ту же позицию в дереве при смене этого флага
  // (условны только соседние элементы), чтобы список → карточка не приводил
  // к повторному OPEN (инвариант «SduiScreen монтируется один раз», SCRUM-360 этап B).
  showCardChrome: boolean
  onTab?: (tab: ViewTabMeta | null) => void
  onOpenFailed?: (info?: { kind?: string }) => void
  onRouteUnknown?: () => void
}

export const SduiCardScreen: FC<SduiCardScreenProps> = ({
  showCardChrome,
  onTab,
  onOpenFailed,
  onRouteUnknown,
}) => {
  const { tabsApi, pageTitle, unsavedDialog, handleClose } =
    useSduiCardBinding()

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      {showCardChrome && <PageHeader title={pageTitle} onClose={handleClose} />}
      <SduiScreen
        {...tabsApi}
        onTab={onTab}
        onOpenFailed={onOpenFailed}
        onRouteUnknown={onRouteUnknown}
      />
      {showCardChrome && (
        <UnsavedChangesDialog
          open={unsavedDialog.isOpen}
          onSave={unsavedDialog.handleSave}
          onDiscard={unsavedDialog.handleDiscard}
          onCancel={unsavedDialog.handleCancel}
        />
      )}
    </div>
  )
}
