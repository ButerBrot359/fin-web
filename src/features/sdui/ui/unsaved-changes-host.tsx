import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { useUnsavedChangesStore } from '../lib/stores/unsaved-changes-store'

/**
 * Хост диалога «Сохранить изменения?» для эффекта `unsavedChanges` — пара к
 * `ConfirmDialogHost` (императивный мост через стор).
 *
 * Диалог — тот же shared-компонент, что показывает карточка документа при
 * закрытии изменённой вкладки: пользователь видит один и тот же вопрос,
 * из какой бы формы он ни закрывался, а тексты остаются в одном месте.
 */
export const UnsavedChangesHost = () => {
  const open = useUnsavedChangesStore((s) => s.open)
  const answer = useUnsavedChangesStore((s) => s.answer)

  return (
    <UnsavedChangesDialog
      open={open}
      onSave={() => {
        answer('save')
      }}
      onDiscard={() => {
        answer('discard')
      }}
      onCancel={() => {
        answer('cancel')
      }}
    />
  )
}
