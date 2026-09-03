import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/shared/ui/confirm-dialog/confirm-dialog'

import { useConfirmStore } from '../lib/stores/confirm-store'

/**
 * Хост диалога подтверждения для императивного моста confirm-store
 * (SCRUM-244). Рендер — общий ConfirmDialog дизайн-системы (Figma «Pop-Up»
 * 150:3758: заголовок H2 + крестик, primary слева) вместо сырого MUI с
 * обратным порядком кнопок.
 */
export const ConfirmDialogHost = () => {
  const { t } = useTranslation()
  const open = useConfirmStore((s) => s.open)
  const message = useConfirmStore((s) => s.message)
  const answer = useConfirmStore((s) => s.answer)

  return (
    <ConfirmDialog
      open={open}
      title={t('sdui.confirm.title')}
      message={message}
      confirmLabel={t('sdui.confirm.ok')}
      cancelLabel={t('sdui.confirm.cancel')}
      onConfirm={() => {
        answer(true)
      }}
      onCancel={() => {
        answer(false)
      }}
    />
  )
}
