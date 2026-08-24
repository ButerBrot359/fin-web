import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { fetchDictTypeMetadata } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { LegacyDictionaryEntryPage } from './legacy-dictionary-entry-page'
import { SduiDictionaryEntryPage } from './sdui-dictionary-entry-page'

/**
 * Развилка SDUI/легаси для карточки справочника (SCRUM-244 §C1), по образцу
 * document-entry-page. SDUI — для существующей записи, создания и копирования
 * (route /new, в т.ч. с ?copyFrom — SCRUM-360 §7: OPEN отдаёт заполненный
 * state с суффиксом «(копия)», маршрут уходит на бэк вместе с query-строкой).
 * 404 от OPEN — легаси.
 */
export const DictionaryEntryPage = () => {
  const { moduleCode = '' } = useParams()
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

  if (newView && !sduiFailed) {
    return (
      <SduiDictionaryEntryPage
        moduleCode={moduleCode}
        onOpenFailed={() => {
          setSduiFailed(true)
        }}
      />
    )
  }
  return <LegacyDictionaryEntryPage />
}
