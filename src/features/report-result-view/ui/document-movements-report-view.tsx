import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { MovementGroupsView } from '@/pages/documents/document-movements'

import type { DocumentMovementsReportResult } from '../lib/document-movements-result'

/**
 * Рендер отчёта «Движения документа» (DvizheniyaDokumenta): заголовок —
 * представление документа, тело — переиспользованный компонент вкладок движений
 * по регистрам (тот же, что на странице «Движения документа» формы документа).
 */
export const DocumentMovementsReportView = ({
  result,
}: {
  result: DocumentMovementsReportResult
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      {result.documentPresentation && (
        <Typography
          variant="body1"
          sx={{ color: '#333', fontWeight: 700, fontSize: 17 }}
        >
          {result.documentPresentation}
        </Typography>
      )}
      {result.groups.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Typography className="text-ui-05">
            {t('documentMovements.empty')}
          </Typography>
        </div>
      ) : (
        <MovementGroupsView groups={result.groups} />
      )}
    </div>
  )
}
