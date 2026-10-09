import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { isApiHttpError } from '@/shared/api/api-error'
import { readErrorBody } from '@/shared/api/access-denied'
import { AccessDenied } from '@/shared/ui/access-denied'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { formatDateTime } from '@/shared/lib/utils/date'

import { fetchAccessPolicyOverview } from '../api/access-policy-api'
import { ACCESS_POLICY_OVERVIEW_KEY } from '../lib/query-keys'
import { PolicyOverviewBlock } from './policy-overview-block'
import { PolicySwitchForm } from './policy-switch-form'

/**
 * «Режим прав доступа» `/admin/access-policy` (SCRUM-400 §11): администратор
 * политики прав видит режим и переключает его в пару кликов; всю низкоуровневую
 * последовательность (манифест, релиз, preflight, активация, smoke) делает
 * сервер. Ссылку сюда отдаёт бэк пунктом меню только администраторам; прямой
 * заход без допуска — «Нет доступа» по первому же 403, других запросов нет.
 */
export const AccessPolicyPage = () => {
  const { t } = useTranslation()

  const overviewQuery = useQuery({
    queryKey: ACCESS_POLICY_OVERVIEW_KEY,
    queryFn: ({ signal }) => fetchAccessPolicyOverview(signal),
    staleTime: 0,
    retry: false,
    // §11.6 п.1: пока права пользователей догоняют публикацию — перечитываем.
    refetchInterval: (query) =>
      (query.state.data?.pendingSubjectsCount ?? 0) > 0 ? 3_000 : false,
  })

  if (overviewQuery.isPending) return <PageSkeleton />

  if (overviewQuery.isError) {
    const error = overviewQuery.error
    if (isApiHttpError(error) && error.status === 403) {
      return <AccessDenied message={readErrorBody(error.body).message} />
    }
    return (
      <div className="p-6">
        <Typography role="alert" variant="body2" color="error">
          {t('accessPolicy.loadFailed')}
        </Typography>
      </div>
    )
  }

  const overview = overviewQuery.data

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <Typography component="h1" fontSize={24} fontWeight={700}>
          {t('accessPolicy.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('accessPolicy.description')}
        </Typography>
      </div>

      <PolicyOverviewBlock overview={overview} />
      <PolicySwitchForm overview={overview} />

      <section className="flex flex-col gap-3">
        <Typography component="h2" fontSize={18} fontWeight={700}>
          {t('accessPolicy.history.title')}
        </Typography>
        {overview.recentReleases.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('accessPolicy.history.empty')}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('accessPolicy.history.status')}</TableCell>
                <TableCell>{t('accessPolicy.history.version')}</TableCell>
                <TableCell>{t('accessPolicy.history.createdBy')}</TableCell>
                <TableCell>{t('accessPolicy.history.activatedAt')}</TableCell>
                <TableCell>{t('accessPolicy.history.retiredAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overview.recentReleases.map((release) => (
                <TableRow key={release.id}>
                  <TableCell>{release.status}</TableCell>
                  {/* policyVersion показывается как есть (§11.3) */}
                  <TableCell>{release.policyVersion}</TableCell>
                  <TableCell>{release.createdBy ?? '—'}</TableCell>
                  <TableCell>
                    {release.activatedAt
                      ? formatDateTime(release.activatedAt)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {release.retiredAt
                      ? formatDateTime(release.retiredAt)
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
