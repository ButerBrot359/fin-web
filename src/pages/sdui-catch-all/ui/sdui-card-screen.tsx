import type { FC } from 'react'

import { SduiScreen, useTreeStore } from '@/features/sdui'
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
  // Экран списка опознаётся по САМОМУ дереву (PAGE с узлом LIST), а не по kind вкладки:
  // kind у списков регистров и плана счетов совпадает с их же карточками (TabKind.REGISTER /
  // ACCOUNT_PLAN), то есть различить по нему нельзя. Шапка со списком нужна ради заголовка,
  // навигации и «Закрыть» — в 1С у формы списка всё это есть.
  const isListScreen = useTreeStore((s) =>
    (s.root?.children ?? []).some((child) => child.type === 'LIST')
  )

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      {(showCardChrome || isListScreen) && (
        <PageHeader title={pageTitle} onClose={handleClose} />
      )}
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
