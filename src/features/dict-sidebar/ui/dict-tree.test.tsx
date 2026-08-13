import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { DictSidebarPanel } from '../types/dict-sidebar'
import type { DictColumn } from '../lib/utils/dict-columns'
import type { DictEntry } from '../api/dict-sidebar-api'
import { DictTree } from './dict-tree'

const fetchPagedMock = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock('../api/dict-sidebar-api', () => ({
  fetchDictEntriesPaged: (...args: unknown[]) => fetchPagedMock(...args),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/shared/assets/icons/arrow-right-small-blue.svg', () => ({
  default: () => <span data-testid="chevron" />,
}))
vi.mock('@/shared/assets/icons/folder-icon.svg', () => ({
  default: () => <span data-testid="folder" />,
}))

const entry = (over: Partial<DictEntry> & { id: number }): DictEntry => ({
  code: String(over.id),
  nameRu: `Запись ${String(over.id)}`,
  nameKz: '',
  isActive: true,
  attributes: null,
  ...over,
})

/** Ответ `/paged` в форме, которую разбирает компонент. */
const paged = (content: DictEntry[]) => ({
  data: { data: { content, totalElements: content.length, last: true } },
})

const columns: DictColumn[] = [
  {
    id: 'nameRu',
    title: 'Наименование',
    sortable: false,
    render: (e) => e.nameRu,
  },
]

const panel: DictSidebarPanel = {
  id: 'panel-1',
  mode: 'list',
  domain: 'DICTIONARY',
  typeCode: 'KlassifikatsiyaDolzhnosteyPoFunktsionalnymBlokam',
}

const renderTree = (over: Partial<DictSidebarPanel> = {}) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DictTree
        panel={{ ...panel, ...over }}
        columns={columns}
        selectedId={null}
        onSelectRow={vi.fn()}
        onConfirm={vi.fn()}
        widthOf={() => 200}
        startResize={vi.fn()}
      />
    </QueryClientProvider>
  )
}

/** Параметры последнего запроса `/paged` (3-й аргумент). */
const lastParams = () =>
  fetchPagedMock.mock.calls.at(-1)?.[2] as Record<string, unknown>

describe('DictTree', () => {
  afterEach(cleanup)

  beforeEach(() => {
    fetchPagedMock.mockReset()
  })

  it('корневой уровень грузится без parent — папки и записи корня', async () => {
    fetchPagedMock.mockResolvedValue(
      paged([
        entry({ id: 28485, nameRu: 'Блок B', isGroup: true }),
        entry({ id: 70, nameRu: '1-й квалификационный разряд' }),
      ])
    )
    renderTree()

    expect(await screen.findByText('Блок B')).toBeTruthy()
    expect(screen.getByText('1-й квалификационный разряд')).toBeTruthy()
    expect(lastParams()).not.toHaveProperty('parent')
  })

  it('клик по папке грузит её содержимое запросом с parent', async () => {
    fetchPagedMock.mockImplementation(
      (_d, _t, params: Record<string, unknown>) =>
        Promise.resolve(
          params.parent === 28485
            ? paged([
                entry({ id: 28504, nameRu: 'Здравоохранение', isGroup: true }),
              ])
            : paged([entry({ id: 28485, nameRu: 'Блок B', isGroup: true })])
        )
    )
    renderTree()

    fireEvent.click(await screen.findByText('Блок B'))

    expect(await screen.findByText('Здравоохранение')).toBeTruthy()
    expect(lastParams()).toMatchObject({ parent: 28485 })
  })

  it('flatWithGroups от сервера не уходит в запрос уровня — иначе вместо уровня придёт весь справочник', async () => {
    fetchPagedMock.mockResolvedValue(
      paged([entry({ id: 1, nameRu: 'Блок A' })])
    )
    renderTree({ searchParams: { flatWithGroups: 'true', af: 'X:1' } })

    await screen.findByText('Блок A')
    expect(lastParams()).not.toHaveProperty('flatWithGroups')
    // Серверный отбор поля при этом сохраняется.
    expect(lastParams()).toMatchObject({ af: 'X:1' })
  })

  it('клик по элементу выбирает его, а не разворачивает', async () => {
    fetchPagedMock.mockResolvedValue(
      paged([entry({ id: 70, nameRu: '1-й квалификационный разряд' })])
    )
    const onSelectRow = vi.fn()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <DictTree
          panel={panel}
          columns={columns}
          selectedId={null}
          onSelectRow={onSelectRow}
          onConfirm={vi.fn()}
          widthOf={() => 200}
          startResize={vi.fn()}
        />
      </QueryClientProvider>
    )

    fireEvent.click(await screen.findByText('1-й квалификационный разряд'))

    expect(onSelectRow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 70 })
    )
  })

  it('пустая папка показывает пустой уровень, а не молчит', async () => {
    fetchPagedMock.mockImplementation(
      (_d, _t, params: Record<string, unknown>) =>
        Promise.resolve(
          params.parent === 28485
            ? paged([])
            : paged([entry({ id: 28485, nameRu: 'Блок B', isGroup: true })])
        )
    )
    renderTree()

    fireEvent.click(await screen.findByText('Блок B'))

    await waitFor(() => {
      expect(screen.getByText('dictSidebar.emptyGroup')).toBeTruthy()
    })
  })
})
