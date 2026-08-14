import { useState, useEffect, useRef } from 'react'

import type { SelectOption } from '@/shared/types/select-option'

const DEBOUNCE_MS = 300

export interface UseReferenceOptionsResult {
  options: SelectOption[]
  loading: boolean
  load: (search?: string) => void
  loadDebounced: (search: string) => void
  resetOptions: () => void
}

/**
 * Общая загрузка опций ссылочных пикеров (§3.1 SCRUM-268):
 * seq-гвард от гонок ответов, debounce поиска, сброс кэша по смене resetKey.
 * Ошибки fetch глотаются — UI показывает пустой список.
 */
export function useReferenceOptions(
  fetcher: (search?: string) => Promise<SelectOption[]>,
  resetKey: string,
): UseReferenceOptionsResult {
  const [options, setOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)

  const requestSeqRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Всегда актуальный fetcher без пересоздания load (fetcher — inline-замыкание вызывающего)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // Инвалидация кэша опций при смене параметров источника (напр. смена организации)
  useEffect(() => {
    setOptions([])
  }, [resetKey])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const load = (search?: string) => {
    const seq = ++requestSeqRef.current
    setLoading(true)
    fetcherRef
      .current(search)
      .then((opts) => {
        if (seq !== requestSeqRef.current) return // поздний ответ раннего запроса — игнор
        setOptions(opts)
      })
      .catch(() => {
        if (seq === requestSeqRef.current) setOptions([])
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setLoading(false)
      })
  }

  const loadDebounced = (search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(search), DEBOUNCE_MS)
  }

  const resetOptions = () => {
    setOptions([])
  }

  return { options, loading, load, loadDebounced, resetOptions }
}
