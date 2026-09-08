import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

interface ReportToolbarProps {
  disabled: boolean
  onExportXlsx: () => void
  onExportCsv: () => void
  onPrint: () => void
}

/** Выгрузка и печать сформированного отчёта. */
export const ReportToolbar = ({
  disabled,
  onExportXlsx,
  onExportCsv,
  onPrint,
}: ReportToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 print:hidden">
      <Button size="small" disabled={disabled} onClick={onExportXlsx}>
        {t('analytics.report.exportXlsx')}
      </Button>
      <Button size="small" disabled={disabled} onClick={onExportCsv}>
        {t('analytics.report.exportCsv')}
      </Button>
      <Button size="small" disabled={disabled} onClick={onPrint}>
        {t('analytics.report.print')}
      </Button>
    </div>
  )
}
