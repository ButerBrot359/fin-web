# Reference/Enum-ячейка в редактируемой ТЧ + `fullSnapshot` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ссылочные/enum-ячейки в редактируемых ТЧ рендерятся компактным автокомплитом (не `[object Object]`), а каждый table-level EVENT несёт `fullSnapshot: true`.

**Architecture:** Новый «глупый» компонент `ReferenceCellEditor` поверх существующих `useReferenceOptions`/`fetchReferenceOptions`; `renderCellValue`/`normalizeKey` выносятся в util `cell-value.ts` (разрыв потенциального цикла `table-cell-editor ↔ build-column-defs`); props колонки прокидываются от `TABLE_COLUMN`-ноды до ячейки через `TableColumnDef.props`.

**Tech Stack:** React 19, TypeScript, MUI (`AutocompleteInput` из `@/shared/ui/inputs`), SDUI-инфраструктура `src/features/sdui/`.

**Дизайн:** `docs/superpowers/specs/2026-07-13-sdui-reference-cell-design.md`
**Спека бэка:** `docs/superpowers/plans/frontend-spec-complex-tables-reference-cell.md`

## Global Constraints

- НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build` (CLAUDE.md; lint-staged сам отработает на коммите).
- Unit-тестов в проекте нет — TDD-циклы не применяются; проверка ручная (Task 6).
- Формат коммитов: `feat|fix|add|refactor: описание`.
- Не хардкодить строки в JSX (в этой фиче пользовательских текстов нет).
- Не использовать `useMemo`/`useCallback` без явной perf-причины.
- Легаси-код (`src/features/form-renderer/` и пр.) не трогать — вся работа в SDUI-зоне + `src/features/sdui/types/`.
- Ветка `feat/sdui-reference-cell`, пуш в неё, PR не открывать.

---

### Task 1: Util `cell-value.ts` — вынос `renderCellValue`/`normalizeKey`

**Files:**
- Create: `src/features/sdui/lib/utils/cell-value.ts`
- Modify: `src/features/sdui/lib/utils/build-column-defs.ts:12-32` (удалить обе функции)
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx:21-24` (импорт)
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx:23-28` (импорт)

**Interfaces:**
- Consumes: ничего нового.
- Produces: `renderCellValue(value: unknown): string` и `normalizeKey(value: unknown): unknown` из `@/features/sdui/lib/utils/cell-value` (относительные импорты внутри слайса) — используются в Task 2, 3.

- [ ] **Step 1: Создать `src/features/sdui/lib/utils/cell-value.ts`**

Содержимое — дословный перенос из `build-column-defs.ts` (модуль без React-зависимостей):

```ts
/**
 * If value is an object with a `presentation` field, return it as string.
 * Otherwise return String(value ?? '').
 */
export function renderCellValue(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'presentation' in value) {
    return String((value as Record<string, unknown>).presentation ?? '')
  }
  return String(value ?? '')
}

/**
 * If value is an object with an `id` field, return the id.
 * Otherwise return value as-is.
 */
export function normalizeKey(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && 'id' in value) {
    return (value as Record<string, unknown>).id
  }
  return value
}
```

- [ ] **Step 2: Удалить обе функции из `build-column-defs.ts`**

Удалить строки 12-32 (функции `renderCellValue` и `normalizeKey` с их JSDoc). Сам `build-column-defs.ts` их не использует — импорт `cell-value.ts` в него добавлять НЕ нужно.

- [ ] **Step 3: Обновить импорт в `table-node.tsx`**

Было (строки 21-24):

```ts
import {
  nodeToTableColumnDef,
  renderCellValue,
} from '../../../lib/utils/build-column-defs'
```

Стало:

```ts
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import { renderCellValue } from '../../../lib/utils/cell-value'
```

- [ ] **Step 4: Обновить импорт в `complex-editable-table.tsx`**

Было (строки 23-28):

```ts
import {
  buildColumnDefs,
  extractAllLeafColumns,
  renderCellValue,
  normalizeKey,
} from '../../../lib/utils/build-column-defs'
```

Стало:

```ts
import {
  buildColumnDefs,
  extractAllLeafColumns,
} from '../../../lib/utils/build-column-defs'
import { renderCellValue, normalizeKey } from '../../../lib/utils/cell-value'
```

- [ ] **Step 5: Проверить, что других импортёров нет**

Run: `grep -rn "renderCellValue\|normalizeKey" src/ --include="*.ts" --include="*.tsx" | grep -v "cell-value"`
Expected: только `table-node.tsx` и `complex-editable-table.tsx` (импорт из `cell-value` + места использования), ноль упоминаний `build-column-defs` в связке с этими функциями.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/lib/utils/cell-value.ts src/features/sdui/lib/utils/build-column-defs.ts src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "refactor: вынос renderCellValue/normalizeKey в cell-value.ts"
```

