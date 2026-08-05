import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'

interface EntryItem {
  id: number
  presentation?: string
  [key: string]: unknown
}

interface EntriesResponse {
  content?: EntryItem[]
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
  const items = res.data.content ?? []
  return items.map((item) => ({
    id: item.id,
    code: String(item.id),
    label: item.presentation ?? String(item.id),
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
    totalElements?: number
    last: boolean
    number: number
  }
}

export async function fetchListPage(args: {
  url: string
  params?: Record<string, string>
  method?: string
  body?: unknown
  page: number
  size: number
  search?: string
  signal?: AbortSignal
}): Promise<PagedListResponse> {
  const params = {
    ...args.params,
    page: args.page,
    size: args.size,
    ...(args.search?.trim() && { search: args.search.trim() }),
  }
  if (args.method === 'POST') {
    const res = await apiService.post<PagedListResponse>({
      url: args.url,
      params,
      data: args.body ?? {},
      signal: args.signal,
    })
    return res.data
  }
  const res = await apiService.get<PagedListResponse>({
    url: args.url,
    params,
    signal: args.signal,
  })
  return res.data
}
