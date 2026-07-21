import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { fetchDictTypeMetadata } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { LegacyDictionaryEntryPage } from './legacy-dictionary-entry-page'
import { SduiDictionaryEntryPage } from './sdui-dictionary-entry-page'

/**
 * Развилка SDUI/легаси для карточки справочника (SCRUM-244 §C1), по образцу
 * document-entry-page. SDUI — только для существующей записи (entryId) типа
 * с newView; создание/копирование и 404 от OPEN — легаси.
 */
export const DictionaryEntryPage = () => {
  const { moduleCode = '', entryId } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'DICTIONARY'
  // 404 от OPEN: тип помечен newView, но конкретная форма ещё не раскатана
  const [sduiFailed, setSduiFailed] = useState(false)

  const { data: newView, isLoading } = useQuery({
    queryKey: ['dict-type', domain, moduleCode],
    queryFn: ({ signal }) => fetchDictTypeMetadata(domain, moduleCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data.newView,
  })

  if (isLoading) return <PageSkeleton />

  if (newView && entryId && !sduiFailed) {
    return (
      <SduiDictionaryEntryPage
        moduleCode={moduleCode}
        onOpenFailed={() => setSduiFailed(true)}
      />
    )
  }
  return <LegacyDictionaryEntryPage />
}
