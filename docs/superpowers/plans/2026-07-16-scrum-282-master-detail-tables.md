# SCRUM-282: Фиксы связанных таблиц ИПН — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Починить 5 багов master-detail таблиц документа «Регистрация заявлений по вычетам ИПН» (SCRUM-282): фильтрация связи, мёртвый save, колонка «№», ширина HSTACK, высота строк.

**Architecture:** Все изменения в зоне SDUI (`src/features/sdui/`). Реактивность выбора master-строки — через существующий `useBindingValue`. Чистая логика фильтрации выносится в утилиту. Guard на flush — центрально в `pending-table-commits.ts`.

**Tech Stack:** React 19, TypeScript, zustand, TanStack Table, MUI, vitest + @testing-library/react.

## Global Constraints

- Спека: `docs/superpowers/specs/2026-07-16-scrum-282-master-detail-tables-design.md`.
- Легаси не трогать; только `src/features/sdui/`.
- Тексты — через `useTranslation` и ключи `common.json` (ключ `table.rowNumber` уже существует).
- Формат коммитов: `feat|fix|add|refactor: описание` (commit-msg hook).
- НЕ запускать `tsc --noEmit` / `npm run lint` / `npm run build` (правило CLAUDE.md); тесты — `npx vitest run <путь>`.
- Ветка: `fix/scrum-282-svyazannye-tablicy`.

---

### Task 1: Guard-таймаут для flush перед save (#5)

**Files:**
- Modify: `src/features/sdui/lib/pending-table-commits.ts`
- Test: `src/features/sdui/lib/pending-table-commits.test.ts` (создать)

**Interfaces:**
- Consumes: ничего нового.
- Produces: `flushAllPendingTableCommits(): Promise<void>` — сигнатура не меняется; новое поведение: каждый flush резолвится максимум через `FLUSH_TIMEOUT_MS` (5000 мс), reject пробрасывается как раньше.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/pending-table-commits.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  registerPendingFlush,
  unregisterPendingFlush,
  flushAllPendingTableCommits,
} from './pending-table-commits'

describe('flushAllPendingTableCommits', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('резолвится по таймауту, если flush завис навсегда', async () => {
    vi.useFakeTimers()
    const token = registerPendingFlush(() => new Promise<void>(() => {}))
    const promise = flushAllPendingTableCommits()
    await vi.advanceTimersByTimeAsync(5000)
    await expect(promise).resolves.toBeUndefined()
    unregisterPendingFlush(token)
  })

  it('пробрасывает reject от flush (ошибка сети) раньше таймаута', async () => {
    const token = registerPendingFlush(() =>
      Promise.reject(new Error('table commit failed')),
    )
    await expect(flushAllPendingTableCommits()).rejects.toThrow(
      'table commit failed',
    )
    unregisterPendingFlush(token)
  })

  it('резолвится сразу, когда все flush завершились до таймаута', async () => {
    const token = registerPendingFlush(() => Promise.resolve())
    await expect(flushAllPendingTableCommits()).resolves.toBeUndefined()
    unregisterPendingFlush(token)
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/lib/pending-table-commits.test.ts`
Expected: FAIL — первый тест висит/падает по таймауту vitest (текущий flush без guard не резолвится).

- [ ] **Step 3: Реализация**

```ts
// src/features/sdui/lib/pending-table-commits.ts — полное содержимое
const registry = new Map<symbol, () => Promise<void>>()

// Предохранитель: если сервер не пришлёт canon для таблицы, flush не должен
// блокировать save бесконечно (SCRUM-282 #5) — по таймауту считаем завершённым.
const FLUSH_TIMEOUT_MS = 5000

function withTimeout(promise: Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, FLUSH_TIMEOUT_MS)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    )
  })
}

export function registerPendingFlush(flush: () => Promise<void>): symbol {
  const token = Symbol('pending-flush')
  registry.set(token, flush)
  return token
}

export function unregisterPendingFlush(token: symbol): void {
  registry.delete(token)
}