---

### Task 2: `formatReadonlyValue` и default-ветка — объектные значения через `renderCellValue`

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx:68-86` (`formatReadonlyValue`), `:175-180` (default-ветка switch)

**Interfaces:**
- Consumes: `renderCellValue` из Task 1.
- Produces: readonly- и default-отображение ячеек показывает `presentation` для `{id, presentation}`-значений (нужно для acceptance-критерия 2: скрытый readonly-ключ `VychetIPN` в `GrafikVycheta`).

- [ ] **Step 1: Добавить импорт в `table-cell-editor.tsx`**

После существующих импортов (строка 7):

```ts
import { renderCellValue } from '../../../lib/utils/cell-value'
```

- [ ] **Step 2: Обработка объектных значений в `formatReadonlyValue`**

Добавить проверку **до** `switch (dataType)` и заменить `default`-ветку:

```ts
function formatReadonlyValue(value: unknown, dataType: string): string {
  if (value == null || value === '') return ''
  // Ссылочные/enum значения {id, presentation} — показываем presentation
  if (typeof value === 'object' && 'presentation' in value) {
    return renderCellValue(value)
  }
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return String(value)
    case 'INTEGER':
    case 'DECIMAL':
      return formatWithSpaces(String(value))
    case 'DATE':
      return typeof value === 'string' ? formatDate(value) : ''
    case 'DATETIME':
      return typeof value === 'string' ? formatDateTime(value) : ''
    case 'BOOLEAN':
      return value ? '✓' : ''
    default:
      return renderCellValue(value)
  }
}
```

- [ ] **Step 3: default-ветка `switch (cellWidget)` через `renderCellValue`**

Было (строки 175-180):

```tsx
default:
  return (
    <span style={{ padding: '4px 8px', fontSize: 14 }}>
      {String(value ?? '')}
    </span>
  )
```

Стало:

```tsx
default:
  return (
    <span style={{ padding: '4px 8px', fontSize: 14 }}>
      {renderCellValue(value)}
    </span>
  )
```

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-cell-editor.tsx
git commit -m "fix: presentation вместо [object Object] в readonly и default ячейках ТЧ"
```

---

### Task 3: Компонент `ReferenceCellEditor`

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx`

**Interfaces:**
- Consumes: `useReferenceOptions(fetcher, resetKey)` из `../../../lib/hooks/use-reference-options` (без изменений); `fetchReferenceOptions({url, params, search})` из `../../../api/reference-options` (без изменений); `renderCellValue` из Task 1; `AutocompleteInput` из `@/shared/ui/inputs`.
- Produces: `ReferenceCellEditor: FC<ReferenceCellEditorProps>` с пропсами `{ colProps: Record<string, unknown>; value: unknown; onChange: (value: unknown) => void; onCommit: () => void }` — используется в Task 4.

- [ ] **Step 1: Создать `reference-cell-editor.tsx`**

Полное содержимое файла:

```tsx
import { useState, type FC } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { renderCellValue } from '../../../lib/utils/cell-value'

// Тот же legacy-фолбэк, что в ReferenceFieldNode (двухветочный источник,
// отклонение D-2 ревизии SDUI): приоритет optionsSource с бэка.
const DOMAIN_PATH_MAP: Record<string, string> = {
  DICTIONARY: 'dictionary-entries',
  DOCUMENT: 'document-entries',
  ACCOUNT_PLAN: 'account-plan',
}

