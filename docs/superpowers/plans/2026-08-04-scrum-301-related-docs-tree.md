# SCRUM-301 «Связанные документы» — план реализации (фронт)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Панель «Связанные документы» рендерит одно дерево подчинённости (плоский список строк с бэка), с иконками статуса, жирным текущим, проваливанием в документы и пятью кнопками тулбара с фронтовым транспортом.

**Architecture:** Ветка `props.rowMode === 'TREE'` в read-only пути `TableNode` → отдельный компонент `SubordinationTree`; session-less GET/POST зеркалом «Движений» (`movements-api.ts` → `open-movements.ts` → `openDialogAsPanel`); выделение — свой zustand-стор с ключом по `anchorId`; команды `related.*` перехватываются в `button-node.tsx` до `dispatch`.

**Tech Stack:** React 19, TypeScript 5.9, zustand, MUI, vitest + @testing-library/react, react-router-dom, i18next.

**Спека:** `docs/superpowers/specs/2026-08-04-scrum-301-related-docs-tree-design.md` (+ бэк-спека `specs-local/scrum-301-svyazannye-dokumenty/SCRUM-301-spec-v1-2026-08-03-back.md`).

## Global Constraints

- НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build` (CLAUDE.md); тесты запускать точечно `npx vitest run <путь>`.
- Тексты — только через i18n (`i18n.t('sdui.…')`, ключи в `src/app/config/i18n/locales/{ru,kz}/common.json`); текстовые элементы — `<Typography>` из `@mui/material`.
- Легаси не трогать; SDUI ↔ легаси импорты запрещены. Иконки из `src/shared/assets/icons/` — общий код, можно.
- Barrel-файлы внутри сегментов (ui/, lib/, api/) НЕ создавать.
- Файлы: цель ~200 строк, >300 — разбивать.
- Коммиты: `feat|fix|add|refactor: описание` (commit-msg hook), pre-commit прогоняет lint-staged.
- `_direction` — union-литерал `'UP' | 'SELF' | 'DOWN'`, не `string`.
- Строки дерева НЕ сортировать и НЕ перегруппировывать — порядок сервера равен порядку отрисовки.
- `requiresSelectedRow` на кнопках `related.*` не выставлять (его резолв идёт через стор пикера ссылок).
- Линии ├─└─│ не рисуем (решение пользователя): только отступ + жирный + иконка.

---

### Task 1: Роут проваливания `/documents/:typeCode/:entryId` (блокер §4.2 бэк-спеки)

**Files:**

- Modify: `src/pages/documents/document-redirect/ui/document-redirect.tsx`
- Modify: `src/app/App.tsx` (рядом с роутами `/documents/:typeCode` и `/documents/:typeCode/new`, ~строки 159–166)
- Test: `src/pages/documents/document-redirect/ui/document-redirect.test.tsx` (создать)

**Interfaces:**

- Consumes: `useResolveTypePageCode(typeCode)` из `@/entities/module` (уже есть).
- Produces: `DocumentRedirect` принимает `mode: 'list' | 'new' | 'entry'`; роут `/documents/:typeCode/:entryId` редиректит на `/modules/<pageCode>/document/<typeCode>/<entryId>` с сохранением `location.search`. Task 4 навигирует на этот роут.

- [ ] **Step 1: Написать падающий тест**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { DocumentRedirect } from './document-redirect'

vi.mock('@/entities/module', () => ({
  useResolveTypePageCode: () => ({
    isResolving: false,
    pageCode: 'ZarplatiIKadri',
  }),
}))
vi.mock('@/shared/ui/page-skeleton/page-skeleton', () => ({
  PageSkeleton: () => null,
}))

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/documents/:typeCode"
          element={<DocumentRedirect mode="list" />}
        />
        <Route
          path="/documents/:typeCode/new"
          element={<DocumentRedirect mode="new" />}
        />
        <Route
          path="/documents/:typeCode/:entryId"
          element={<DocumentRedirect mode="entry" />}
        />
        <Route
          path="/modules/:pageCode/document/:typeCode"
          element={<div>list-page</div>}
        />
        <Route
          path="/modules/:pageCode/document/:typeCode/new"
          element={<div>new-page</div>}
        />
        <Route
          path="/modules/:pageCode/document/:typeCode/:entryId"
          element={<div>entry-page</div>}
        />
      </Routes>
    </MemoryRouter>
  )

describe('DocumentRedirect mode=entry', () => {
  it('редиректит /documents/:typeCode/:entryId в раздел с entryId', () => {
    renderAt('/documents/SchetKOplate/1002')
    expect(screen.getByText('entry-page')).toBeTruthy()
  })

  it('статический /new ранжируется выше и не перехватывается entry-роутом', () => {
    renderAt('/documents/SchetKOplate/new')
    expect(screen.getByText('new-page')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/pages/documents/document-redirect`