export async function flushAllPendingTableCommits(): Promise<void> {
  const flushes = [...registry.values()]
  await Promise.all(flushes.map((fn) => withTimeout(fn())))
}
```

- [ ] **Step 4: Запустить тесты — зелёные**

Run: `npx vitest run src/features/sdui/lib/pending-table-commits.test.ts src/features/sdui/lib/hooks/use-table-sync.test.tsx`
Expected: PASS (включая существующие тесты use-table-sync, которые используют flushAllPendingTableCommits).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/pending-table-commits.ts src/features/sdui/lib/pending-table-commits.test.ts
git commit -m "fix: таймаут-предохранитель flush перед save — save не виснет без canon (SCRUM-282)"
```

---

### Task 2: addRow с предустановленными значениями (#4c, хук)

**Files:**
- Modify: `src/features/sdui/lib/hooks/use-table-sync.ts`
- Test: `src/features/sdui/lib/hooks/use-table-sync.test.tsx`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `addRow(columns: TableColumnDef[], presetValues?: Record<string, unknown>): void` — presetValues мёржатся поверх пустой строки (включая скрытые/readonly колонки, т.к. ключ связи `visible:false, readonly:true`). Тип в `UseTableSyncResult` обновляется соответственно.

- [ ] **Step 1: Написать падающий тест** (добавить в конец `describe('useTableSync', ...)`)

```tsx
it('addRow с presetValues проставляет значения поверх пустой строки', () => {
  sessionState.rows = []
  const columns = [
    {
      id: 'c1',
      label: 'Вычет',
      binding: 'VychetIPN',
      cellWidget: 'TEXT',
      dataType: 'STRING',
      readonly: true,
      props: {},
    },
  ]
  const { result } = renderHook(() => useTableSync(node, columns))
  act(() => {
    result.current.addRow(columns, { VychetIPN: 'key-A' })
  })
  expect(result.current.rows).toHaveLength(1)
  expect(result.current.rows[0].VychetIPN).toBe('key-A')
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/lib/hooks/use-table-sync.test.tsx`
Expected: FAIL — `expected '' to be 'key-A'` (buildEmptyRow ставит пустую строку для STRING).

- [ ] **Step 3: Реализация**

В `UseTableSyncResult` заменить сигнатуру:

```ts
addRow: (columns: TableColumnDef[], presetValues?: Record<string, unknown>) => void
```

В `useTableSync` заменить `addRow`:

```ts
const addRow = (
  cols: TableColumnDef[],
  presetValues?: Record<string, unknown>,
) => {
  // presetValues — например, ключ связи master-detail (SCRUM-282 #4):
  // скрытая readonly-колонка иначе остаётся пустой и строка не матчится фильтром
  const newRow = { ...buildEmptyRow(cols), ...presetValues, }
  const next = [...localRowsRef.current, newRow]
  setLocalRows(next)
  localRowsRef.current = next
  if (node.binding) setValue(node.binding, next)
  if (inFlightRef.current) {
    // Record entire new row in dirty; coalesced commit will send on response
    const { rowId, ...rest } = newRow
    dirtyRef.current.set(rowId, rest)
    needsCoalescedCommitRef.current = true
  } else {
    // Clear pre-commit dirty before sending (localRowsRef already has typed values)
    dirtyRef.current = new Map()
    sendEvent(next)
  }
}
```

Важно: `rowId` из `buildEmptyRow` не должен перетираться presetValues — presetValues не содержит rowId по контракту (вызывающая сторона передаёт только колоночные значения). Spread-порядок `{ ...buildEmptyRow(cols), ...presetValues }` сохраняет tmp-rowId, т.к. presetValues его не содержит.

- [ ] **Step 4: Запустить тесты — зелёные**

Run: `npx vitest run src/features/sdui/lib/hooks/use-table-sync.test.tsx`
Expected: PASS, все тесты.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/hooks/use-table-sync.ts src/features/sdui/lib/hooks/use-table-sync.test.tsx
git commit -m "feat: addRow с presetValues — преднабивка ключа связи detail-строки (SCRUM-282)"
```

---

### Task 3: Утилита фильтрации master-detail (#4b, часть 1)

**Files:**
- Create: `src/features/sdui/lib/utils/master-detail.ts`
- Test: `src/features/sdui/lib/utils/master-detail.test.ts` (создать)

**Interfaces:**
- Consumes: `normalizeKey` из `./cell-value`, тип `TableRow` из `../hooks/use-table-sync`.
- Produces:

```ts
export function findSelectedMasterRow(
  masterRows: TableRow[] | undefined,
  selectedMasterRowId: string | undefined,
): TableRow | undefined

