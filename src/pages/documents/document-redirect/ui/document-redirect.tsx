import { Navigate, useParams, useLocation } from 'react-router-dom'

import { useResolveTypePageCode } from '@/entities/module'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

interface DocumentRedirectProps {
  mode: 'list' | 'new'
}

/**
 * Плоские ссылки с бэка /documents/:typeCode[/new] → редирект в раздел
 * /modules/:pageCode/document/:typeCode[/new] (SCRUM-268 §3.6).
 * search (напр. ?copyFrom=…) сохраняется при mode='new'.
 */
export const DocumentRedirect = ({ mode }: DocumentRedirectProps) => {
  const { typeCode = '' } = useParams()
  const location = useLocation()
  const { isResolving, pageCode } = useResolveTypePageCode(typeCode)

  if (isResolving) return <PageSkeleton />

  if (!pageCode) {
    console.warn(
      `[document-redirect] Раздел для типа документа «${typeCode}» не найден`,
    )
    return <Navigate to="/" replace />
  }

  const base = `/modules/${pageCode}/document/${typeCode}`
  const to = mode === 'new' ? `${base}/new${location.search}` : base
  return <Navigate to={to} replace />
}
