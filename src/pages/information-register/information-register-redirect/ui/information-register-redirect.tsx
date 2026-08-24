import { Navigate, useParams } from 'react-router-dom'

import { useResolveTypePageCode } from '@/entities/module'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

interface InformationRegisterRedirectProps {
  mode: 'list' | 'entry' | 'new'
}

/**
 * Плоские ссылки с бэка /information-registers/:typeCode[/:entryId|/new] →
 * редирект в раздел /modules/:pageCode/informationregister/...
 * (SCRUM-45, ADR-0044_SDUI §2.8). Их отдаёт серверный effect navigate:
 * list.rowOpen, list.create и «Записать и закрыть» страницы записи.
 * ?domain= не дописываем — сегмент informationregister сам задаёт домен.
 */
export const InformationRegisterRedirect = ({
  mode,
}: InformationRegisterRedirectProps) => {
  const { typeCode = '', entryId } = useParams()
  const { isResolving, pageCode } = useResolveTypePageCode(typeCode)

  if (isResolving) return <PageSkeleton />

  if (!pageCode) {
    console.warn(
      `[information-register-redirect] Раздел для регистра «${typeCode}» не найден`
    )
    return <Navigate to="/" replace />
  }

  const base = `/modules/${pageCode}/informationregister/${typeCode}`
  if (mode === 'new') return <Navigate to={`${base}/new`} replace />
  if (mode === 'entry' && entryId)
    return <Navigate to={`${base}/${entryId}`} replace />
  return <Navigate to={base} replace />
}
