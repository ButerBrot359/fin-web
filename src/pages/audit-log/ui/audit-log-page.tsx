import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { Typography } from '@mui/material'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { getAuditLog } from '../api/audit-log-api'
import { AuditLogFilters, type AuditLogFilterValues } from './audit-log-filters'
import { AuditLogTable } from './audit-log-table'
import { AuditLogPagination } from './audit-log-pagination'

const EMPTY_FILTERS: AuditLogFilterValues = {
  from: '',
  to: '',
  userLogin: '',
  action: '',
  outcome: '',
}

const PAGE_SIZE = 50

/**
 * Журнал регистрации действий — экран проверяющего (приказ МФ РК № 254, п. 27; события входа —
 * ТЗ «Аутентификация» §А6).
 *
 * <b>Только чтение.</b> Методов записи, правки и удаления в API нет и не будет (ADR-0063 §2.7):
 * журнал, который можно наполнить или почистить снаружи, ничего не доказывает. Поэтому здесь нет
 * ни кнопки «добавить», ни редактирования строк — и это не упущение вёрстки.
 *
 * <b>Русские подписи действий и исходов берутся с сервера</b> (`actionPresentation`,
 * `outcomePresentation`), а не переводятся здесь: перевод в двух местах однажды разойдётся, и в
 * журнале — том документе, который показывают проверяющему, — это худшее место для расхождения.
 * Исключение — выпадающие списки отбора: там подписи нужны до загрузки данных.
 *
 * <b>Пустые ячейки — норма.</b> У событий входа и выхода нет объекта, у неудачного входа может не
 * быть пользователя (учётной записи с таким логином может не существовать).
 */
export const AuditLogPage = () => {
  const { t } = useTranslation()
  const [applied, setApplied] = useState<AuditLogFilterValues>(EMPTY_FILTERS)
  const [draft, setDraft] = useState<AuditLogFilterValues>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)

  // При смене отбора/страницы старые строки остаются на экране (keepPreviousData) с
  // погашенными контролами — как и раньше, без мигания скелетоном. staleTime: 0 — журнал
  // перечитывается при каждом заходе на страницу: проверяющему нужна актуальная лента.
  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: ['audit-log', applied, page],
    queryFn: () =>
      getAuditLog({
        from: applied.from ? `${applied.from}:00` : undefined,
        to: applied.to ? `${applied.to}:00` : undefined,
        userLogin: applied.userLogin,
        action: applied.action,
        outcome: applied.outcome,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const applyFilters = () => {
    // Страница сбрасывается вместе с отбором: остаться на 40-й странице нового отбора значит
    // показать пустой экран там, где данные есть.
    setPage(0)
    setApplied(draft)
  }

  const resetFilters = () => {
    setPage(0)
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
  }

  if (isPending) {
    return <PageSkeleton />
  }

  const rows = data?.content ?? []
  // Ориентируемся на ФАКТИЧЕСКИЕ значения из ответа: сервер молча ограничивает size (потолок 200),
  // и считать страницы по запрошенному размеру значит однажды нарисовать несуществующие.
  const totalPages = data?.totalPages ?? 0
  const currentPage = data?.number ?? 0

  return (
    <div className="flex flex-col gap-4 p-6">
      <Typography component="h1" fontSize={24} fontWeight={700}>
        {t('auditLog.title')}
      </Typography>

      <AuditLogFilters
        value={draft}
        onChange={setDraft}
        onApply={applyFilters}
        onReset={resetFilters}
        disabled={isFetching}
      />

      {isError && (
        <Typography role="alert" variant="body2" color="error">
          {t('auditLog.loadFailed')}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary">
        {t('auditLog.total', { count: data?.totalElements ?? 0 })}
      </Typography>

      {rows.length === 0 ? (
        <Typography variant="body2">{t('auditLog.empty')}</Typography>
      ) : (
        <AuditLogTable rows={rows} />
      )}

      {totalPages > 1 && (
        <AuditLogPagination
          currentPage={currentPage}
          totalPages={totalPages}
          disabled={isFetching}
          onPrevious={() => {
            setPage((previous) => Math.max(0, previous - 1))
          }}
          onNext={() => {
            setPage((previous) => previous + 1)
          }}
        />
      )}
    </div>
  )
}
