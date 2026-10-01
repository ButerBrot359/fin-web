import { QueryClient } from '@tanstack/react-query'
import { expect, it } from 'vitest'

import { invalidateDictionaryQueries } from './invalidate-entities'

it('правка справочника сбрасывает кэш выпадашек активных записей и подписей по id', () => {
  const client = new QueryClient()
  const active = [
    'dictionary-entries',
    'FunktsionalnayaKlassifikatsiyaRaskhodov',
    'active',
  ]
  const byId = ['dictionary-entry-by-id', 42]
  client.setQueryData(active, { data: [] })
  client.setQueryData(byId, { id: 42 })

  invalidateDictionaryQueries(client)

  expect(client.getQueryState(active)?.isInvalidated).toBe(true)
  expect(client.getQueryState(byId)?.isInvalidated).toBe(true)
})