interface ReferenceCellEditorProps {
  colProps: Record<string, unknown>
  value: unknown
  onChange: (value: unknown) => void
  onCommit: () => void
}

// Компактная стилизация под ячейку ТЧ — по образцу cellSx/dateCellSx
// из table-cell-editor.tsx (прозрачный фон, без рамки, высота 28px).
const wrapperSx: SxProps<Theme> = {
  width: '100%',
  '& .MuiFormControl-root': { mb: 0, position: 'static' },
  '& .MuiFilledInput-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    padding: '0 8px !important',
  },
  '& .MuiAutocomplete-input': {
    padding: '4px 0 !important',
    fontSize: '14px !important',
  },
}

interface CellReferenceValue {
  id: number | string
  presentation?: unknown
}

function isReferenceValue(value: unknown): value is CellReferenceValue {
  return value !== null && typeof value === 'object' && 'id' in value
}

function toSelectOption(value: unknown): SelectOption | null {
  if (!isReferenceValue(value)) return null
  return {
    id: Number(value.id),
    code: String(value.id),
    label: renderCellValue(value),
  }
}

export const ReferenceCellEditor: FC<ReferenceCellEditorProps> = ({
  colProps,
  value,
  onChange,
  onCommit,
}) => {
  const optionsSource = colProps.optionsSource as
    | { url: string; params?: Record<string, string> }
    | undefined
  const domain = (colProps.domain as string | undefined) ?? 'DICTIONARY'
  const targetTypeCode = colProps.targetTypeCode as string | undefined

  const domainPath = DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'
  const url = optionsSource
    ? optionsSource.url
    : targetTypeCode
      ? `/api/${domainPath}/${targetTypeCode}/entries`
      : null

  const resetKey = JSON.stringify(optionsSource?.params ?? null)

  const [inputValue, setInputValue] = useState('')

  const { options, loading, load, loadDebounced, resetOptions } =
    useReferenceOptions(
      (search?: string) =>
        url
          ? fetchReferenceOptions({ url, params: optionsSource?.params, search })
          : Promise.resolve([]),
      resetKey,
    )

  // ENUM-колонка без optionsSource и без фолбэка (нет targetTypeCode):
  // graceful-деградация — нейтральное отображение, не рабочий пикер без данных
  // (известный бэкенд-gap resolveEnumOptions, спека §1.3(d)).
  if (!url) {
    return (
      <span style={{ padding: '4px 8px', fontSize: 14 }}>
        {renderCellValue(value)}
      </span>
    )
  }

  const selectedOption = toSelectOption(value)

  const applySelected = (opt: SelectOption | null) => {
    // Полный ссылочный объект {id, presentation}, не bare id (спека §1.3(a), TODO-2)
    const newVal = opt ? { id: Number(opt.id), presentation: opt.label } : null
    onChange(newVal)
    resetOptions()
    onCommit()
  }

  return (
    <Box sx={wrapperSx}>
      <AutocompleteInput
        value={selectedOption}
        inputValue={inputValue}
        options={options}
        size="small"
        fullWidth
        loading={loading}
        onInputChange={(_e, val, reason) => {
          setInputValue(val)
          if (reason === 'input') loadDebounced(val)
        }}
        onOpen={() => {
          if (options.length === 0) load()
        }}
        onChange={applySelected}
      />
    </Box>
  )
}
```

Примечания для реализующего:
- Хуки (`useState`, `useReferenceOptions`) вызываются ДО раннего `return` при `!url` — rules of hooks соблюдены.
- Никаких `onShowAll`/`onAdd`/`endAction`/`label` — в ячейке ТЧ только выбор из дропдауна (спека §1.3(a), «Вне scope»).
- Выбор → `onChange` + сразу `onCommit` — тот же паттерн, что `DATE_FIELD`/`CHECKBOX_FIELD` в `table-cell-editor.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx
git commit -m "add: ReferenceCellEditor — компактный пикер для ячейки ТЧ"
```

---

### Task 4: Прокидка props колонки и ветки `REFERENCE_FIELD`/`ENUM_FIELD`

**Files:**
- Modify: `src/features/sdui/lib/hooks/use-table-sync.ts:11-20` (`TableColumnDef`)
- Modify: `src/features/sdui/lib/utils/build-column-defs.ts` (`nodeToTableColumnDef`, оба `createElement(TableCellEditor, ...)`)
- Modify: `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx` (интерфейс пропсов, новые cases)

**Interfaces:**
- Consumes: `ReferenceCellEditor` из Task 3.
- Produces: `TableColumnDef.props: Record<string, unknown>`; `TableCellEditorProps.props?: Record<string, unknown>` — сквозной путь `TABLE_COLUMN.props` → ячейка.

- [ ] **Step 1: Поле `props` в `TableColumnDef` (`use-table-sync.ts`)**

```ts
export interface TableColumnDef {
  id: string
  label: string
  binding: string
  flex?: number | string
  cellWidget: string
  dataType: string
  readonly?: boolean
  required?: boolean
  props: Record<string, unknown>
}
```

- [ ] **Step 2: Заполнить `props` в `nodeToTableColumnDef` (`build-column-defs.ts`)**

```ts
export function nodeToTableColumnDef(node: ViewNode): TableColumnDef {
  const props = node.props ?? {}
  return {
    id: node.id,
    label: (props.label as string | undefined) ?? '',
    binding: node.binding ?? (props.binding as string | undefined) ?? node.id,
    flex: props.flex as number | string | undefined,
    cellWidget: (props.cellWidget as string | undefined) ?? 'TEXT_FIELD',
    dataType: (props.dataType as string | undefined) ?? 'STRING',
    readonly: (props.readonly as boolean | undefined) ?? false,
    required: (props.required as boolean | undefined) ?? false,
    props,
  }
}
```

- [ ] **Step 3: Передать `props` в оба `createElement(TableCellEditor, ...)` (`build-column-defs.ts`)**

Ветка `TABLE_COLUMN` (строки 63-76) — добавить `props: col.props`:

```ts
cell: (info: CellContext<TableRow, unknown>) =>
  createElement(TableCellEditor, {
    cellWidget: col.cellWidget,
    dataType: col.dataType,
    value: info.row.original[col.binding],
    readonly: col.readonly,
    props: col.props,
    onChange: (val: unknown) =>
      syncRef.current?.updateCell(
        info.row.original.rowId,
        col.binding,
        val,
      ),
    onCommit: () => syncRef.current?.commitCell(),
  }),