export function filterDetailRows(
  rows: TableRow[],
  selectedMasterRow: TableRow | undefined,
  masterKey: string,
  detailKey: string,
): TableRow[]
```

`filterDetailRows` возвращает `rows` без изменений, если `selectedMasterRow === undefined`; иначе фильтрует по `normalizeKey(row[detailKey]) === normalizeKey(selectedMasterRow[masterKey])`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/utils/master-detail.test.ts
import { describe, expect, it } from 'vitest'

import { filterDetailRows, findSelectedMasterRow } from './master-detail'

const masterRows = [
  { rowId: 'm1', VychetIPN: 'A' },
  { rowId: 'm2', VychetIPN: 'B' },
]
const detailRows = [
  { rowId: 'd1', VychetIPN: 'A' },
  { rowId: 'd2', VychetIPN: 'B' },
  { rowId: 'd3', VychetIPN: 'A' },
]

describe('findSelectedMasterRow', () => {
  it('находит master-строку по выбранному rowId', () => {
    expect(findSelectedMasterRow(masterRows, 'm2')).toEqual(masterRows[1])
  })

  it('возвращает undefined без выбора или без строк', () => {
    expect(findSelectedMasterRow(masterRows, undefined)).toBeUndefined()
    expect(findSelectedMasterRow(undefined, 'm1')).toBeUndefined()
    expect(findSelectedMasterRow(masterRows, 'нет-такого')).toBeUndefined()
  })
})

describe('filterDetailRows', () => {
  it('оставляет только строки с ключом выбранной master-строки', () => {
    const result = filterDetailRows(
      detailRows,
      masterRows[0],
      'VychetIPN',
      'VychetIPN',
    )
    expect(result.map((r) => r.rowId)).toEqual(['d1', 'd3'])
  })

  it('без выбранной master-строки возвращает все строки', () => {
    expect(
      filterDetailRows(detailRows, undefined, 'VychetIPN', 'VychetIPN'),
    ).toEqual(detailRows)
  })

  it('строка с пустым ключом не матчится', () => {
    const rows = [{ rowId: 'd4', VychetIPN: '' }]
    expect(
      filterDetailRows(rows, masterRows[0], 'VychetIPN', 'VychetIPN'),
    ).toEqual([])
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/lib/utils/master-detail.test.ts`
Expected: FAIL — модуль `./master-detail` не существует.

- [ ] **Step 3: Реализация**

```ts
// src/features/sdui/lib/utils/master-detail.ts
import type { TableRow } from '../hooks/use-table-sync'
import { normalizeKey } from './cell-value'

export function findSelectedMasterRow(
  masterRows: TableRow[] | undefined,
  selectedMasterRowId: string | undefined,
): TableRow | undefined {
  if (!selectedMasterRowId || !masterRows) return undefined
  return masterRows.find((r) => r.rowId === selectedMasterRowId)
}

export function filterDetailRows(
  rows: TableRow[],
  selectedMasterRow: TableRow | undefined,
  masterKey: string,
  detailKey: string,
): TableRow[] {
  if (!selectedMasterRow) return rows
  const masterKeyValue = normalizeKey(selectedMasterRow[masterKey])
  return rows.filter((row) => normalizeKey(row[detailKey]) === masterKeyValue)
}
```

- [ ] **Step 4: Запустить тесты — зелёные**

Run: `npx vitest run src/features/sdui/lib/utils/master-detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/utils/master-detail.ts src/features/sdui/lib/utils/master-detail.test.ts
git commit -m "feat: утилита фильтрации master-detail строк ТЧ (SCRUM-282)"
```

---

