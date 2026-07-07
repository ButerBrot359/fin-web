# Инвалидация кэша опций reference-field + COLUMN_GROUP в ReadOnlyTable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Две SDUI-правки: (1) новая запись справочника появляется в дропдауне ссылочного поля без перезагрузки страницы; (2) read-only таблица рендерит двухуровневую шапку для `COLUMN_GROUP` (ДЕБЕТ/КРЕДИТ в движениях).

**Architecture:** Правка 1 — сброс локального кэша опций (`setOptions([])`) в `applySelected`; следующий `onOpen` перезапросит список. Правка 2 — `extractReadOnlyColumns` рекурсивно собирает листья `COLUMN_GROUP`, новый `buildHeaderModel` строит `{hasGroups, topRow, bottomRow}` с `colSpan`/`rowSpan`; без групп DOM байт-в-байт как сейчас. Никакой бизнес-логики: структуру решает бэк, фронт механически считает листья.

**Tech Stack:** React 19, TypeScript strict, MUI, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-07-ref-cache-and-readonly-colgroup-design.md`

## Global Constraints

- Ветка: `chore/sdui-docs-cleanup-and-review` (правки в ней, по решению пользователя).
- Затронутые src-файлы ТОЛЬКО: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`, `src/features/sdui/ui/nodes/composite/table-node.tsx` (+ их новые test-файлы).
- Strict TS (`strict`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`): type-only импорты, без unused.
- Формат коммитов (commit-msg hook): `feat|fix|add|refactor: описание`.
- НЕ трогать существующие нарушения аудита в этих файлах (`addRow:${binding}`, `DOMAIN_PATH_MAP`, `canBrowse`) — они в отдельном плане.
- `npm run build` гнать один раз в конце (Task 3), не после каждого изменения.
- Тексты в JSX — только через i18n; в этих правках новых текстов нет (лейблы приходят от бэка).

---

### Task 1: Сброс кэша опций в reference-field после выбора/создания

**Files:**
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx:98-102` (функция `applySelected`)
- Test (create): `src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx`

**Interfaces:**
- Consumes: `useFieldNode` (`f.setValue`, `f.fireServerEvent`), локальный `setOptions` из `useState`.
- Produces: ничего нового наружу — поведенческое изменение: после `applySelected` кэш `options` пуст, следующий `onOpen` вызывает `fetchReferenceOptions` повторно.

**Контекст для исполнителя.** Ссылочное поле кэширует опции дропдауна в `useState` и перезапрашивает в `onOpen` только при `options.length === 0`. После создания записи из формы выбора значение выбирается (`applySelected` вызывается gateway-коллбэком `onSelect`), но кэш не сбрасывается — новой записи в списке нет до перезагрузки. Фикс: сбрасывать кэш в `applySelected`. Цена — максимум один лишний refetch при следующем открытии после обычного выбора.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ReferenceFieldNode } from './reference-field-node'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => mockDispatch }))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

vi.mock('../../../lib/reference-picker-gateway', () => ({
  openReferencePicker: vi.fn(),
}))

const fetchMock = vi.fn()
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: (...args: unknown[]) => fetchMock(...args),
}))