Expected: FAIL — TS/пропс `mode="entry"` не существует (тип `'list' | 'new'`), рендер падает или редирект не туда.

- [ ] **Step 3: Минимальная реализация**

В `document-redirect.tsx`:

```tsx
interface DocumentRedirectProps {
  mode: 'list' | 'new' | 'entry'
}
```

В компоненте — читать `entryId` и добавить ветку (search сохраняется, симметрично `mode='new'`):

```tsx
const { typeCode = '', entryId = '' } = useParams()
```

```tsx
const base = `/modules/${pageCode}/document/${typeCode}`
const to =
  mode === 'new'
    ? `${base}/new${location.search}`
    : mode === 'entry'
      ? `${base}/${entryId}${location.search}`
      : base
return <Navigate to={to} replace />
```

В `App.tsx` после роута `/documents/:typeCode/new`:

```tsx
<Route
  path="/documents/:typeCode/:entryId"
  element={<DocumentRedirect mode="entry" />}
/>
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/pages/documents/document-redirect`
Expected: PASS (оба теста).

- [ ] **Step 5: Commit**

```bash
git add src/pages/documents/document-redirect src/app/App.tsx
git commit -m "fix: роут /documents/:typeCode/:entryId — проваливание в документ (SCRUM-301)"
```

---

### Task 2: API-модуль `related-docs-api.ts`

**Files:**

- Create: `src/features/sdui/api/related-docs-api.ts`
- Test: `src/features/sdui/api/related-docs-api.test.ts`

**Interfaces:**

- Consumes: `apiService.get/post` из `@/shared/api/api` (`get({url, params})`, `post({url, params})` → `Promise<AxiosResponse<T>>`); тип `ViewResponse` из `../types/view`.
- Produces (для Task 5):
  - `fetchRelatedDocsView(entryId: string, anchorId?: string): Promise<ViewResponse>`
  - `postRelatedDocsAction(action: RelatedDocsAction, entryId: string, rootId: string, anchorId: string): Promise<ViewResponse>`
  - `type RelatedDocsAction = 'post' | 'unpost' | 'toggle-deletion-mark'`

- [ ] **Step 1: Написать падающий тест**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import { fetchRelatedDocsView, postRelatedDocsAction } from './related-docs-api'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(), post: vi.fn() },
}))

const mockGet = vi.mocked(apiService.get)
const mockPost = vi.mocked(apiService.post)

