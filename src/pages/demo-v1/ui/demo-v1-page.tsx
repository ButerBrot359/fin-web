import { useEffect, useState } from 'react'
import { Typography, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { GreenAccentButton } from '@/shared/ui/buttons'
import { Button } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'
import { NoContent } from '@/shared/ui/no-content/no-content'
import SearchIcon from '@/shared/assets/icons/search.svg'

// ============================================================
// V1 — Flat Schema: фронт получает плоские массивы и сам строит UI
// ============================================================

interface Column {
  id: string
  label: string
  type: string
  sortable?: boolean
  width?: number
}

interface Filter {
  id: string
  type: string
  label: string
  optionsEndpoint: string
  dependsOn?: string
}

interface Action {
  id: string
  type: string
  label: string
  variant?: string
  icon?: string
  handler?: { type: string; endpoint: string }
  options?: { id: string; label: string }[]
}

interface ListPageSchema {
  type: string
  title: string
  entityCode: string
  dataEndpoint: string
  actions: Action[]
  filters: Filter[]
  columns: Column[]
  rowAction: { type: string; pattern: string }
  pagination: { defaultPageSize: number; pageSizeOptions: number[] }
}

interface DataResponse {
  items: Record<string, string>[]
  total: number
  page: number
  pageSize: number
}

const MOCK_URL = 'http://localhost:3001'

export const DemoV1Page = () => {
  const { t } = useTranslation()
  const [schema, setSchema] = useState<ListPageSchema | null>(null)
  const [data, setData] = useState<DataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [schemaRes, dataRes] = await Promise.all([
          fetch(`${MOCK_URL}/api/v1/pages/cash-receipt-order`),
          fetch(`${MOCK_URL}/api/data/cash-receipt-orders`),
        ])
        setSchema((await schemaRes.json()) as ListPageSchema)
        setData((await dataRes.json()) as DataResponse)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <CircularProgress />
      </div>
    )
  }

  if (!schema) return null

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Заголовок */}
      <Typography variant="h5" fontWeight={600}>
        {`V1 Flat — ${schema.title}`}
      </Typography>

      {/* Тулбар — рендерим из schema.actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {schema.actions.map((action) => {
            if (action.type === 'button' && action.variant === 'accent') {
              return (
                <GreenAccentButton key={action.id}>
                  <Typography variant="body2">{action.label}</Typography>
                </GreenAccentButton>
              )
            }
            if (action.type === 'button') {
              return (
                <Button key={action.id}>
                  <Typography variant="body2">{action.label}</Typography>
                </Button>
              )
            }
            if (action.type === 'dropdown') {
              return (
                <Button key={action.id}>
                  <Typography variant="body2">{action.label} ▾</Typography>
                </Button>
              )
            }
            return null
          })}
        </div>
        <SearchInput
          placeholder={t('pageToolbar.search')}
          value={search}
          className="bg-ui-01 w-60"
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
        />
      </div>

      {/* Фильтры — рендерим из schema.filters */}
      <div className="flex gap-4">
        {schema.filters.map((filter) => (
          <div
            key={filter.id}
            className="flex items-center gap-2 rounded-lg border border-ui-03 px-3 py-2 text-ui-05 min-w-48"
          >
            <Typography variant="body2" className="text-ui-05">
              {filter.label}
            </Typography>
            <span className="ml-auto text-ui-05">▾</span>
          </div>
        ))}
      </div>

      {/* Таблица — рендерим из schema.columns + data */}
      {data && data.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ui-03">
                {schema.columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-3 py-2 text-left font-medium text-ui-05"
                    style={{ minWidth: col.width }}
                  >
                    <Typography variant="body2" className="text-ui-05">
                      {col.label}
                      {col.sortable ? ' ↕' : ''}
                    </Typography>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ui-03 hover:bg-ui-02 cursor-pointer"
                >
                  {schema.columns.map((col) => (
                    <td key={col.id} className="px-3 py-2">
                      <Typography variant="body2">
                        {col.type === 'datetime'
                          ? new Date(row[col.id]).toLocaleString('ru-RU')
                          : (row[col.id] ?? '-')}
                      </Typography>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Пагинация */}
          <div className="flex items-center justify-between px-3 py-3 text-ui-05">
            <Typography variant="body2" className="text-ui-05">
              {`${String(data.items.length)} из ${String(data.total)}`}
            </Typography>
            <Typography variant="body2" className="text-ui-05">
              {`Стр. ${String(data.page)} · По ${String(data.pageSize)}`}
            </Typography>
          </div>
        </div>
      ) : (
        <NoContent />
      )}
    </div>
  )
}
