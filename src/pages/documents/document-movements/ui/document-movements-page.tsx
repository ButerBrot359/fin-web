import {
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Typography } from '@mui/material'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DropdownButton } from '@/shared/ui/buttons'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { fetchDocumentMovements } from '../api/document-movements-api'
import { MovementGroupsView } from './movement-groups-view'

export const DocumentMovementsPage = () => {
  const { entryId = '', pageCode = '', moduleCode = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const { data, isLoading } = useQuery({
    queryKey: ['document-movements', entryId],
    queryFn: ({ signal }) => fetchDocumentMovements(entryId, signal),
    select: (res) => res.data.data.groups,
  })

  const groups = data ?? []

  const docTitle = searchParams.get('title')
  const movementsLabel = t('documentMovements.title')
  const pageTitle = docTitle ? `${movementsLabel}: ${docTitle}` : movementsLabel
  useTabMeta(pageTitle)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    const backPath =
      searchParams.get('from') === 'list'
        ? `/modules/${pageCode}/document/${moduleCode}`
        : `/modules/${pageCode}/document/${moduleCode}/${entryId}`
    void navigate(backPath)
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />

      <div className="flex items-center justify-end">
        <DropdownButton label={t('actions.more')} />
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Typography className="text-ui-05">
            {t('documentMovements.empty')}
          </Typography>
        </div>
      ) : (
        <MovementGroupsView groups={groups} />
      )}
    </div>
  )
}