describe('related-docs-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({
      data: { formSessionId: '', revision: 0 },
    } as never)
    mockPost.mockResolvedValue({
      data: { formSessionId: '', revision: 0 },
    } as never)
  })

  it('GET без anchorId — params не передаются', async () => {
    await fetchRelatedDocsView('42')
    expect(mockGet).toHaveBeenCalledWith({
      url: '/api/view/related-documents/42',
      params: undefined,
    })
  })

  it('GET с anchorId — anchorId в query', async () => {
    await fetchRelatedDocsView('42', '7')
    expect(mockGet).toHaveBeenCalledWith({
      url: '/api/view/related-documents/42',
      params: { anchorId: '7' },
    })
  })

  it('POST действия — путь по action, rootId и anchorId в query', async () => {
    await postRelatedDocsAction('toggle-deletion-mark', '42', '1', '7')
    expect(mockPost).toHaveBeenCalledWith({
      url: '/api/view/related-documents/42/toggle-deletion-mark',
      params: { rootId: '1', anchorId: '7' },
    })
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/api/related-docs-api.test.ts`
Expected: FAIL — модуль `./related-docs-api` не существует.

- [ ] **Step 3: Реализация**

```ts
import { apiService } from '@/shared/api/api'

import type { ViewResponse } from '../types/view'

export type RelatedDocsAction = 'post' | 'unpost' | 'toggle-deletion-mark'

// Session-less дерево связанных документов (бэк-спека §3.2): зеркало
// movements-api.ts. entryId — корень дерева, anchorId — владелец вкладки
// (не передан ⇒ бэк берёт равным entryId).
export const fetchRelatedDocsView = async (
  entryId: string,
  anchorId?: string
): Promise<ViewResponse> => {
  const res = await apiService.get<ViewResponse>({
    url: `/api/view/related-documents/${entryId}`,
    params: anchorId ? { anchorId } : undefined,
  })
  return res.data
}

// Действие над выделенным узлом (бэк-спека §3.3): ответ всегда 200,
// исход в notify-эффекте + перестроенное дерево того же корня.
export const postRelatedDocsAction = async (
  action: RelatedDocsAction,
  entryId: string,
  rootId: string,
  anchorId: string
): Promise<ViewResponse> => {
  const res = await apiService.post<ViewResponse>({
    url: `/api/view/related-documents/${entryId}/${action}`,
    params: { rootId, anchorId },
  })
  return res.data
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/features/sdui/api/related-docs-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/api/related-docs-api.ts src/features/sdui/api/related-docs-api.test.ts
git commit -m "feat: API связанных документов — session-less GET и три действия (SCRUM-301)"
```

---

### Task 3: Типы строки дерева + стор выделения

**Files:**

- Create: `src/features/sdui/types/related-docs.ts`
- Create: `src/features/sdui/lib/stores/related-docs-store.ts`
- Test: `src/features/sdui/lib/stores/related-docs-store.test.ts`

**Interfaces:**

- Produces (для Task 4 и Task 5):
  - `RelatedTreeRow` — контракт строки `related.tree` (бэк-спека §2);
  - `useRelatedDocsStore`: `selected: Record<string, RelatedDocsSelection | undefined>`, `select(anchorId: string, row: RelatedDocsSelection | null)`, `reset()`;
  - `RelatedDocsSelection = { rowId: string; isDeletionMarked: boolean }`.

- [ ] **Step 1: Написать падающий тест стора**

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import { useRelatedDocsStore } from './related-docs-store'

describe('related-docs-store', () => {
  beforeEach(() => {
    useRelatedDocsStore.getState().reset()
  })

  it('select пишет выделение по anchorId, не задевая другие панели', () => {
    const { select } = useRelatedDocsStore.getState()
    select('a1', { rowId: 'r1', isDeletionMarked: false })
    select('a2', { rowId: 'r9', isDeletionMarked: true })
    expect(useRelatedDocsStore.getState().selected.a1).toEqual({
      rowId: 'r1',
      isDeletionMarked: false,
    })
    expect(useRelatedDocsStore.getState().selected.a2).toEqual({
      rowId: 'r9',
      isDeletionMarked: true,
    })
  })

  it('select(anchorId, null) снимает выделение', () => {
    const { select } = useRelatedDocsStore.getState()
    select('a1', { rowId: 'r1', isDeletionMarked: false })
    select('a1', null)
    expect(useRelatedDocsStore.getState().selected.a1).toBeUndefined()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/stores/related-docs-store.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Реализация типов и стора**

`src/features/sdui/types/related-docs.ts`:

```ts
// Контракт строки дерева связанных документов (SCRUM-301, бэк-спека §2).
// Дерево приходит ПЛОСКИМ списком: порядок строк = порядок отрисовки,
// фронт не сортирует. Union-литерал _direction — чтобы забытая ветка в
// рендере была ошибкой компиляции, а не тихим дефолтом.
export type RelatedTreeDirection = 'UP' | 'SELF' | 'DOWN'

export interface RelatedTreeEntityRef {
  domain: string
  id: number | string
  presentation?: string
  typeCode: string
}

export interface RelatedTreeRow {
  rowId: string
  _level: number
  _direction: RelatedTreeDirection
  _parentRowId: string | null
  _isCurrent: boolean
  _presentation: string
  // Маркер обрыва ветки, а не документ: не выделяется и не проваливается
  _isTruncated?: boolean
  _isPosted: boolean
  _isDeletionMarked: boolean
  _status?: string
  _route?: string
  _type?: { entityRef?: RelatedTreeEntityRef }
}
```

`src/features/sdui/lib/stores/related-docs-store.ts`:

```ts
import { create } from 'zustand'

export interface RelatedDocsSelection {
  rowId: string
  // Снимок флага выделенной строки — выбор confirmMessageSet/Unset у
  // «Пометить на удаление» без обратного поиска по строкам дерева
  isDeletionMarked: boolean
}

// Выделенная строка дерева связанных документов, ключ — anchorId владельца
// вкладки: две открытые панели не делят одно выделение (бэк-спека §3.1).
interface RelatedDocsStore {
  selected: Record<string, RelatedDocsSelection | undefined>
  select: (anchorId: string, row: RelatedDocsSelection | null) => void
  reset: () => void
}

export const useRelatedDocsStore = create<RelatedDocsStore>((set) => ({
  selected: {},
  select: (anchorId, row) =>
    set((s) => ({ selected: { ...s.selected, [anchorId]: row ?? undefined } })),
  reset: () => set({ selected: {} }),
}))
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/features/sdui/lib/stores/related-docs-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/types/related-docs.ts src/features/sdui/lib/stores/related-docs-store.ts src/features/sdui/lib/stores/related-docs-store.test.ts
git commit -m "feat: типы строки дерева и стор выделения связанных документов (SCRUM-301)"
```

---

### Task 4: Компонент `SubordinationTree` + ветка в `TableNode`

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/subordination-tree.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx` (read-only путь, строки 155–160)
- Test: `src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`

**Interfaces:**

- Consumes: `RelatedTreeRow` (Task 3), `useRelatedDocsStore` (Task 3), `useSduiSession().getValue(binding)` (в панели значения приходят из `PanelEntry.viewState` через `PanelStateProvider`), `useNavigate` из react-router-dom, иконки `@/shared/assets/icons/doc-{posted,draft,deleted}.svg` (svgr, default-export компонента).
- Produces: `SubordinationTree: FC<NodeProps>`; `TableNode` рендерит его при `node.props?.rowMode === 'TREE'`.

- [ ] **Step 1: Написать падающий тест**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import type { RelatedTreeRow } from '../../../types/related-docs'
import { useRelatedDocsStore } from '../../../lib/stores/related-docs-store'
import { TableNode } from './table-node'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: 'backend', init: () => {} },
}))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

