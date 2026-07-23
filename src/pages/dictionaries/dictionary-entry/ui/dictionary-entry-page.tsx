import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { fetchDictTypeMetadata } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { LegacyDictionaryEntryPage } from './legacy-dictionary-entry-page'
import { SduiDictionaryEntryPage } from './sdui-dictionary-entry-page'

/**
 * Развилка SDUI/легаси для карточки справочника (SCRUM-244 §C1), по образцу
 * document-entry-page. SDUI — для существующей записи и для создания (route
 * /new без copyFrom) типа с newView. Копирование (?copyFrom) остаётся на легаси:
 * предзаполнение из источника на SDUI-OPEN бэком не подтверждено (v3 §1.7).
 * 404 от OPEN — тоже легаси.
 */
export const DictionaryEntryPage = () => {
  const { moduleCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'DICTIONARY'
  // Копирование живёт на том же /new-маршруте с ?copyFrom — отличаем его от
  // чистого создания, чтобы не увести копию в SDUI (v3 §1.7).
  const isCopy = searchParams.has('copyFrom')
  // 404 от OPEN: тип помечен newView, но конкретная форма ещё не раскатана
  const [sduiFailed, setSduiFailed] = useState(false)

  const { data: newView, isLoading } = useQuery({
    queryKey: ['dict-type', domain, moduleCode],
    queryFn: ({ signal }) => fetchDictTypeMetadata(domain, moduleCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data.newView,
  })

  if (isLoading) return <PageSkeleton />

  if (newView && !isCopy && !sduiFailed) {
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
