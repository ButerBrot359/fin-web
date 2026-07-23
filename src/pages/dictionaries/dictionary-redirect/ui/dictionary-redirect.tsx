import { Navigate, useParams } from 'react-router-dom'

import { useResolveTypePageCode } from '@/entities/module'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

interface DictionaryRedirectProps {
  mode: 'list' | 'entry'
}

/**
 * Плоские ссылки с бэка /dictionaries/:typeCode[/:entryId] → редирект в раздел
 * /modules/:pageCode/dictionary/... (SCRUM-244 §C2). Их отдаёт серверный effect
 * navigate (напр. после dict.saveAndClose).
 */
export const DictionaryRedirect = ({ mode }: DictionaryRedirectProps) => {
  const { typeCode = '', entryId } = useParams()
  const { isResolving, pageCode } = useResolveTypePageCode(typeCode)

  if (isResolving) return <PageSkeleton />

  if (!pageCode) {
    console.warn(`[dictionary-redirect] Раздел для справочника «${typeCode}» не найден`)
    return <Navigate to="/" replace />
  }

  const base = `/modules/${pageCode}/dictionary/${typeCode}`
  const to =
    mode === 'entry' && entryId
      ? `${base}/${entryId}?domain=DICTIONARY`
      : `${base}?domain=DICTIONARY`
  return <Navigate to={to} replace />
}