### Task 4: Реактивная фильтрация в ComplexEditableTable (#4b, часть 2)

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`

**Interfaces:**
- Consumes: `useBindingValue` из `../../../lib/sdui-session-context`; `findSelectedMasterRow`, `filterDetailRows` из `../../../lib/utils/master-detail`; `TableRow` из `../../../lib/hooks/use-table-sync`.
- Produces: переменные компонента `selectedMasterRow: TableRow | undefined` и `masterKeyValue: unknown` — их использует Task 5 (блокировка Add и преднабивка ключа).

Автотеста на реактивность нет (подписка zustand-селектором уже покрыта паттерном `useBindingValue`, фикс M1); чистая логика покрыта Task 3. Проверка — ручная приёмка в Task 9.

- [ ] **Step 1: Заменить импорты**

В `complex-editable-table.tsx`:

```tsx
import { useSduiSession, useBindingValue } from '../../../lib/sdui-session-context'
import {
  findSelectedMasterRow,
  filterDetailRows,
} from '../../../lib/utils/master-detail'
```

(строка `import { renderCellValue, normalizeKey } from '../../../lib/utils/cell-value'` — убрать `normalizeKey`, он больше не нужен в компоненте: `import { renderCellValue } from '../../../lib/utils/cell-value'`.)

- [ ] **Step 2: Заменить блок master-detail фильтрации**

Удалить текущий `visibleRows` useMemo (строки 79–108) и вставить:

```tsx
// ── Master-detail filtering ──
// Реактивные подписки (SCRUM-282 #4): getValue давал разовый снимок,
// detail не ре-рендерился при выборе master-строки.
const selectedMasterRowId = useBindingValue(
  isMasterDetail && masterTable ? masterTable + '.__selectedRowId' : undefined,
) as string | undefined
const masterRows = useBindingValue(
  isMasterDetail && masterTable ? masterTable : undefined,
) as TableRow[] | undefined

const selectedMasterRow = findSelectedMasterRow(masterRows, selectedMasterRowId)
const masterKeyValue =
  selectedMasterRow && masterKey ? selectedMasterRow[masterKey] : undefined

const visibleRows = useMemo<TableRow[]>(() => {
  if (!isMasterDetail || !masterKey || !detailKey) return sync.rows
  return filterDetailRows(sync.rows, selectedMasterRow, masterKey, detailKey)
}, [sync.rows, isMasterDetail, masterKey, detailKey, selectedMasterRow])
```

Импорт типа `TableRow` уже есть в файле (`import { useTableSync, type TableRow } from '../../../lib/hooks/use-table-sync'`).

- [ ] **Step 3: Запустить существующие тесты SDUI — ничего не сломано**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "fix: реактивная фильтрация detail-таблицы по выбору master-строки (SCRUM-282)"
```

---

### Task 5: Блокировка «Добавить» и преднабивка ключа в detail (#4c, компонент)

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-toolbar.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`

**Interfaces:**
- Consumes: `masterKeyValue`, `selectedMasterRow` из Task 4; `addRow(columns, presetValues?)` из Task 2.
- Produces: `TableToolbar` получает новый проп `canAdd?: boolean` (default `true`) — кнопка Add рендерится при `allowAdd`, но `disabled={!canAdd}`.

- [ ] **Step 1: TableToolbar — проп canAdd**

В `table-toolbar.tsx` добавить в интерфейс и параметры:

```tsx
interface TableToolbarProps {
  onAdd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canAdd?: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
}
```

В деструктуризации: `canAdd = true,`. Кнопка Add:

```tsx
{allowAdd && (
  <Button variant="primary" disabled={!canAdd} onClick={onAdd}>
    {t('table.add')}
  </Button>
)}
```

- [ ] **Step 2: ComplexEditableTable — прокинуть canAdd и preset**

В `complex-editable-table.tsx` заменить `handleAdd`:

```tsx
// Detail-таблица: новая строка сразу получает ключ связи выбранной master-строки;
// без выбранной master-строки добавление заблокировано (canAdd ниже) — как в 1С.
const handleAdd = () => {
  if (isMasterDetail && detailKey) {
    if (masterKeyValue === undefined) return
    sync.addRow(flatColumns, { [detailKey]: masterKeyValue })
    return
  }
  sync.addRow(flatColumns)
}
```

В JSX `TableToolbar` добавить проп:

```tsx
canAdd={!isMasterDetail || masterKeyValue !== undefined}
```

- [ ] **Step 3: Запустить тесты SDUI**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-toolbar.tsx src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "feat: преднабивка ключа связи и блокировка Add в detail-таблице без выбранного master (SCRUM-282)"
```

---

