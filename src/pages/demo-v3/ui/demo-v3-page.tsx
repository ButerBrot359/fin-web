import { useEffect, useState } from 'react'
import { Typography, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { GreenAccentButton } from '@/shared/ui/buttons'
import { Button } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'
import { NoContent } from '@/shared/ui/no-content/no-content'
import SearchIcon from '@/shared/assets/icons/search.svg'

// ============================================================
// V3 — Action-Driven: секции + actions + visibility conditions
// ============================================================

interface TableColumn {
  id: string
  label: string
  fieldType: string
  sortable?: boolean
  width?: number
}

interface FilterDef {
  id: string
  fieldType: string
  label: string
  source: { type: string; endpoint: string; params?: Record<string, string> }
  visibility?: { condition: string }
}

interface ActionItem {
  id: string
  label: string
  execute: { type: string; method?: string; endpoint?: string; path?: string }
  visibility?: { condition: string }
}

interface ActionDef {
  id: string
  trigger: string
  label: string
  variant?: string
  execute?: {
    type: string
    endpoint?: string
    renderAs?: string
    path?: string
  }
  visibility?: { condition: string }
  items?: ActionItem[]
}

interface ListPageSchema {
  type: string
  meta: {
    title: string
    entityCode: string
    dataEndpoint: string
  }
  actions: ActionDef[]
  filters: FilterDef[]
  table: {
    columns: TableColumn[]
    rowActions: {
      id: string
      trigger: string
      execute: { type: string; path: string }
    }[]
    pagination: { defaultPageSize: number; pageSizeOptions: number[] }
  }
}

interface DataResponse {
  items: Record<string, string>[]
  total: number
  page: number
  pageSize: number
}

const MOCK_URL = 'http://localhost:3001'

// Рендерер действий — учитывает trigger и variant
const RenderAction = ({ action }: { action: ActionDef }) => {
  if (action.trigger === 'button' && action.variant === 'accent') {
    return (
      <GreenAccentButton>
        <Typography variant="body2">{action.label}</Typography>
      </GreenAccentButton>
    )
  }
  if (action.trigger === 'button') {
    return (
      <Button>
        <Typography variant="body2">{action.label}</Typography>
      </Button>
    )
  }
  if (action.trigger === 'dropdown') {
    return (
      <Button>
        <Typography variant="body2">{action.label} ▾</Typography>
      </Button>
    )
  }
  return null
}

// Простой движок visibility (для демо — всегда показываем)
const isVisible = (_condition?: { condition: string }) => {
  // В реальности здесь парсинг условий: "selectedRows.length > 0" и т.д.
  return true
}

export const DemoV3Page = () => {
  const { t } = useTranslation()
  const [schema, setSchema] = useState<ListPageSchema | null>(null)
  const [data, setData] = useState<DataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [schemaRes, dataRes] = await Promise.all([
          fetch(`${MOCK_URL}/api/v3/pages/cash-receipt-order`),
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
      <Typography variant="h5" fontWeight={600}>
        {`V3 Action-Driven — ${schema.meta.title}`}
      </Typography>

      {/* Тулбар — рендерим actions с учётом visibility */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {schema.actions
            .filter((a) => isVisible(a.visibility))
            .map((action) => (
              <RenderAction key={action.id} action={action} />
            ))}
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

      {/* Фильтры — с visibility условиями */}
      <div className="flex gap-4">
        {schema.filters
          .filter((f) => isVisible(f.visibility))
          .map((filter) => (
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

      {/* Таблица из schema.table */}
      {data && data.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ui-03">
                {schema.table.columns.map((col) => (
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
                  {schema.table.columns.map((col) => (
                    <td key={col.id} className="px-3 py-2">
                      <Typography variant="body2">
                        {col.fieldType === 'datetime'
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
