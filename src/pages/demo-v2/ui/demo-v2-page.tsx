import { useEffect, useState } from 'react'
import {
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { GreenAccentButton } from '@/shared/ui/buttons'
import { Button } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'
import { NoContent } from '@/shared/ui/no-content/no-content'
import { JsonViewer } from '@/shared/ui/json-viewer/json-viewer'
import SearchIcon from '@/shared/assets/icons/search.svg'

// ============================================================
// V2 — Nested Layout: рекурсивный рендер дерева от бэка
// ============================================================

interface LayoutNode {
  type: string
  id?: string
  label?: string
  text?: string
  level?: number
  link?: boolean
  variant?: string
  icon?: string
  position?: string
  span?: number
  placeholder?: string
  fieldType?: string
  sortable?: boolean
  width?: number
  optionsEndpoint?: string
  dependsOn?: string
  onClick?: { type: string; endpoint?: string; pattern?: string }
  items?: { id: string; label: string }[]
  dataEndpoint?: string
  rowAction?: { type: string; pattern: string }
  pagination?: { defaultPageSize: number; pageSizeOptions: number[] }
  columns?: LayoutNode[]
  children?: LayoutNode[]
}

interface ListPageSchema {
  type: string
  title: string
  entityCode: string
  dataEndpoint: string
  layout: LayoutNode
}

interface DataResponse {
  items: Record<string, string>[]
  total: number
  page: number
  pageSize: number
}

const MOCK_URL = 'http://localhost:3001'

// Рекурсивный рендерер — ключевая идея V2
const RenderNode = ({
  node,
  data,
  search,
  onSearchChange,
}: {
  node: LayoutNode
  data: DataResponse | null
  search: string
  onSearchChange: (val: string) => void
}) => {
  const { t } = useTranslation()

  switch (node.type) {
    case 'page':
      return (
        <div className="flex flex-col gap-4">
          {node.children?.map((child, i) => (
            <RenderNode
              key={child.id ?? i}
              node={child}
              data={data}
              search={search}
              onSearchChange={onSearchChange}
            />
          ))}
        </div>
      )

    case 'toolbar':
      return (
        <div className="flex items-center justify-between">
          {node.children?.map((child, i) => (
            <RenderNode
              key={child.id ?? i}
              node={child}
              data={data}
              search={search}
              onSearchChange={onSearchChange}
            />
          ))}
        </div>
      )

    case 'toolbar-group':
      return (
        <div className="flex items-center gap-2">
          {node.children?.map((child, i) => (
            <RenderNode
              key={child.id ?? i}
              node={child}
              data={data}
              search={search}
              onSearchChange={onSearchChange}
            />
          ))}
        </div>
      )

    case 'action-button':
      if (node.variant === 'accent') {
        return (
          <GreenAccentButton>
            <Typography variant="body2">{node.label}</Typography>
          </GreenAccentButton>
        )
      }
      return (
        <Button>
          <Typography variant="body2">{node.label}</Typography>
        </Button>
      )

    case 'action-icon':
      return (
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ui-05 hover:bg-ui-02"
          title={node.icon}
        >
          <Typography variant="body2">
            {node.icon === 'export' ? '\u{1F4C4}' : '\u2699'}
          </Typography>
        </button>
      )

    case 'action-dropdown':
      return (
        <Button>
          <Typography variant="body2">{node.label} \u25BE</Typography>
        </Button>
      )

    case 'search':
      return (
        <SearchInput
          placeholder={node.placeholder ?? t('pageToolbar.search')}
          value={search}
          className="bg-ui-01 w-60"
          onChange={(e) => {
            onSearchChange(e.target.value)
          }}
          startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
        />
      )

    case 'filter-bar':
      return (
        <div className="flex gap-4">
          {node.children?.map((child, i) => (
            <RenderNode
              key={child.id ?? i}
              node={child}
              data={data}
              search={search}
              onSearchChange={onSearchChange}
            />
          ))}
        </div>
      )

    case 'filter':
      return (
        <div className="flex items-center gap-2 rounded-lg border border-ui-03 px-3 py-2 text-ui-05 min-w-48">
          <Typography variant="body2" className="text-ui-05">
            {node.label}
          </Typography>
          <span className="ml-auto text-ui-05">{'\u25BE'}</span>
        </div>
      )

    case 'data-table': {
      const columns = node.columns ?? []
      if (!data || data.items.length === 0) return <NoContent />

      return (
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ui-03">
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-3 py-2 text-left font-medium text-ui-05"
                    style={{ minWidth: col.width }}
                  >
                    <Typography variant="body2" className="text-ui-05">
                      {col.label}
                      {col.sortable ? ' \u2195' : ''}
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
                  {columns.map((col) => {
                    const colId = col.id ?? ''
                    return (
                      <td key={colId} className="px-3 py-2">
                        <Typography variant="body2">
                          {col.fieldType === 'datetime'
                            ? new Date(row[colId] ?? '').toLocaleString('ru-RU')
                            : (row[colId] ?? '-')}
                        </Typography>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-3 py-3 text-ui-05">
            <Typography variant="body2" className="text-ui-05">
              {`${String(data.items.length)} \u0438\u0437 ${String(data.total)}`}
            </Typography>
            <Typography variant="body2" className="text-ui-05">
              {`\u0421\u0442\u0440. ${String(data.page)} \u00B7 \u041F\u043E ${String(data.pageSize)}`}
            </Typography>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

export const DemoV2Page = () => {
  const [schema, setSchema] = useState<ListPageSchema | null>(null)
  const [data, setData] = useState<DataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [jsonOpen, setJsonOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [schemaRes, dataRes] = await Promise.all([
          fetch(`${MOCK_URL}/api/v2/pages/cash-receipt-order`),
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
      <div className="flex items-center gap-2">
        <Typography variant="h5" fontWeight={600}>
          {`V2 Nested Layout \u2014 ${schema.title}`}
        </Typography>
        <Tooltip title="JSON">
          <IconButton
            size="small"
            onClick={() => {
              setJsonOpen(true)
            }}
          >
            <span className="text-base">{'{ }'}</span>
          </IconButton>
        </Tooltip>
      </div>

      {/* Весь UI рендерится рекурсивно из layout дерева */}
      <RenderNode
        node={schema.layout}
        data={data}
        search={search}
        onSearchChange={setSearch}
      />

      <JsonViewer
        open={jsonOpen}
        onClose={() => {
          setJsonOpen(false)
        }}
        tabs={[
          { label: 'Schema', data: schema },
          { label: 'Data', data: data },
        ]}
      />
    </div>
  )
}