### Task 6: Колонка «№» в ComplexEditableTable (#2)

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`

**Interfaces:**
- Consumes: `node.props.showRowNumbers` (бэк шлёт `true` на обеих ТЧ ИПН); i18n-ключ `table.rowNumber` (уже существует, образец `editable-table.tsx:136`).
- Produces: ничего для других задач.

- [ ] **Step 1: Прочитать флаг**

После строки `const allowReorder = ...` добавить:

```tsx
const showRowNumbers = node.props?.showRowNumbers === true
```

- [ ] **Step 2: Шапка — ячейка «№» с rowSpan**

COLUMN_GROUP даёт 2 ряда header groups; «№» рендерится только в первом ряду с `rowSpan` на все ряды, чтобы группированная шапка не разъехалась:

```tsx
<TableHead>
  {table.getHeaderGroups().map((hg, hgIndex) => (
    <MuiTableRow key={hg.id}>
      {showRowNumbers && hgIndex === 0 && (
        <TableCell
          rowSpan={table.getHeaderGroups().length}
          sx={{ width: 48, textAlign: 'center', fontWeight: 600 }}
        >
          {t('table.rowNumber')}
        </TableCell>
      )}
      {hg.headers.map((header) =>
        header.isPlaceholder ? (
          <TableCell key={header.id} colSpan={header.colSpan} />
        ) : (
          <TableCell key={header.id} colSpan={header.colSpan}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </TableCell>
        ),
      )}
    </MuiTableRow>
  ))}
</TableHead>
```

- [ ] **Step 3: Тело — номер строки и colSpan пустого состояния**

Пустое состояние:

```tsx
<TableCell
  colSpan={leafColumnCount + (showRowNumbers ? 1 : 0)}
  align="center"
>
```

Строки — первой ячейкой:

```tsx
{showRowNumbers && (
  <TableCell sx={{ width: 48, textAlign: 'center', p: '4px 8px' }}>
    <Typography variant="body2" color="text.secondary">
      {index + 1}
    </Typography>
  </TableCell>
)}
```

(вставить перед `{row.getVisibleCells().map(...)}`.)

Футер (если есть): в `TableFooter` первую ячейку-заглушку добавить аналогично, чтобы колонки не съехали:

```tsx
<MuiTableRow key={fg.id}>
  {showRowNumbers && <TableCell />}
  {fg.headers.map((header) => {
```

- [ ] **Step 4: Запустить тесты SDUI**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "feat: колонка № в ComplexEditableTable по флагу showRowNumbers (SCRUM-282)"
```

---

### Task 7: HSTACK раздаёт детям ширину (#1)

**Files:**
- Modify: `src/features/sdui/ui/nodes/layout/hstack-node.tsx`
- Test: `src/features/sdui/ui/nodes/layout/hstack-node.test.tsx` (создать)

**Interfaces:**
- Consumes: `node.props.flex` ребёнка (опционально, с бэка сейчас не приходит — дефолт равное деление).
- Produces: каждый ребёнок HSTACK оборачивается в `<div style="flex: <child.props.flex ?? '1 1 0%'>; min-width: 0">`.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/ui/nodes/layout/hstack-node.test.tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { HStackNode } from './hstack-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <span data-testid={node.id} />
  ),
}))

const child = (id: string, flex?: number | string): ViewNode =>
  ({ id, type: 'TABLE', props: flex !== undefined ? { flex } : {} }) as ViewNode

