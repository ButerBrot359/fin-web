import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { Typography } from '@mui/material'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { getAuditLog, type AuditLogRecord } from '../api/audit-log-api'
import {
  countExtraFilters,
  EMPTY_FILTERS,
  filtersToQuery,
  type AuditLogFilterValues,
} from '../lib/audit-log-filters'
import { useAuditActions } from '../lib/use-audit-actions'
import { useAuditLogUrlState } from '../lib/use-audit-log-url-state'
import { useSeenApplications } from '../lib/use-seen-applications'
import { AuditEventCard } from './audit-event-card'
import { AuditLogExportButton } from './audit-log-export-button'
import { AuditLogFilters } from './audit-log-filters'
import { AuditLogPagination } from './audit-log-pagination'
import { AuditLogTable } from './audit-log-table'

const PAGE_SIZE = 50

/**
 * Журнал регистрации — как в 1С (приказ МФ РК № 254, п. 27; SCRUM-371): кто, когда, с какого
 * компьютера и через какую сеть зашёл, что запускал, что проводил.
 *
 * <b>Только чтение.</b> Методов записи, правки и удаления в API нет и не будет (ADR-0063 §2.7):
 * журнал, который можно наполнить или почистить снаружи, ничего не доказывает.
 *
 * <b>Русские подписи событий и статусов берутся с сервера</b> (`actionPresentation`,
 * `outcomePresentation`, `/api/audit/actions`): перевод в двух местах однажды разойдётся, а
 * журнал — худшее место для расхождения.
 *
 * <b>Отбор — в адресной строке</b> (`useAuditLogUrlState`): переход в объект и «Назад»
 * возвращают ту же выборку, быстрые отборы из карточки события — просто новый адрес.
 */
export const AuditLogPage = () => {
  const { t } = useTranslation()
  const { filters, filtersKey, page, applyFilters, setPage } =
    useAuditLogUrlState()
  const [draft, setDraft] = useState<AuditLogFilterValues>(filters)
  const [draftKey, setDraftKey] = useState(filtersKey)
  const [extraOpen, setExtraOpen] = useState(countExtraFilters(filters) > 0)
  const [selected, setSelected] = useState<AuditLogRecord | null>(null)
  const actions = useAuditActions()

  // Отбор сменился снаружи (быстрый отбор, «Назад») — поля отбора показывают его, а не черновик.
  if (draftKey !== filtersKey) {
    setDraftKey(filtersKey)
    setDraft(filters)
    if (countExtraFilters(filters) > 0) setExtraOpen(true)
  }

  const query = filtersToQuery(filters, page, PAGE_SIZE)
  // Старые строки остаются на экране (keepPreviousData) с погашенными контролами — без мигания
  // скелетоном. staleTime: 0 — проверяющему нужна актуальная лента при каждом заходе.
  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: ['audit-log', query],
    queryFn: () => getAuditLog(query),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const rows = data?.content ?? []
  const applicationOptions = useSeenApplications(rows)

  if (isPending) {
    return <PageSkeleton />
  }

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
        onApply={() => {
          applyFilters(draft)
        }}
        onReset={() => {
          setDraft(EMPTY_FILTERS)
          applyFilters(EMPTY_FILTERS)
        }}
        disabled={isFetching}
        actions={actions}
        applicationOptions={applicationOptions}
        extraOpen={extraOpen}
        onToggleExtra={() => {
          setExtraOpen((open) => !open)
        }}
      />

      {isError && (
        <Typography role="alert" variant="body2" color="error">
          {t('auditLog.loadFailed')}
        </Typography>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography variant="body2" color="text.secondary">
          {t('auditLog.total', { count: data?.totalElements ?? 0 })}
        </Typography>
        <AuditLogExportButton
          query={query}
          disabled={isFetching || rows.length === 0}
        />
      </div>

      {rows.length === 0 ? (
        <Typography variant="body2">{t('auditLog.empty')}</Typography>
      ) : (
        <AuditLogTable rows={rows} onOpen={setSelected} />
      )}

      {totalPages > 1 && (
        <AuditLogPagination
          currentPage={currentPage}
          totalPages={totalPages}
          disabled={isFetching}
          onPrevious={() => {
            setPage(currentPage - 1)
          }}
          onNext={() => {
            setPage(currentPage + 1)
          }}
        />
      )}

      <AuditEventCard
        row={selected}
        onClose={() => {
          setSelected(null)
        }}
        onQuickFilter={(patch) => {
          setSelected(null)
          applyFilters({ ...EMPTY_FILTERS, ...patch })
        }}
      />
    </div>
  )
}
