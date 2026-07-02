import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'

interface EntryItem {
  id: number
  presentation?: string
  name?: string
  [key: string]: unknown
}

interface EntriesResponse {
  content?: EntryItem[]
  items?: EntryItem[]
}

export async function fetchReferenceOptions(args: {
  url: string
  params?: Record<string, unknown>
  search?: string
}): Promise<SelectOption[]> {
  const res = await apiService.get<EntriesResponse>({
    url: args.url,
    params: { ...args.params, search: args.search, page: 0, size: 20 },
  })
  const items = res.data.content ?? res.data.items ?? []
  return items.map((item) => ({
    id: item.id,
    code: String(item.id),
    label: item.presentation ?? item.name ?? String(item.id),
  }))
}

interface ListRow {
  id: number
  [key: string]: unknown
  attributes?: Record<string, unknown>
}

interface PagedListResponse {
  data: {
    content: ListRow[]
    totalElements: number
    last: boolean
    number: number
  }
}

export async function fetchListPage(args: {
  url: string
  params?: Record<string, string>
  page: number
  size: number
  search?: string
  signal?: AbortSignal
}): Promise<PagedListResponse> {
  const res = await apiService.get<PagedListResponse>({
    url: args.url,
    params: {
      ...args.params,
      page: args.page,
      size: args.size,
      ...(args.search?.trim() && { search: args.search.trim() }),
    },
    signal: args.signal,
  })
  return res.data
}
