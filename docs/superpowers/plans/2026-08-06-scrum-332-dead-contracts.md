# SCRUM-332 — Dead contracts (Поступление от контрагента) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть 3 фронт-дефекта документа «Поступление от контрагента»: (1) «Скопировать» в ТЧ шлёт rowId, (2) readonly-перечисление без стрелки раскрытия, (3) пикер ячейки с `rowFilter` сужается по `__rowParentIds`.

**Architecture:** Три независимых фикса в SDUI. Общий класс — бэк кладёт данные на провод, фронт не читает. Бэк-правок нет.

**Tech Stack:** React 19, TypeScript, MUI, TanStack Table, Vitest + React Testing Library, react-i18next.

## Global Constraints

- Design-док: `docs/superpowers/specs/2026-08-06-scrum-332-dead-contracts-design.md`.
- Только SDUI (`src/features/sdui/`); легаси не трогать; бэк-правок нет.
- **Матчеры — только нативные vitest** (`.toBe/.toBeTruthy/.toBeNull/.toHaveBeenCalledWith/.toEqual`, `queryBy*`→`null`). Проект НЕ использует `@testing-library/jest-dom`; НЕ добавлять его, НЕ трогать `vitest.config.ts`/`package.json`.
- НЕ запускать `tsc`/`lint`/`build` пошагово. Тест целевого файла: `npx vitest run <path>`. **Перед завершением ветки — обязательно `npm run build` (tsc -b + vite) до exit 0** (tsc -b строже tsc --noEmit).
- Формат коммита (хук): `feat|fix|add|refactor: описание`. lint-staged гоняет ESLint/Prettier на коммите.
- П.1: НЕ добавлять ключ `value` в action, когда строка не выбрана (спред-форма) — иначе ломаются существующие toolbar-тесты, ассертящие `{type, command}` без `value`.
- Значения строк/параметров приводить к строке (`String(...)`); пустое/отсутствующее → параметр опускать.

## File Structure

**П.1 (Task 1):**

- Modify: `src/features/sdui/ui/nodes/composite/table-toolbar.tsx` (проп `selectedRowId`, `runCommand`)
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx` (передать selectedRowId)
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx` (передать selectedRowId)
- Modify: `src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx` (2 кейса)

**П.2 (Task 2):**

- Modify: `src/features/sdui/ui/nodes/fields/enum-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx`

**П.3 (Task 3):**

- Create: `src/features/sdui/lib/utils/resolve-row-filter-params.ts` + `.test.ts`
- Modify: `src/features/sdui/lib/utils/build-column-defs.ts` (flat + vertical cell → extraParams)
- Modify: `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx` (проп extraParams → ReferenceCellEditor)
- Modify: `src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx` (мерж extraParams в params)
- Modify: `src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx` (1 кейс)
- ObjectCellEditor — вне скоупа (rowFilter сегодня только у REFERENCE-колонки `vidVNA`; добавить при появлении OBJECT-колонки с rowFilter).

---