vi.mock('@/shared/assets/icons/doc-posted.svg', () => ({
  default: () => <span data-testid="icon-posted" />,
}))
vi.mock('@/shared/assets/icons/doc-draft.svg', () => ({
  default: () => <span data-testid="icon-draft" />,
}))
vi.mock('@/shared/assets/icons/doc-deleted.svg', () => ({
  default: () => <span data-testid="icon-deleted" />,
}))

const row = (over: Partial<RelatedTreeRow>): RelatedTreeRow => ({
  rowId: 'r1',
  _level: 0,
  _direction: 'SELF',
  _parentRowId: null,
  _isCurrent: false,
  _presentation: 'Документ',
  _isPosted: false,
  _isDeletionMarked: false,
  ...over,
})

const treeNode: ViewNode = {
  id: 'tbl.related',
  type: 'TABLE',
  binding: 'related.tree',
  props: { editable: false, rowMode: 'TREE', navigable: true, anchorId: 'a1' },
} as ViewNode

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  useRelatedDocsStore.getState().reset()
  delete state['related.tree']
})

describe('SubordinationTree', () => {
  it('отступ по _level, жирный по _isCurrent', () => {
    state['related.tree'] = [
      row({
        rowId: 'r1',
        _level: 2,
        _direction: 'UP',
        _presentation: 'Предок',
      }),
      row({
        rowId: 'r2',
        _level: 0,
        _isCurrent: true,
        _presentation: 'Текущий',
      }),
    ]
    render(<TableNode node={treeNode} />)
    const current = screen.getByText('Текущий')
    const ancestor = screen.getByText('Предок')
    expect(getComputedStyle(current).fontWeight).toBe('600')
    expect(getComputedStyle(ancestor).fontWeight).toBe('400')
    const ancestorCell = ancestor.closest('td')!
    const currentCell = current.closest('td')!
    expect(ancestorCell.style.paddingLeft).toBe('56px') // 8 + 2*24
    expect(currentCell.style.paddingLeft).toBe('8px')
  })

  it('иконка: _isDeletionMarked приоритетнее _isPosted, иначе draft', () => {
    state['related.tree'] = [
      row({ rowId: 'r1', _isPosted: true, _isDeletionMarked: true }),
      row({ rowId: 'r2', _isPosted: true, _presentation: 'Б' }),
      row({ rowId: 'r3', _presentation: 'В' }),
    ]
    render(<TableNode node={treeNode} />)
    expect(screen.getByTestId('icon-deleted')).toBeTruthy()
    expect(screen.getByTestId('icon-posted')).toBeTruthy()
    expect(screen.getByTestId('icon-draft')).toBeTruthy()
  })

  it('одиночный клик выделяет строку в сторе по anchorId', () => {
    state['related.tree'] = [row({ rowId: 'r1', _isDeletionMarked: true })]
    render(<TableNode node={treeNode} />)
    fireEvent.click(screen.getByText('Документ'))
    expect(useRelatedDocsStore.getState().selected.a1).toEqual({
      rowId: 'r1',
      isDeletionMarked: true,
    })
  })

  it('двойной клик навигирует по _route; фолбэк — entityRef', () => {
    state['related.tree'] = [
      row({ rowId: 'r1', _route: '/documents/SchetKOplate/1002' }),
      row({
        rowId: 'r2',
        _presentation: 'Без роута',
        _type: {
          entityRef: { domain: 'DOCUMENT', id: 7, typeCode: 'Zayavka' },
        },
      }),
    ]
    render(<TableNode node={treeNode} />)
    fireEvent.doubleClick(screen.getByText('Документ'))
    expect(navigateMock).toHaveBeenCalledWith('/documents/SchetKOplate/1002')
    fireEvent.doubleClick(screen.getByText('Без роута'))
    expect(navigateMock).toHaveBeenCalledWith('/documents/Zayavka/7')
  })

  it('_isTruncated: без иконки, клик не выделяет, dblclick не навигирует', () => {
    state['related.tree'] = [
      row({
        rowId: 'cut',
        _isTruncated: true,
        _presentation: '…ещё',
        _route: '/documents/X/1',
      }),
    ]
    render(<TableNode node={treeNode} />)
    const el = screen.getByText('…ещё')
    fireEvent.click(el)
    fireEvent.doubleClick(el)
    expect(useRelatedDocsStore.getState().selected.a1).toBeUndefined()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('icon-draft')).toBeNull()
  })

  it('_status уходит в title строки', () => {
    state['related.tree'] = [row({ rowId: 'r1', _status: 'Проведён' })]
    render(<TableNode node={treeNode} />)
    expect(screen.getByTitle('Проведён')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
Expected: FAIL — `rowMode: 'TREE'` уходит в `ReadOnlyTable` (пустая таблица без колонок), компонента нет.

- [ ] **Step 3: Реализация**

`subordination-tree.tsx`:

```tsx
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'

import DocPostedIcon from '@/shared/assets/icons/doc-posted.svg'
import DocDraftIcon from '@/shared/assets/icons/doc-draft.svg'
import DocDeletedIcon from '@/shared/assets/icons/doc-deleted.svg'

import type { NodeProps } from '../../../types/view'
import type { RelatedTreeRow } from '../../../types/related-docs'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useRelatedDocsStore } from '../../../lib/stores/related-docs-store'

// Шаг отступа уровня дерева; базовые 8px — обычный горизонтальный padding ячейки
const INDENT_STEP_PX = 24
const BASE_PADDING_PX = 8

// Приоритет: пометка на удаление → проведён → черновик (бэк-спека §4.1)
const StatusIcon: FC<{ row: RelatedTreeRow }> = ({ row }) => {
  if (row._isDeletionMarked)
    return <DocDeletedIcon className="h-4 w-4 shrink-0" />
  if (row._isPosted) return <DocPostedIcon className="h-4 w-4 shrink-0" />
  return <DocDraftIcon className="h-4 w-4 shrink-0" />
}

// Дерево структуры подчинённости (SCRUM-301): плоский список строк с бэка,
// порядок строк = порядок отрисовки. Одиночный клик — выделение (для команд
// тулбара), двойной — проваливание в документ; маркеры обрыва инертны.
export const SubordinationTree: FC<NodeProps> = ({ node }) => {
  const navigate = useNavigate()
  const anchorId = (node.props?.anchorId as string | undefined) ?? ''
  const { getValue } = useSduiSession()
  const rows = (getValue(node.binding) as RelatedTreeRow[] | undefined) ?? []
  const selected = useRelatedDocsStore((s) => s.selected[anchorId])
  const select = useRelatedDocsStore((s) => s.select)

  const handleClick = (row: RelatedTreeRow) => {
    if (row._isTruncated === true) return
    select(anchorId, {
      rowId: row.rowId,
      isDeletionMarked: row._isDeletionMarked,
    })
  }

  const handleDoubleClick = (row: RelatedTreeRow) => {
    if (row._isTruncated === true) return
    const ref = row._type?.entityRef
    const route =
      row._route ?? (ref ? `/documents/${ref.typeCode}/${ref.id}` : undefined)
    if (route) navigate(route)
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.rowId}
              hover={row._isTruncated !== true}
              selected={selected?.rowId === row.rowId}
              title={row._status}
              onClick={() => handleClick(row)}
              onDoubleClick={() => handleDoubleClick(row)}
              sx={{ cursor: row._isTruncated === true ? 'default' : 'pointer' }}
            >
              <TableCell
                style={{
                  paddingLeft: `${BASE_PADDING_PX + row._level * INDENT_STEP_PX}px`,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {row._isTruncated !== true && <StatusIcon row={row} />}
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: row._isCurrent ? 600 : 400 }}
                  >
                    {row._presentation}
                  </Typography>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
```

В `table-node.tsx` — первой веткой read-only пути (перед `regKind === 'ACCOUNTING'`):

```tsx
// Read-only path: дерево связанных документов → отдельный рендер (SCRUM-301),
// бухрегистр — 1С-блок, остальные — прежняя таблица
if (node.props?.rowMode === 'TREE') {
  return <SubordinationTree node={node} />
}
```

и импорт:

```tsx
import { SubordinationTree } from './subordination-tree'
```

- [ ] **Step 4: Прогнать тесты компонента и регресс соседей**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx src/features/sdui/ui/nodes/composite/read-only-table.test.tsx src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: PASS все.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/subordination-tree.tsx src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx src/features/sdui/ui/nodes/composite/table-node.tsx
git commit -m "feat: рендер дерева связанных документов — rowMode TREE (SCRUM-301)"
```

---

### Task 5: Обработчики `open-related-docs.ts` + i18n-ключ

**Files:**

- Create: `src/features/sdui/lib/open-related-docs.ts`
- Modify: `src/app/config/i18n/locales/ru/common.json` (в объект `sdui` по образцу соседних ключей)
- Modify: `src/app/config/i18n/locales/kz/common.json` (та же структура)
- Test: `src/features/sdui/lib/open-related-docs.test.ts`

**Interfaces:**

- Consumes: `fetchRelatedDocsView`, `postRelatedDocsAction`, `RelatedDocsAction` (Task 2); `useRelatedDocsStore` (Task 3); `openDialogAsPanel` из `./open-dialog-panel`; `useConfirmStore.getState().ask(message): Promise<boolean>`; `showToast(level, message)` из `@/shared/ui/toast/show-toast`; `i18n.t` из `i18next`.
- Produces (для Task 6):
  - `handleRelatedCommand(command: string, props: Record<string, unknown> | undefined): boolean` — true, если команда `related.*` перехвачена (dispatch слать не нужно);
  - `openRelatedDocsForEntry(entryId: string, anchorId?: string): Promise<void>` — на будущее (вход в панель из других точек, зеркало `openMovementsForEntry`).

- [ ] **Step 1: Добавить i18n-ключ**

В `ru/common.json` внутрь объекта `sdui` (рядом с существующими ключами, структура вложенная — как `sdui.conflict.*`):

```json
"relatedDocs": {
  "noSelection": "Выберите документ в дереве"
}
```

В `kz/common.json` там же:

```json
"relatedDocs": {
  "noSelection": "Ағаштағы құжатты таңдаңыз"
}
```

- [ ] **Step 2: Написать падающий тест**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewResponse } from '../types/view'
import {
  fetchRelatedDocsView,
  postRelatedDocsAction,
} from '../api/related-docs-api'
import { openDialogAsPanel } from './open-dialog-panel'
import { useConfirmStore } from './stores/confirm-store'
import { useRelatedDocsStore } from './stores/related-docs-store'
import { handleRelatedCommand } from './open-related-docs'

vi.mock('../api/related-docs-api', () => ({
  fetchRelatedDocsView: vi.fn(),
  postRelatedDocsAction: vi.fn(),
}))
vi.mock('./open-dialog-panel', () => ({ openDialogAsPanel: vi.fn() }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
vi.mock('i18next', () => ({ default: { t: (k: string) => k } }))

const mockFetch = vi.mocked(fetchRelatedDocsView)
const mockPost = vi.mocked(postRelatedDocsAction)

const response = (effects: ViewResponse['effects']): ViewResponse => ({
  formSessionId: '',
  revision: 0,
  effects,
})

const ctxProps = { anchorId: 'a1', rootId: 'root1' }

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('handleRelatedCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRelatedDocsStore.getState().reset()
    mockFetch.mockResolvedValue(response([]))
    mockPost.mockResolvedValue(response([]))
  })

  it('чужая команда — false, ничего не зовёт', () => {
    expect(handleRelatedCommand('table.add:X', ctxProps)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('related.refresh — GET с rootId и anchorId', async () => {
    expect(handleRelatedCommand('related.refresh', ctxProps)).toBe(true)
    await flush()
    expect(mockFetch).toHaveBeenCalledWith('root1', 'a1')
  })

  it('related.setRoot без выделения — notify, запроса нет', async () => {
    expect(handleRelatedCommand('related.setRoot', ctxProps)).toBe(true)
    await flush()
    expect(showToast).toHaveBeenCalledWith(
      'info',
      'sdui.relatedDocs.noSelection'
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('related.setRoot с выделением — GET от выделенной строки', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    handleRelatedCommand('related.setRoot', ctxProps)
    await flush()
    expect(mockFetch).toHaveBeenCalledWith('r5', 'a1')
  })

  it('related.post с выделением — POST post, эффекты играются', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    const dialogEffect = {
      type: 'openDialog' as const,
      node: { id: 'dialog.related.a1', type: 'PAGE' as const },
    }
    mockPost.mockResolvedValue(
      response([
        { type: 'notify' as const, level: 'success', message: 'Проведён' },
        dialogEffect,
      ])
    )
    handleRelatedCommand('related.post', ctxProps)
    await flush()
    expect(mockPost).toHaveBeenCalledWith('post', 'r5', 'root1', 'a1')
    expect(showToast).toHaveBeenCalledWith('success', 'Проведён')
    expect(openDialogAsPanel).toHaveBeenCalledWith(dialogEffect)
  })

  it('toggleDeletionMark: confirm с серверным текстом, отказ — без POST', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    handleRelatedCommand('related.toggleDeletionMark', {
      ...ctxProps,
      confirmMessageSet: 'Пометить?',
      confirmMessageUnset: 'Снять?',
    })
    await flush()
    expect(useConfirmStore.getState().open).toBe(true)
    expect(useConfirmStore.getState().message).toBe('Пометить?')
    useConfirmStore.getState().answer(false)
    await flush()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('toggleDeletionMark: у помеченной строки текст Unset, согласие — POST', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: true })
    handleRelatedCommand('related.toggleDeletionMark', {
      ...ctxProps,
      confirmMessageSet: 'Пометить?',
      confirmMessageUnset: 'Снять?',
    })
    await flush()
    expect(useConfirmStore.getState().message).toBe('Снять?')
    useConfirmStore.getState().answer(true)
    await flush()
    expect(mockPost).toHaveBeenCalledWith(
      'toggle-deletion-mark',
      'r5',
      'root1',
      'a1'
    )
  })
})
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/open-related-docs.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 4: Реализация**

```ts
import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewResponse } from '../types/view'
import {
  fetchRelatedDocsView,
  postRelatedDocsAction,
  type RelatedDocsAction,
} from '../api/related-docs-api'
import { openDialogAsPanel } from './open-dialog-panel'
import { useConfirmStore } from './stores/confirm-store'
import { useRelatedDocsStore } from './stores/related-docs-store'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

// Эффекты session-less ответов related-documents (бэк-спека §3.2–3.3):
// openDialog заменяет содержимое той же workspace-вкладки (tabKey/panelId
// пер-anchor), notify — тост. Зеркало open-movements.ts.
function applyEffects(res: ViewResponse): void {
  for (const effect of res.effects ?? []) {
    if (effect.type === 'openDialog') {
      openDialogAsPanel(effect)
    } else if (effect.type === 'notify') {
      showToast((effect.level as ToastLevel) ?? 'info', effect.message ?? '')
    }
  }
}

export async function openRelatedDocsForEntry(
  entryId: string,
  anchorId?: string
): Promise<void> {
  applyEffects(await fetchRelatedDocsView(entryId, anchorId))
}

interface RelatedCommandContext {
  anchorId: string
  rootId: string
  confirmMessageSet?: string
  confirmMessageUnset?: string
}

const ACTION_BY_COMMAND: Record<string, RelatedDocsAction> = {
  'related.post': 'post',
  'related.unpost': 'unpost',
  'related.toggleDeletionMark': 'toggle-deletion-mark',
}

const isRelatedCommand = (command: string): boolean =>
  command === 'related.refresh' ||
  command === 'related.setRoot' ||
  command in ACTION_BY_COMMAND

// Нет выделенной строки ⇒ notify, запрос не отправлять (бэк-спека §4.4).
// Маркеры обрыва в стор не попадают — их отсекает SubordinationTree.
function getSelection(anchorId: string) {
  const sel = useRelatedDocsStore.getState().selected[anchorId]
  if (!sel) {
    showToast('info', i18n.t('sdui.relatedDocs.noSelection'))
    return null
  }
  return sel
}

async function runAction(
  action: RelatedDocsAction,
  ctx: RelatedCommandContext
): Promise<void> {
  const sel = getSelection(ctx.anchorId)
  if (!sel) return
  if (action === 'toggle-deletion-mark') {
    // Подтверждение — нативный диалог с СЕРВЕРНЫМ текстом из props кнопки:
    // серверный эффект CONFIRM невыразим — у панели нет form-сессии
    const message = sel.isDeletionMarked
      ? ctx.confirmMessageUnset
      : ctx.confirmMessageSet
    if (message && !(await useConfirmStore.getState().ask(message))) return
  }
  applyEffects(
    await postRelatedDocsAction(action, sel.rowId, ctx.rootId, ctx.anchorId)
  )
}

// Перехват пяти команд тулбара «Связанных документов» (бэк-спека §4.4):
// транспорт фронтовый — HTTP-вызов вместо COMMAND в /api/view.
// true = команда наша (в том числе при некомплектных props — проглатываем,
// чтобы COMMAND без сессии не ушёл на бэк).
export function handleRelatedCommand(
  command: string,
  props: Record<string, unknown> | undefined
): boolean {
  if (!isRelatedCommand(command)) return false
  const anchorId = props?.anchorId
  const rootId = props?.rootId
  if (typeof anchorId !== 'string' || typeof rootId !== 'string') {
    if (import.meta.env.DEV) {
      console.warn(
        '[sdui] related-команда без anchorId/rootId в props',
        command
      )
    }
    return true
  }
  const ctx: RelatedCommandContext = {
    anchorId,
    rootId,
    confirmMessageSet: props?.confirmMessageSet as string | undefined,
    confirmMessageUnset: props?.confirmMessageUnset as string | undefined,
  }
  if (command === 'related.refresh') {
    void openRelatedDocsForEntry(ctx.rootId, ctx.anchorId)
    return true
  }
  if (command === 'related.setRoot') {
    const sel = getSelection(ctx.anchorId)
    if (sel) void openRelatedDocsForEntry(sel.rowId, ctx.anchorId)
    return true
  }
  void runAction(ACTION_BY_COMMAND[command], ctx)
  return true
}
```

- [ ] **Step 5: Прогнать тест**

Run: `npx vitest run src/features/sdui/lib/open-related-docs.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/lib/open-related-docs.ts src/features/sdui/lib/open-related-docs.test.ts src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: фронтовый транспорт команд связанных документов (SCRUM-301)"
```

---

### Task 6: Перехват `related.*` в `button-node.tsx`

**Files:**

- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx` (функция `handleClick`, строки 67–88)
- Test: `src/features/sdui/ui/nodes/action/button-node-related.test.tsx`

**Interfaces:**

- Consumes: `handleRelatedCommand(command, props)` (Task 5).
- Produces: клик по кнопке с командой `related.*` НЕ уходит в `dispatch`; все прочие команды — прежний путь.

- [ ] **Step 1: Написать падающий тест**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { handleRelatedCommand } from '../../../lib/open-related-docs'
import { ButtonNode } from './button-node'

const dispatchMock = vi.fn()
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))
vi.mock('../../../lib/open-related-docs', () => ({
  handleRelatedCommand: vi.fn(),
}))
vi.mock('../../../lib/overflow/overflow-context', () => ({
  useOverflowCollapsed: () => [],
}))
vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  useRefPickerSelection: () => null,
}))

