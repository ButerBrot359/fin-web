import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

/** Какое действие ждёт подтверждения (SCRUM-400 §11.6 п.5–6). */
export type PendingAction = 'apply' | 'rollback' | 'off'

/** Тексты по виду действия — одна карта вместо параллельных тернарников. */
const TEXT_KEYS = {
  apply: {
    title: 'accessPolicy.switch.confirmTitle',
    message: 'accessPolicy.switch.confirmMessage',
    confirm: 'accessPolicy.switch.apply',
  },
  rollback: {
    title: 'accessPolicy.switch.confirmRollbackTitle',
    message: 'accessPolicy.switch.confirmRollbackMessage',
    confirm: 'accessPolicy.switch.rollback',
  },
  off: {
    title: 'accessPolicy.switch.confirmOffTitle',
    message: 'accessPolicy.switch.confirmOffMessage',
    confirm: 'accessPolicy.switch.emergencyOff',
  },
  // as const: типизированные ключи i18n требуют литеральных типов
} as const satisfies Record<
  PendingAction,
  { title: string; message: string; confirm: string }
>

/**
 * Подтверждение смены режима прав: режим меняется для всех пользователей
 * сразу, поэтому «Применить»/«Откатить»/«Выключить» идут через явный вопрос;
 * переход в ENFORCE — с отдельным предупреждением (§11.6 п.5).
 */
export const PolicyConfirmDialog: FC<{
  pending: PendingAction | null
  /** Применяется режим ENFORCE — показать предупреждение о пропаже кнопок/меню. */
  enforceWarning: boolean
  onCancel: () => void
  onConfirm: () => void
}> = ({ pending, enforceWarning, onCancel, onConfirm }) => {
  const { t } = useTranslation()
  const keys = pending ? TEXT_KEYS[pending] : TEXT_KEYS.apply

  return (
    <Dialog open={pending !== null} onClose={onCancel}>
      <div className="flex max-w-[480px] flex-col gap-4 p-6">
        <Typography component="h2" fontSize={18} fontWeight={700}>
          {t(keys.title)}
        </Typography>
        <Typography variant="body2">{t(keys.message)}</Typography>
        {pending === 'apply' && enforceWarning && (
          <Typography variant="body2" color="error">
            {t('accessPolicy.switch.confirmEnforceWarning')}
          </Typography>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {t('accessPolicy.switch.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t(keys.confirm)}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