describe('ReferenceFieldNode — кэш опций', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue([{ id: 1, code: '1', label: 'Запись 1' }])
    delete state.ref
  })

  it('после выбора значения кэш сбрасывается и следующий onOpen перезапрашивает опции', async () => {
    const node = {
      id: 'f1',
      type: 'REFERENCE_FIELD',
      binding: 'ref',
      props: { label: 'Ссылка', optionsSource: { url: '/api/test-options' } },
    } as unknown as ViewNode

    render(<ReferenceFieldNode node={node} />)
    const input = screen.getByRole('combobox')

    // Первое открытие: кэш пуст → запрос №1
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(await screen.findByText('Запись 1')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Выбор значения → applySelected (должен сбросить кэш опций)
    fireEvent.click(screen.getByText('Запись 1'))

    // Повторное открытие: кэш снова пуст → запрос №2
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx`
Expected: FAIL — `fetchMock` вызван 1 раз вместо 2 (кэш не сбрасывается, `onOpen` видит непустой список).

- [ ] **Step 3: Минимальная реализация**

В `reference-field-node.tsx`, функция `applySelected` (~строка 98) — добавить `setOptions([])`:

```ts
const applySelected = (opt: SelectOption | null) => {
  const newVal = opt ? fromSelectOption(opt) : null
  f.setValue(newVal)
  // Сброс локального кэша опций: следующий onOpen перезапросит свежий список,
  // и запись, созданная из формы выбора, появится без перезагрузки страницы.
  setOptions([])
  f.fireServerEvent('change', newVal)
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx`
Expected: PASS.

- [ ] **Step 5: Прогнать все тесты (регресс)**

Run: `npx vitest run`
Expected: все зелёные.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/ui/nodes/fields/reference-field-node.tsx src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx
git commit -m "fix: сброс кэша опций ссылочного поля после выбора — новая запись видна без перезагрузки"
```

---

### Task 2: Двухуровневая шапка COLUMN_GROUP в ReadOnlyTable

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx` (хелперы `extractReadOnlyColumns`, новые `collectLeafColumns`/`buildHeaderModel`, рендер `ReadOnlyTable`)
- Test (create): `src/features/sdui/ui/nodes/composite/table-node.test.ts`

**Interfaces:**
- Consumes: `nodeToTableColumnDef(node: ViewNode): TableColumnDef` из `../../../lib/utils/build-column-defs` (уже читает `node.binding ?? props.binding ?? node.id`), тип `ViewNode` из `../../../types/view`.
- Produces (экспортируются из `table-node.tsx` для тестов):
  - `extractReadOnlyColumns(children: ViewNode[] | undefined): ReadOnlyColumnDef[]` — листовые колонки в порядке документа (рекурсивно через группы); `ReadOnlyColumnDef = { id: string; label: string; binding?: string; flex?: number | string }`.
  - `buildHeaderModel(children: ViewNode[] | undefined): HeaderModel`, где `HeaderModel = { hasGroups: boolean; topRow: HeaderCell[]; bottomRow: HeaderCell[] }`, `HeaderCell = { id: string; label: string; colSpan?: number; rowSpan?: number; align?: 'center' }`.

**Контекст для исполнителя.** Бэк присылает read-only TABLE (`editable=false`) с детьми — смесь плоских `TABLE_COLUMN` и `COLUMN_GROUP` (props: `label`, `orientation: 'HORIZONTAL'`; children: `TABLE_COLUMN`). Данные строк плоские (ключи = binding листьев), группировка чисто презентационная. Сейчас `extractReadOnlyColumns` фильтрует только `TABLE_COLUMN` — колонки внутри групп выпадают. Editable-путь НЕ трогать (он уже маршрутизируется в `ComplexEditableTable` при группах, table-node.tsx:70-88).

**Инвариант обратной совместимости:** без `COLUMN_GROUP` в детях `hasGroups=false`, второй ряд шапки не рендерится, `colSpan`/`rowSpan` = `undefined` — DOM идентичен текущему.

- [ ] **Step 1: Написать падающие тесты**

Создать `src/features/sdui/ui/nodes/composite/table-node.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { buildHeaderModel, extractReadOnlyColumns } from './table-node'

const col = (id: string, label: string, binding: string): ViewNode =>
  ({ id, type: 'TABLE_COLUMN', props: { label, binding } }) as unknown as ViewNode

const group = (id: string, label: string, children: ViewNode[]): ViewNode =>
  ({
    id,
    type: 'COLUMN_GROUP',
    props: { label, orientation: 'HORIZONTAL' },
    children,
  }) as unknown as ViewNode

const flatChildren = [col('c1', 'Период', '_period'), col('c2', 'Сумма', '_summa')]

const groupedChildren = [
  col('c1', 'Период', '_period'),
  group('g.dt', 'ДЕБЕТ', [
    col('c2', 'Счёт', '_accountDtCode'),
    col('c3', 'ФКР', '_fkrDt'),
  ]),
  group('g.kt', 'КРЕДИТ', [col('c4', 'Счёт', '_accountKtCode')]),
  col('c5', 'Сумма', '_summa'),
]

describe('extractReadOnlyColumns', () => {
  it('плоские TABLE_COLUMN — как раньше', () => {
    expect(extractReadOnlyColumns(flatChildren).map((c) => c.binding)).toEqual([
      '_period',
      '_summa',
    ])
  })

  it('рекурсивно собирает листья COLUMN_GROUP в порядке документа', () => {
    expect(extractReadOnlyColumns(groupedChildren).map((c) => c.binding)).toEqual([
      '_period',
      '_accountDtCode',
      '_fkrDt',
      '_accountKtCode',
      '_summa',
    ])
  })

  it('undefined children → пустой массив', () => {
    expect(extractReadOnlyColumns(undefined)).toEqual([])
  })
})

describe('buildHeaderModel', () => {
  it('без групп: hasGroups=false, один ряд, colSpan/rowSpan не проставлены', () => {
    const m = buildHeaderModel(flatChildren)
    expect(m.hasGroups).toBe(false)
    expect(m.bottomRow).toEqual([])
    expect(m.topRow.map((c) => c.label)).toEqual(['Период', 'Сумма'])
    expect(m.topRow.every((c) => c.colSpan === undefined && c.rowSpan === undefined)).toBe(true)
  })

  it('с группами: группа → colSpan=числу листьев (по центру), плоская колонка → rowSpan=2, листья → нижний ряд', () => {
    const m = buildHeaderModel(groupedChildren)
    expect(m.hasGroups).toBe(true)
    expect(m.topRow).toEqual([
      { id: 'c1', label: 'Период', rowSpan: 2 },
      { id: 'g.dt', label: 'ДЕБЕТ', colSpan: 2, align: 'center' },
      { id: 'g.kt', label: 'КРЕДИТ', colSpan: 1, align: 'center' },
      { id: 'c5', label: 'Сумма', rowSpan: 2 },
    ])
    expect(m.bottomRow.map((c) => c.label)).toEqual(['Счёт', 'ФКР', 'Счёт'])
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: FAIL — `buildHeaderModel` не экспортируется (нет такой функции), рекурсивный кейс `extractReadOnlyColumns` возвращает без листьев групп.

- [ ] **Step 3: Реализация хелперов**

В `table-node.tsx` заменить `extractReadOnlyColumns` (строки 36-51) на:

```ts
/** Рекурсивно собирает листовые TABLE_COLUMN (включая вложенные в COLUMN_GROUP) в порядке документа. */
function collectLeafColumns(node: ViewNode): ViewNode[] {
  if (node.type === 'TABLE_COLUMN') return [node]
  if (node.type === 'COLUMN_GROUP') return (node.children ?? []).flatMap(collectLeafColumns)
  return []
}

export function extractReadOnlyColumns(
  children: ViewNode[] | undefined,
): ReadOnlyColumnDef[] {
  if (!children) return []
  return children.flatMap(collectLeafColumns).map((c) => {
    const col = nodeToTableColumnDef(c)
    return {
      id: col.id,
      label: col.label,
      binding: col.binding,
      flex: col.flex,
    }
  })
}

interface HeaderCell {
  id: string
  label: string
  colSpan?: number
  rowSpan?: number
  align?: 'center'
}

interface HeaderModel {
  hasGroups: boolean
  topRow: HeaderCell[]
  bottomRow: HeaderCell[]
}

/**
 * Модель двухрядной шапки read-only таблицы.
 * COLUMN_GROUP → ячейка верхнего ряда (colSpan = число листьев), листья → нижний ряд.
 * Плоский TABLE_COLUMN при наличии групп → rowSpan=2.
 * Без групп colSpan/rowSpan не проставляются — DOM идентичен прежнему рендеру.
 */
export function buildHeaderModel(children: ViewNode[] | undefined): HeaderModel {
  const nodes = children ?? []
  const hasGroups = nodes.some((c) => c.type === 'COLUMN_GROUP')
  const topRow: HeaderCell[] = []
  const bottomRow: HeaderCell[] = []

  for (const node of nodes) {
    if (node.type === 'TABLE_COLUMN') {
      const col = nodeToTableColumnDef(node)
      topRow.push({
        id: col.id,
        label: col.label,
        ...(hasGroups ? { rowSpan: 2 } : {}),
      })
    } else if (node.type === 'COLUMN_GROUP') {
      const leaves = collectLeafColumns(node)
      topRow.push({
        id: node.id,
        label: (node.props?.label as string | undefined) ?? '',
        colSpan: leaves.length,
        align: 'center',
      })
      for (const leaf of leaves) {
        const col = nodeToTableColumnDef(leaf)
        bottomRow.push({ id: col.id, label: col.label })
      }
    }
  }

  return { hasGroups, topRow, bottomRow }
}
```

Примечание: `toEqual` в тестах сравнивает объекты без учёта отсутствующих ключей vs `undefined`-значений, поэтому спред `...(hasGroups ? { rowSpan: 2 } : {})` и ожидание `{ id: 'c1', label: 'Период', rowSpan: 2 }` совместимы; для кейса без групп тест проверяет `c.rowSpan === undefined` — тоже совместимо.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: PASS (все 5 тестов).

- [ ] **Step 5: Рендер двухрядной шапки в ReadOnlyTable**

В `ReadOnlyTable` (table-node.tsx) добавить после `const columns = extractReadOnlyColumns(node.children)`:

```ts
const headerModel = buildHeaderModel(node.children)
```

Заменить текущий `<TableHead>` (строки 148-155):

```tsx
<TableHead>
  <TableRow>
    {headerModel.topRow.map((cell) => (
      <TableCell
        key={cell.id}
        colSpan={cell.colSpan}
        rowSpan={cell.rowSpan}
        align={cell.align}
      >
        {cell.label}
      </TableCell>
    ))}
    {allowDelete && (
      <TableCell
        padding="checkbox"
        rowSpan={headerModel.hasGroups ? 2 : undefined}
      />
    )}
  </TableRow>
  {headerModel.hasGroups && (
    <TableRow>
      {headerModel.bottomRow.map((cell) => (
        <TableCell key={cell.id}>{cell.label}</TableCell>
      ))}
    </TableRow>
  )}
</TableHead>
```

Тело таблицы (`TableBody`, рендер строк через `columns` + `renderCellValue`) НЕ меняется — `columns` теперь включает листья групп в порядке документа, ключи данных строк плоские. `colSpan` пустого состояния (`columns.length + (allowDelete ? 1 : 0)`) остаётся корректным — это число листовых колонок.

- [ ] **Step 6: Прогнать все тесты (регресс)**

Run: `npx vitest run`
Expected: все зелёные.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/table-node.test.ts
git commit -m "feat: двухуровневая шапка COLUMN_GROUP в read-only SDUI-таблице"
```

---

### Task 3: Финальная проверка — build и визуальная приёмка

**Files:** нет изменений кода (только проверки).

**Interfaces:**
- Consumes: результаты Task 1 и Task 2.
- Produces: зелёный `npm run build`, визуальное подтверждение через Playwright, отчёт пользователю для ручной приёмки.

- [ ] **Step 1: Полный build (strict typecheck)**

Run: `npm run build`
Expected: `tsc -b` без ошибок, vite build успешен.

- [ ] **Step 2: Lint затронутых файлов**

Run: `npx eslint src/features/sdui/ui/nodes/fields/reference-field-node.tsx src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: без ошибок (warnings `react-hooks/exhaustive-deps` допустимы — оценить, но не блокер).

- [ ] **Step 3: Визуальная проверка через Playwright (основная сессия, не сабагент)**

Предусловие: бэк на `http://92.38.49.213:31880` эмитит `COLUMN_GROUP` для движений регистра бухгалтерии. Если группы не приходят — таблица рендерится плоской, это корректно; зафиксировать и сообщить пользователю.

1. Запустить `npm run dev` (в фоне).
2. Открыть документ с ДтКт-движениями (напр. Заявка ГП / Поступление от контрагента), вкладка движений регистра бухгалтерии: шапка двухуровневая — «ДЕБЕТ»/«КРЕДИТ» по центру сверху, под-колонки снизу, плоские колонки (Период, Организация, Сумма, …) спанят обе строки; ячейки показывают `presentation`, не `[object Object]`.
3. Регресс: открыть read-only таблицу без групп (движения регистра накопления/сведений) — одноуровневая шапка, без пустого второго ряда.
4. Кэш опций: у ссылочного поля с «Создать» создать запись → сохранить → снова открыть дропдаун → новая запись в списке без перезагрузки.
5. Остановить dev-сервер.

- [ ] **Step 4: Отчёт пользователю для ручной приёмки**

Сообщить результаты по чек-листу handoff (build, кэш опций, шапка ДтКт, регресс плоских таблиц, presentation в ячейках) и передать на ручную визуальную приёмку.
