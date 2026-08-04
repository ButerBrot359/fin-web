import { Navigate, useParams, useLocation } from 'react-router-dom'

import { useResolveTypePageCode } from '@/entities/module'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

interface DocumentRedirectProps {
  mode: 'list' | 'new' | 'entry'
}

/**
 * Плоские ссылки с бэка /documents/:typeCode[/new|/:entryId] → редирект в раздел
 * /modules/:pageCode/document/:typeCode[/new|/:entryId] (SCRUM-268 §3.6, SCRUM-301).
 * search (напр. ?copyFrom=…) сохраняется при mode='new' и mode='entry'.
 */
export const DocumentRedirect = ({ mode }: DocumentRedirectProps) => {
  const { typeCode = '', entryId = '' } = useParams()
  const location = useLocation()
  const { isResolving, pageCode } = useResolveTypePageCode(typeCode)

  if (isResolving) return <PageSkeleton />

  if (!pageCode) {
    console.warn(
      `[document-redirect] Раздел для типа документа «${typeCode}» не найден`
    )
    return <Navigate to="/" replace />
  }

  const base = `/modules/${pageCode}/document/${typeCode}`
  const to =
    mode === 'new'
      ? `${base}/new${location.search}`
      : mode === 'entry'
        ? `${base}/${entryId}${location.search}`
        : base
  return <Navigate to={to} replace />
}