describe('HStackNode', () => {
  it('оборачивает детей в контейнеры flex:1 minWidth:0 (равное деление)', () => {
    const node = {
      id: 'h1',
      type: 'HSTACK',
      props: {},
      children: [child('t1'), child('t2')],
    } as ViewNode
    const { getByTestId } = render(<HStackNode node={node} />)
    const wrapper = getByTestId('t1').parentElement as HTMLElement
    expect(wrapper.style.flex).toBe('1 1 0%')
    expect(wrapper.style.minWidth).toBe('0px')
    const wrapper2 = getByTestId('t2').parentElement as HTMLElement
    expect(wrapper2.style.flex).toBe('1 1 0%')
  })

  it('уважает props.flex ребёнка, если задан', () => {
    const node = {
      id: 'h2',
      type: 'HSTACK',
      props: {},
      children: [child('t3', 2), child('t4')],
    } as ViewNode
    const { getByTestId } = render(<HStackNode node={node} />)
    const wrapper = getByTestId('t3').parentElement as HTMLElement
    expect(wrapper.style.flexGrow).toBe('2')
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/layout/hstack-node.test.tsx`
Expected: FAIL — `parentElement` сейчас сам HSTACK-див, `style.flex` пустой.

- [ ] **Step 3: Реализация**

```tsx
// src/features/sdui/ui/nodes/layout/hstack-node.tsx — полное содержимое
import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const HStackNode: FC<NodeProps> = ({ node }) => {
  const gap = (node.props?.gap as number | undefined) ?? 0
  const justify = (node.props?.justify as string | undefined) ?? 'flex-start'
  const align = (node.props?.align as string | undefined) ?? 'stretch'
  const flex = node.props?.flex as number | string | undefined

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: gap * 4,
        justifyContent: justify,
        alignItems: align,
        flex: flex !== undefined ? flex : undefined,
      }}
    >
      {node.children?.map((c) => (
        // Равное деление ширины по умолчанию (SCRUM-282 #1): без flex дети
        // ужимаются до контента (таблицы «скомканы»). minWidth:0 обязателен,
        // иначе таблица не даёт контейнеру сжиматься и появляется h-скролл формы.
        <div
          key={c.id}
          style={{
            flex: (c.props?.flex as number | string | undefined) ?? '1 1 0%',
            minWidth: 0,
          }}
        >
          <NodeRenderer node={c} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Запустить тесты — зелёные**

Run: `npx vitest run src/features/sdui/ui/nodes/layout/hstack-node.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/layout/hstack-node.tsx src/features/sdui/ui/nodes/layout/hstack-node.test.tsx
git commit -m "fix: HSTACK раздаёт детям ширину — равное деление с minWidth 0 (SCRUM-282)"
```

---

### Task 8: Единая высота строк ComplexEditableTable (#3)

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`

**Interfaces:**
- Consumes: ничего нового.
- Produces: константа `ROW_HEIGHT` модуля; при ручной приёмке (Task 9) значение можно скорректировать.

- [ ] **Step 1: Константа и применение**

После импортов в `complex-editable-table.tsx`:

```tsx
// Единая высота строки для master-detail пары (SCRUM-282 #3): в ячейках VERTICAL-групп
// стопки редакторов разной высоты (checkbox+text vs date+date), без общей высоты
// строки таблицы разъезжаются. height на <tr> работает как min-height.
// Позже уедет в конфиг-сервис стилей.
const ROW_HEIGHT = 72
```

В body-строке добавить `height` в sx:

```tsx
<MuiTableRow
  key={row.id}
  hover
  selected={selectedIndex === index}
  onClick={() => handleRowClick(row.id, index)}
  sx={{ cursor: 'pointer', height: ROW_HEIGHT }}
>
```

- [ ] **Step 2: Запустить тесты SDUI**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "fix: единая высота строк ComplexEditableTable для master-detail пары (SCRUM-282)"
```

---

### Task 9: Полный прогон тестов и ручная приёмка

**Files:** без изменений кода (кроме возможной правки `ROW_HEIGHT`).

- [ ] **Step 1: Полный прогон vitest**

Run: `npm test`
Expected: PASS, без упавших.

- [ ] **Step 2: Ручная приёмка в браузере** (dev-сервер `npm run dev`, документ «Регистрация заявлений по вычетам ИПН», бэк `http://92.38.49.213:31880`)

Чек-лист из спеки бэкендера:
- #4: создать master-строки A и B; под A добавить свои detail-строки, под B — свои; переключение слева меняет набор справа; при невыбранной master-строке кнопка «Добавить» справа заблокирована; на save в каждой detail-строке уходит правильный `VychetIPN` (проверить в network-запросе COMMAND).
- #5: после добавления/правки строк «Записать»/«Провести» шлют `/api/view` и отрабатывают (не виснут).
- #2: слева и справа есть колонка «№», группированная шапка не разъехалась.
- #1: таблицы занимают ширину формы 50/50, без горизонтального скролла страницы.
- #3: строки левой и правой таблиц одинаковой высоты; если 72px мало/много — скорректировать `ROW_HEIGHT` и закоммитить `fix: высота строк ComplexEditableTable по итогам приёмки (SCRUM-282)`.

- [ ] **Step 3: Финализация**

Если приёмка прошла — работа по коду завершена; дальше по workflow: спека-отчёт для бэка в `specs-local/scrum-282-svyazannye-tablicy/` (v2-front), комментарий в Jira, перенос таски (по решению пользователя).
