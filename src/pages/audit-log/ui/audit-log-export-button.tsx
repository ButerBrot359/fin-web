import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/shared/lib/utils/date'
import { buildXlsxBlob, downloadBlob } from '@/shared/lib/xlsx/write-xlsx'
import { Button } from '@/shared/ui/buttons/button'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { AuditLogQuery } from '../api/audit-log-api'
import {
  buildAuditLogSheet,
  EXPORT_MAX_ROWS,
  fetchAuditLogForExport,
} from '../lib/export-audit-log'

interface AuditLogExportButtonProps {
  /** Применённый отбор — выгружается ровно то, что на экране, но все страницы. */
  query: AuditLogQuery
  disabled: boolean
}

/** «Выгрузить в Excel» — текущая выборка журнала, до {@link EXPORT_MAX_ROWS} записей. */
export const AuditLogExportButton = ({
  query,
  disabled,
}: AuditLogExportButtonProps) => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const exportXlsx = async () => {
    setBusy(true)
    try {
      const { rows, truncated } = await fetchAuditLogForExport(query)
      const title = t('auditLog.exportFileName')
      const stamp = formatDate(new Date(), 'yyyy-MM-dd HH-mm')
      const sheet = buildAuditLogSheet(rows, (key) => t(key), title, [
        formatDate(new Date(), 'dd.MM.yyyy HH:mm'),
      ])
      downloadBlob(buildXlsxBlob(sheet), `${title} ${stamp}.xlsx`)
      if (truncated) {
        showToast(
          'warning',
          t('auditLog.exportTruncated', { count: EXPORT_MAX_ROWS })
        )
      }
    } catch {
      showToast('error', t('auditLog.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={() => {
        void exportXlsx()
      }}
      disabled={disabled || busy}
    >
      {t('auditLog.export')}
    </Button>
  )
}