const mockHandle = vi.mocked(handleRelatedCommand)

const btn = (command: string, props: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'btn.x',
    type: 'BUTTON',
    props: { label: 'Кнопка', command, ...props },
  }) as ViewNode

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ButtonNode перехват related.*', () => {
  it('перехваченная команда не диспатчится', () => {
    mockHandle.mockReturnValue(true)
    render(
      <ButtonNode
        node={btn('related.refresh', { anchorId: 'a1', rootId: 'r1' })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Кнопка' }))
    expect(mockHandle).toHaveBeenCalledWith(
      'related.refresh',
      expect.objectContaining({ anchorId: 'a1', rootId: 'r1' })
    )
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('чужая команда идёт прежним путём в dispatch', () => {
    mockHandle.mockReturnValue(false)
    render(<ButtonNode node={btn('form.save')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Кнопка' }))
    expect(dispatchMock).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'form.save' },
      null
    )
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node-related.test.tsx`
Expected: FAIL — первый кейс: `dispatchMock` вызван (перехвата нет).

- [ ] **Step 3: Реализация**

В `button-node.tsx` — импорт:

```tsx
import { handleRelatedCommand } from '../../../lib/open-related-docs'
```

В `handleClick`, после блока `isDropdown` и перед `if (command) {`-логикой dispatch:

```tsx
// SCRUM-301: команды панели связанных документов — фронтовый транспорт,
// COMMAND в /api/view не уходит (у панели нет form-сессии)
if (command && handleRelatedCommand(command, node.props)) return
```

- [ ] **Step 4: Прогнать тест + регресс кнопки**

Run: `npx vitest run src/features/sdui/ui/nodes/action`
Expected: PASS все (включая существующий `button-node-requires-row.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/action/button-node-related.test.tsx
git commit -m "feat: перехват related-команд в кнопке — HTTP вместо dispatch (SCRUM-301)"
```

---

### Task 7: Полный прогон тестов фичи и живая проверка

**Files:** без новых файлов.

- [ ] **Step 1: Полный прогон затронутых областей**

Run: `npx vitest run src/features/sdui src/pages/documents/document-redirect`
Expected: PASS все; никаких упавших соседних тестов.

- [ ] **Step 2: Живая проверка против дев-стенда (после выката бэка)**

`npm run dev`, документ типа `ЗаявкаНаРегистрациюГПСделки` (единственный SDUI-тип с цепочкой в дев-базе; дерево короткое — это данные, не код):

- панель «Связанные документы» — одно дерево: отступы, жирный текущий, иконки, `_status` в title;
- одиночный клик выделяет; двойной — открывает документ (роут `/documents/:typeCode/:entryId` редиректит в раздел);
- «Обновить» перерисовывает то же дерево; «Вывести для текущего» на выделенной строке меняет корень в той же вкладке (заголовок меняется);
- «Провести»/«Отменить проведение»/«Пометить на удаление»: тост + перестроенное дерево одним запросом; пометка — нативный confirm с серверным текстом; без выделения — тост «Выберите документ в дереве», запроса в network нет;
- панель жива после закрытия формы-родителя (workspace-вкладка остаётся, «Обновить» работает).

Если бэк ещё не выкачен — зафиксировать в отчёте, что живая проверка отложена, юнит-тесты зелёные.

- [ ] **Step 3: Commit (если были правки по итогам прогона)**

```bash
git add -A && git commit -m "fix: правки по живому прогону дерева связанных документов (SCRUM-301)"
```

---

## Самопроверка плана (выполнена)

- **Покрытие спеки:** §1–§3 дизайна → Tasks 2–6; блокер-роут → Task 1; иконки/жирный/отступ/обрыв → Task 4; confirm + no-selection → Task 5; «не делаем» (линии, гашение, «Найти», движения-баг) — задач нет намеренно.
- **Типы сквозные:** `RelatedDocsAction` (Task 2) = union путей POST; `RelatedDocsSelection` (Task 3) потребляется Task 4 (select) и Task 5 (getSelection); `handleRelatedCommand` (Task 5) — единственный интерфейс Task 6.
- **Плейсхолдеров нет:** каждый шаг несёт готовый код/команду.
