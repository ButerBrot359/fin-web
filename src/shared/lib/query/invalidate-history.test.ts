import { QueryClient } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { invalidateDocumentQueries } from './invalidate-entities'

it('document mutations invalidate paged history without refetching unrelated tables', () => {
  const client = new QueryClient()
  const history = [
    'sdui-table-page',
    '/api/document-entries/71/history/rows',
    { language: 'RU' },
    50,
  ]
  const report = ['sdui-table-page', '/api/reports/rows']
  client.setQueryData(history, { pages: [] })
  client.setQueryData(report, { pages: [] })
  invalidateDocumentQueries(client)
  expect(client.getQueryState(history)?.isInvalidated).toBe(true)
  expect(client.getQueryState(report)?.isInvalidated).toBe(false)
})