### Task 1: «Скопировать» шлёт выбранный rowId (Вариант A)

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/table-toolbar.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx`
- Test: `src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx`

**Interfaces:**

- Produces: `TableToolbar` получает опциональный `selectedRowId?: string | null`.

- [ ] **Step 1: Добавить падающие тесты в `table-toolbar.test.tsx`**

Добавить внутрь `describe('TableToolbar: доменные кнопки из tableCommands (SCRUM-302)', …)` (фикстура `podbor` и `baseProps` уже есть в файле):

```tsx
it('клик по команде при выбранной строке → value: {rowId}', () => {
  render(
    <TableToolbar
      {...baseProps}
      commands={[podbor]}
      selectedRowId="27855679-3"
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Подбор' }))
  expect(mockDispatch).toHaveBeenCalledWith(
    {
      type: 'COMMAND',
      command: 'table.podbor:VychetyIPN',
      value: { rowId: '27855679-3' },
    },
    { flushPendingTables: false, resetsDirty: false, closeAfter: false }
  )
})

it('без выбранной строки → ключа value нет', () => {
  render(<TableToolbar {...baseProps} commands={[podbor]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Подбор' }))
  expect(mockDispatch).toHaveBeenCalledWith(
    { type: 'COMMAND', command: 'table.podbor:VychetyIPN' },
    { flushPendingTables: false, resetsDirty: false, closeAfter: false }
  )
})
```

- [ ] **Step 2: Убедиться, что первый тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx`
Expected: тест «при выбранной строке» FAIL (value не отправляется); «без строки» PASS.

- [ ] **Step 3: Реализовать в `table-toolbar.tsx`**

В `TableToolbarProps` добавить:

```ts
  selectedRowId?: string | null
```

В деструктуризацию пропов добавить `selectedRowId = null,`.
Заменить `runCommand`:

```ts
const runCommand = (cmd: TableCommandDescriptor) => {
  void dispatch(
    {
      type: 'COMMAND',
      command: cmd.command,
      // rowId нужен построчным командам (table.copyRow); сервер читает его
      // через extractRowId только у них, прочие игнорируют (SCRUM-332 §1).
      // Спред, а не value:undefined — иначе ключ value ломает прежние тесты.
      ...(selectedRowId ? { value: { rowId: selectedRowId } } : {}),
    },
    cmd.behavior
  )
}
```

- [ ] **Step 4: Прокинуть selectedRowId из рендереров**

`complex-editable-table.tsx` — в JSX `<TableToolbar … />` добавить проп:

```tsx
selectedRowId = { selectedRowId }
```

(`selectedRowId` — существующий стейт компонента.)

`editable-table.tsx` — в JSX `<TableToolbar … />` добавить проп:

```tsx
          selectedRowId={
            selectedIndex != null
              ? (sync.rows[selectedIndex]?.rowId ?? null)
              : null
          }
```

(`selectedIndex` — существующий стейт; `sync.rows` — из useTableSync.)

- [ ] **Step 5: Тесты зелёные + нет регрессий по папке**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx`
Expected: PASS (оба новых + прежние).
Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/table-toolbar.tsx \
  src/features/sdui/ui/nodes/composite/complex-editable-table.tsx \
  src/features/sdui/ui/nodes/composite/editable-table.tsx \
  src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx
git commit -m "fix: TCH command panel sends selected rowId (copy row) (SCRUM-332)"
```

---

### Task 2: readonly `ENUM_FIELD` без стрелки раскрытия

**Files:**

- Modify: `src/features/sdui/ui/nodes/fields/enum-field-node.tsx`
- Test: `src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx`

**Interfaces:**

- Consumes: `useFieldNode` (существующий), MUI `Select`.

- [ ] **Step 1: Написать падающий тест (новый файл)**

```tsx
// src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { EnumFieldNode } from './enum-field-node'

const state: Record<string, unknown> = {}
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const options = [
  { value: 'a', label: 'Опция A' },
  { value: 'b', label: 'Опция B' },
]
const node = (readonly: boolean): ViewNode => ({
  id: 'field.vidOperatsii',
  type: 'ENUM_FIELD',
  binding: 'VidOperatsii',
  props: { label: 'Вид операции', options, readonly },
})

afterEach(cleanup)

describe('EnumFieldNode readonly', () => {
  it('readonly → без иконки раскрытия', () => {
    const { container } = render(<EnumFieldNode node={node(true)} />)
    expect(container.querySelector('.MuiSelect-icon')).toBeNull()
  })
  it('editable → иконка раскрытия есть', () => {
    const { container } = render(<EnumFieldNode node={node(false)} />)
    expect(container.querySelector('.MuiSelect-icon')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx`
Expected: тест readonly FAIL (иконка рисуется всегда).

- [ ] **Step 3: Реализовать в `enum-field-node.tsx`**

В `<Select …>` добавить проп (после `readOnly={f.readonly}`):

```tsx
        IconComponent={f.readonly ? () => null : undefined}
```

- [ ] **Step 4: Тест зелёный + папка полей без регрессий**

Run: `npx vitest run src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx`
Expected: PASS.
Run: `npx vitest run src/features/sdui/ui/nodes/fields/`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/fields/enum-field-node.tsx \
  src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx
git commit -m "fix: hide dropdown arrow on readonly ENUM_FIELD (SCRUM-332)"
```

---

### Task 3: пикер ячейки с `rowFilter` сужается по `__rowParentIds`

**Files:**

- Create: `src/features/sdui/lib/utils/resolve-row-filter-params.ts`
- Test: `src/features/sdui/lib/utils/resolve-row-filter-params.test.ts`
- Modify: `src/features/sdui/lib/utils/build-column-defs.ts`
- Modify: `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx`
- Test: `src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx`

**Interfaces:**

- Produces: `resolveRowFilterParams(col: TableColumnDef, row: TableRow): Record<string, string>`
- `TableCellEditor` получает опциональный `extraParams?: Record<string, string>`.
- `ReferenceCellEditor` получает опциональный `extraParams?: Record<string, string>`.

- [ ] **Step 1: Написать падающий тест хелпера**

```ts
// src/features/sdui/lib/utils/resolve-row-filter-params.test.ts
import { describe, it, expect } from 'vitest'
import { resolveRowFilterParams } from './resolve-row-filter-params'
import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'

const col = (overrides: Partial<TableColumnDef>): TableColumnDef => ({
  id: 'table.osnovnyeSredstva.col.vidVNA',
  label: 'Вид ВНА',
  binding: 'VidVNA',
  cellWidget: 'REFERENCE_FIELD',
  dataType: 'DICTIONARY',
  props: {},
  ...overrides,
})

describe('resolveRowFilterParams', () => {
  it('rowFilter + __rowParentIds[binding] → {parent: String(value)}', () => {
    const c = col({ props: { rowFilter: { parent: 'OsnovnoeSredstvo' } } })
    const row: TableRow = { rowId: '1', __rowParentIds: { VidVNA: 4711 } }
    expect(resolveRowFilterParams(c, row)).toEqual({ parent: '4711' })
  })
  it('нет rowFilter → {}', () => {
    const row: TableRow = { rowId: '1', __rowParentIds: { VidVNA: 4711 } }
    expect(resolveRowFilterParams(col({}), row)).toEqual({})
  })
  it('нет ключа в __rowParentIds → {}', () => {
    const c = col({ props: { rowFilter: { parent: 'OsnovnoeSredstvo' } } })
    expect(resolveRowFilterParams(c, { rowId: '1' })).toEqual({})
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/utils/resolve-row-filter-params.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать хелпер**

```ts
// src/features/sdui/lib/utils/resolve-row-filter-params.ts
import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'

/**
 * Параметры сужения пикера ячейки по per-row ключу `__rowParentIds` (SCRUM-332 §3).
 * `col.props.rowFilter = { <paramName>: <sourceCol> }` объявляет ИМЯ query-параметра;
 * готовое значение бэк кладёт в `row.__rowParentIds[col.binding]`. Нет rowFilter
 * или нет ключа (ОС не выбран) → `{}` (полный список, поведение прежнее).
 */
export function resolveRowFilterParams(
  col: TableColumnDef,
  row: TableRow
): Record<string, string> {
  const rowFilter = col.props.rowFilter as Record<string, string> | undefined
  if (!rowFilter) return {}
  const paramName = Object.keys(rowFilter)[0]
  if (!paramName) return {}
  const parentIds = row.__rowParentIds as Record<string, unknown> | undefined
  const value = parentIds?.[col.binding]
  if (value == null) return {}
  return { [paramName]: String(value) }
}
```

- [ ] **Step 4: Хелпер зелёный**

Run: `npx vitest run src/features/sdui/lib/utils/resolve-row-filter-params.test.ts`
Expected: PASS.

- [ ] **Step 5: `ReferenceCellEditor` принимает и мержит `extraParams`**

В `reference-cell-editor.tsx`:

- в `interface ReferenceCellEditorProps` добавить `extraParams?: Record<string, string>`.
- в деструктуризацию пропов добавить `extraParams,`.
- заменить строку с `params`:

```ts
const params = {
  ...resolveOptionsParams(optionsSource?.params, () => undefined),
  ...extraParams,
}
```

(`resetKey = JSON.stringify(params)` ниже уже считается по `params` — смена ОС перезапросит опции.)

- [ ] **Step 6: Тест мержа в `reference-cell-editor.test.tsx`**

Добавить кейс (фикстуры `fetchMock` уже настроены в файле — `beforeEach` резолвит опции):

```tsx
it('extraParams уходят в запрос опций (сужение по __rowParentIds)', async () => {
  render(
    <ReferenceCellEditor
      colProps={{
        optionsSource: { url: '/api/dictionary-entries/VidyVNA/entries' },
      }}
      extraParams={{ parent: '4711' }}
      value={null}
      onChange={vi.fn()}
      onCommit={vi.fn()}
    />
  )
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
  await screen.findByText('ИПН 10%')
  expect(fetchMock).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({ parent: '4711' }),
    })
  )
})
```

- [ ] **Step 7: `TableCellEditor` прокидывает `extraParams` в `ReferenceCellEditor`**

В `table-cell-editor.tsx`:

- в `interface TableCellEditorProps` добавить `extraParams?: Record<string, string>`.
- в деструктуризацию добавить `extraParams,`.
- в ветке `case 'REFERENCE_FIELD':` в `<ReferenceCellEditor …>` добавить проп `extraParams={extraParams}`.
  (ObjectCellEditor не трогаем — см. границы.)

- [ ] **Step 8: `buildColumnDefs` вычисляет и передаёт `extraParams`**

В `build-column-defs.ts`:

- импорт: `import { resolveRowFilterParams } from './resolve-row-filter-params'`
- плоская ячейка (`createElement(TableCellEditor, { … })`) — добавить поле:

```ts
            extraParams: resolveRowFilterParams(col, info.row.original),
```

- ячейка VERTICAL-группы (дочерний `createElement(TableCellEditor, { … })`) — добавить:

```ts
                    extraParams: resolveRowFilterParams(childCol, info.row.original),
```

- [ ] **Step 9: Все тесты Task 3 зелёные + нет регрессий**

Run: `npx vitest run src/features/sdui/lib/utils/resolve-row-filter-params.test.ts src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx`
Expected: PASS.
Run: `npx vitest run src/features/sdui/lib src/features/sdui/ui/nodes/composite/`
Expected: PASS.

- [ ] **Step 10: Коммит**

```bash
git add src/features/sdui/lib/utils/resolve-row-filter-params.ts \
  src/features/sdui/lib/utils/resolve-row-filter-params.test.ts \
  src/features/sdui/lib/utils/build-column-defs.ts \
  src/features/sdui/ui/nodes/composite/table-cell-editor.tsx \
  src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx \
  src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx
git commit -m "feat: consume __rowParentIds to narrow rowFilter cell picker (SCRUM-332)"
```

---

## Self-Review

**Spec coverage:**

- §1 copy rowId (Вариант A) → Task 1 (toolbar runCommand + оба рендерера + тесты). ✓
- §2 readonly enum arrow → Task 2. ✓
- §3 \_\_rowParentIds/rowFilter → Task 3 (helper + buildColumnDefs flat+vertical + TableCellEditor + ReferenceCellEditor + тесты). ✓
- Вариант B не делаем (бэк не шлёт activate) — зафиксировано в дизайне. ✓
- ObjectCellEditor вне скоупа — зафиксировано (нет OBJECT-колонки с rowFilter). ✓

**Placeholder scan:** плейсхолдеров нет; весь код приведён.

**Type consistency:** `resolveRowFilterParams(col: TableColumnDef, row: TableRow): Record<string,string>`; `TableToolbar.selectedRowId?: string|null`; `TableCellEditor.extraParams?` / `ReferenceCellEditor.extraParams?: Record<string,string>` — согласованы. `TableColumnDef`/`TableRow` импортируются из `../hooks/use-table-sync` (там же они определены).

## Границы

- Только SDUI; бэк-правок нет.
- П.1 rowId цепляется к любой ТЧ-команде при выбранной строке (сервер читает только у построчных).
- П.3 — только ComplexEditableTable/`buildColumnDefs` и REFERENCE-ячейка; ObjectCellEditor и EditableTable-инлайн вне скоупа (нет таких колонок сегодня).