```

Ветка VERTICAL-группы (строки 101-117) — добавить `props: childCol.props`:

```ts
return createElement(TableCellEditor, {
  key: childCol.id,
  cellWidget: childCol.cellWidget,
  dataType: childCol.dataType,
  value: info.row.original[childCol.binding],
  readonly: childCol.readonly,
  props: childCol.props,
  onChange: (val: unknown) =>
    syncRef.current?.updateCell(
      info.row.original.rowId,
      childCol.binding,
      val,
    ),
  onCommit: () => syncRef.current?.commitCell(),
})
```

- [ ] **Step 4: Проп `props` и новые cases в `table-cell-editor.tsx`**

Импорт (рядом с импортом `renderCellValue` из Task 2):

```ts
import { ReferenceCellEditor } from './reference-cell-editor'
```

Интерфейс и деструктуризация:

```ts
interface TableCellEditorProps {
  cellWidget: string
  dataType: string
  value: unknown
  readonly?: boolean
  props?: Record<string, unknown>
  onChange: (value: unknown) => void
  onCommit: () => void
}
```

```tsx
export const TableCellEditor: FC<TableCellEditorProps> = ({
  cellWidget,
  dataType,
  value,
  readonly,
  props,
  onChange,
  onCommit,
}) => {
```

Новые cases в `switch (cellWidget)` — между `case 'CHECKBOX_FIELD'` и `default`:

```tsx
case 'REFERENCE_FIELD':
case 'ENUM_FIELD':
  return (
    <ReferenceCellEditor
      colProps={props ?? {}}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
    />
  )
```

- [ ] **Step 5: Проверить остальных создателей `TableColumnDef`**

Run: `grep -rn "TableColumnDef" src/features/sdui --include="*.ts" --include="*.tsx"`
Expected: единственное место конструирования — `nodeToTableColumnDef` (остальные — импорты типа). Если найдётся другой объектный литерал `TableColumnDef` — добавить туда `props: {}`.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/lib/hooks/use-table-sync.ts src/features/sdui/lib/utils/build-column-defs.ts src/features/sdui/ui/nodes/composite/table-cell-editor.tsx
git commit -m "feat: REFERENCE_FIELD/ENUM_FIELD ячейки в редактируемой ТЧ"
```

---

### Task 5: `fullSnapshot: true` на table-level EVENT

**Files:**
- Modify: `src/features/sdui/types/view.ts:19-26` (`ViewAction`)
- Modify: `src/features/sdui/lib/hooks/use-table-sync.ts:147-165` (`sendEvent`)

**Interfaces:**
- Consumes: ничего нового.
- Produces: каждый dispatch из `sendEvent` несёт `fullSnapshot: true` (единственная точка отправки table-level `change` EVENT — покрывает commitCell, addRow, deleteRow, moveRow, coalesced commit).

- [ ] **Step 1: Поле в `ViewAction` (`types/view.ts`)**

```ts
export interface ViewAction {
  type: ActionType
  sourceNodeId?: string
  trigger?: string
  command?: string
  value?: unknown
  layoutCode?: string
  // Маркер полноты снимка строк ТЧ на table-level EVENT (спека reference-cell §2.2):
  // true = полный массив, бэк может делать full-replace (включая пустой [] = удалить все)
  fullSnapshot?: boolean
}
```

- [ ] **Step 2: Флаг в `sendEvent` (`use-table-sync.ts`)**

```ts
const sendEvent = (rows: TableRow[]) => {
  inFlightRef.current = true
  void dispatch({
    type: 'EVENT',
    sourceNodeId: node.id,
    trigger: 'change',
    value: rows,
    // rows здесь всегда полный локальный снимок (ADR-0011 §3.4) — маркер безусловный
    fullSnapshot: true,
  }).then((ok) => {
    if (ok) return
    // Ошибка сети/сервера: canon не придёт — снимаем in-flight и роняем flush,
    // иначе таблица зависает «в полёте» и save молча теряет строки.
    inFlightRef.current = false
    dirtyRef.current = new Map()
    needsCoalescedCommitRef.current = false
    flushRejectRef.current?.(new Error('table commit failed'))
    flushResolveRef.current = null
    flushRejectRef.current = null
  })
}
```

Per-field EVENT (`fireServerEvent` в `use-field-node`) и COMMAND — НЕ трогать: флаг только для table-level.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/types/view.ts src/features/sdui/lib/hooks/use-table-sync.ts
git commit -m "feat: fullSnapshot true на table-level EVENT редактируемых ТЧ"
```

---

### Task 6: Пуш и ручная проверка acceptance-критериев

**Files:** нет изменений кода.

- [ ] **Step 1: Пуш ветки**

```bash
git push -u origin feat/sdui-reference-cell
```

Expected: ветка `feat/sdui-reference-cell` на origin. PR НЕ открывать.

- [ ] **Step 2: Ручная проверка (требует запущенного `npm run dev` и бэка)**

Прувпойнт: документ `RegistratsiyaZayavleniyPoVychetamIPN`.

1. Ячейка `VychetIPN` в ТЧ `VychetyIPN` — автокомплит (не `[object Object]`), опции грузятся из `optionsSource`; выбор сохраняется, table-level EVENT в network-табе несёт `{id, presentation}`; значение видно после перечитывания формы.
2. `presentation` везде: выбранное значение в инпуте, readonly-ячейка (`VychetIPN` в `GrafikVycheta` с `readonly:true`) — нигде нет `[object Object]`.
3. Footer `Razmer` в `GrafikVycheta` (`footer:true`) виден при открытии формы — регрессии нет.
4. `ENUM_FIELD`-колонка без `optionsSource` — не падает, нейтральное отображение значения.
5. Любой table-level `change` EVENT в network-табе несёт `"fullSnapshot": true`.
6. Удаление последней строки ТЧ → EVENT `{ "value": [], "fullSnapshot": true }`.

Результаты сообщить пользователю; расхождения — фиксить до пуша фиксов в ту же ветку.
