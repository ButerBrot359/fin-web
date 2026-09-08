import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons/button'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import {
  getAuditLog,
  type AuditLogPage as AuditPage,
} from '../api/audit-log-api'
import { AuditLogFilters, type AuditLogFilterValues } from './audit-log-filters'

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
 * быть пользователя (учётной записи с таким логином может не существовать). Показывать это как
 * ошибку данных нельзя.
 */
export const AuditLogPage = () => {
  const { t } = useTranslation()
  const [applied, setApplied] = useState<AuditLogFilterValues>(EMPTY_FILTERS)
  const [draft, setDraft] = useState<AuditLogFilterValues>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<AuditPage | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAuditLog({
      from: applied.from ? `${applied.from}:00` : undefined,
      to: applied.to ? `${applied.to}:00` : undefined,
      userLogin: applied.userLogin,
      action: applied.action,
      outcome: applied.outcome,
      page,
      size: PAGE_SIZE,
    })
      .then((loaded) => {
        setData(loaded)
        setError(null)
      })
      .catch(() => {
        setError(t('auditLog.loadFailed'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [applied, page, t])

  // Запрос на монтировании и при смене отбора/страницы. Индикатор загрузки поднимается синхронно,
  // до ухода запроса, — иначе таблица секунду показывает старые строки как актуальные; тем же
  // приёмом и с тем же подавлением правила это сделано в reportalt-page.tsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load])

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

  if (data === null && isLoading) {
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
        disabled={isLoading}
      />

      {error && (
        <Typography role="alert" variant="body2" color="error">
          {error}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary">
        {t('auditLog.total', { count: data?.totalElements ?? 0 })}
      </Typography>

      {rows.length === 0 ? (
        <Typography variant="body2">{t('auditLog.empty')}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('auditLog.occurredAt')}</TableCell>
              <TableCell>{t('auditLog.user')}</TableCell>
              <TableCell>{t('auditLog.action')}</TableCell>
              <TableCell>{t('auditLog.outcome')}</TableCell>
              <TableCell>{t('auditLog.object')}</TableCell>
              <TableCell>{t('auditLog.message')}</TableCell>
              <TableCell>{t('auditLog.clientAddress')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(row.occurredAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  {row.userName ?? row.userLogin ?? ''}
                  {row.userLogin && row.userLogin !== row.userName && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {row.userLogin}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{row.actionPresentation}</TableCell>
                <TableCell>{row.outcomePresentation}</TableCell>
                <TableCell>
                  {row.entryPresentation ?? ''}
                  {row.typeCode && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {row.typeCode}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{row.message ?? ''}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.clientAddress ?? ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            disabled={isLoading || currentPage === 0}
            onClick={() => {
              setPage((previous) => Math.max(0, previous - 1))
            }}
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
            disabled={isLoading || currentPage + 1 >= totalPages}
            onClick={() => {
              setPage((previous) => previous + 1)
            }}
          >
            {t('auditLog.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
