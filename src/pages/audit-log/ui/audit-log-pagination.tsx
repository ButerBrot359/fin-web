import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons/button'

interface AuditLogPaginationProps {
  /** Фактический номер страницы из ответа сервера (0-based). */
  currentPage: number
  /** Фактическое число страниц из ответа сервера. */
  totalPages: number
  disabled: boolean
  onPrevious: () => void
  onNext: () => void
}

/** Пагинация журнала: «назад/вперёд» по фактическим значениям из ответа сервера. */
export const AuditLogPagination = ({
  currentPage,
  totalPages,
  disabled,
  onPrevious,
  onNext,
}: AuditLogPaginationProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="secondary"
        disabled={disabled || currentPage === 0}
        onClick={onPrevious}
      >
        {t('auditLog.previous')}
      </Button>

      <Typography variant="body2">
        {t('auditLog.pageOf', {
          page: currentPage + 1,
          total: totalPages,
        })}
      </Typography>

      <Button
        variant="secondary"
        disabled={disabled || currentPage + 1 >= totalPages}
        onClick={onNext}
      >
        {t('auditLog.next')}
      </Button>
    </div>
  )
}
