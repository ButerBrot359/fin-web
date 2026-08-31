import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Dialog } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

/**
 * Согласие на управление (ADR-0050).
 *
 * <p><b>Спрашивается прямо и без смягчений.</b> Человек соглашается не на «помощь», а на то, что
 * посторонний будет нажимать кнопки в его бухгалтерии: проводить документы, править суммы,
 * удалять записи. Формулировка не должна оставлять шанса согласиться, не поняв этого, — поэтому
 * в тексте перечислено, что именно станет возможно.
 *
 * <p>Кнопка отказа стоит первой и не выделена цветом: согласие должно быть осознанным действием,
 * а не тем, что нажимается быстрее.
 */
export const RemoteControlConsent = ({
  agentName,
  onDecide,
}: {
  agentName: string
  onDecide: (granted: boolean) => void
}) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      // Закрыть мимо нельзя: молчание не должно превращаться ни в согласие, ни в отказ —
      // агент ждёт ответа, и человек должен его дать.
      slotProps={{
        paper: {
          sx: {
            borderRadius: '40px',
            boxShadow: '0px 3px 24px 0px rgba(244, 72, 42, 0.4)',
            m: 2,
          },
        },
      }}
    >
      <div className="flex flex-col gap-6 px-10 py-8">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-support-01/10 text-support-01">
            <WarningAmberIcon />
          </span>
          <div className="min-w-0">
            <h2 className="text-h2 leading-normal text-ui-06">
              {t('support.controlRequestTitle')}
            </h2>
            <p className="mt-1 text-body2 text-ui-05">
              {t('support.controlRequestFrom', { name: agentName })}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-ui-02 px-4 py-3">
          <p className="text-body2 text-ui-06">
            {t('support.controlRequestWhat')}
          </p>
          <p className="mt-2 text-body2 text-ui-05">
            {t('support.controlRequestLimits')}
          </p>
          <p className="mt-2 text-body2 text-ui-05">
            {t('support.controlRequestStop')}
          </p>
        </div>

        <div className="flex w-full gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              onDecide(false)
            }}
            className="flex-1 bg-ui-02"
          >
            {t('support.controlDeny')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onDecide(true)
            }}
            className="flex-1"
          >
            {t('support.controlAllow')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
