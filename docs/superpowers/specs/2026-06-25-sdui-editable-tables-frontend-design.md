# Frontend Design: Редактируемые таблицы в SDUI

- **Дата:** 2026-06-25
- **Статус:** Approved (Phase 1 implemented)
- **Основа:** [ADR-0011](../plans/ADR-0011-sdui-editable-tables.md), [frontend-impl-tables.md](../plans/frontend-impl-tables.md)
- **Scope:** Phase 1 — примитивные колонки (TEXT_FIELD, NUMBER_FIELD, DATE_FIELD, CHECKBOX_FIELD). Прувпойнт — ТЧ «График платежей».

---

## 1. Принятые решения

| Решение | Выбор | Обоснование |
|---|---|---|
| Состояние строк | `useState<Row[]>` (без RHF) | Консистентно с паттерном SDUI-узлов (`number-field-node` и др.), не тащит RHF в SDUI-слой |
| Тулбар | Новый компонент внутри `features/sdui` | FSD: слайсы одного уровня не импортируют друг друга; легаси не трогаем |
| Легаси `form-renderer/` | Не модифицируем | Вся старая система на нём; параллельное существование |
| Декомпозиция | По ответственности (5 модулей) | Coalescing изолирован в хуке, cell-editor расширяем для Phase 2 |
| Cell-widget | По `cellWidget` из props (бэк резолвит), не из `dataType` | ADR-0011 §2.5.1 — `dataType` только для форматирования |

---

## 2. Структура файлов

```
src/features/sdui/
├── ui/nodes/composite/
│   ├── table-node.tsx              # Точка входа: editable vs read-only ветка
│   ├── editable-table.tsx          # Каркас: локальный массив, TanStack Table, тулбар
│   ├── table-cell-editor.tsx       # cellWidget → controlled input (shared/ui)
│   └── table-toolbar.tsx           # Add/Delete/MoveUp/MoveDown
├── lib/
│   ├── hooks/
│   │   └── use-table-sync.ts      # Coalescing, dirty-снимок, commit, flush
│   └── pending-table-commits.ts   # Реестр pending commits для flush-before-save
```

---

## 3. Интерфейсы

### 3.1 TableColumnDef (расширение extractColumns)

```typescript
interface TableColumnDef {
  id: string              // node.id TABLE_COLUMN-узла
  label: string           // заголовок
  binding: string         // attrCode колонки (ключ в строке)
  flex?: number | string
  cellWidget: string      // 'TEXT_FIELD' | 'NUMBER_FIELD' | 'DATE_FIELD' | 'CHECKBOX_FIELD'
  dataType: string        // 'STRING' | 'INTEGER' | 'DECIMAL' | 'DATE' — для форматирования
  readonly?: boolean      // вычисляемая колонка
  required?: boolean
}
```

### 3.2 TableRow (без изменений)

```typescript
interface TableRow {
  rowId: string
  [key: string]: unknown
}
```

### 3.3 TableCellEditorProps

```typescript
interface TableCellEditorProps {
  cellWidget: string
  dataType: string
  value: unknown
  readonly?: boolean
  onChange: (value: unknown) => void   // локальный echo
  onCommit: () => void                 // blur/Tab/Enter → триггер EVENT
}
```

### 3.4 UseTableSyncResult

```typescript
interface UseTableSyncResult {
  rows: TableRow[]
  updateCell: (rowId: string, binding: string, value: unknown) => void
  commitCell: () => void
  addRow: (columns: TableColumnDef[]) => void
  deleteRow: (index: number) => void
  moveRow: (from: number, to: number) => void
  flushPending: () => Promise<void>
}
```

---

## 4. Компоненты

### 4.1 table-node.tsx — оркестратор

Точка входа (зарегистрирована в component-registry). Логика:

- Читает `node.props.editable` (default `true`)
- `editable === false` → текущий read-only рендер (MUI Table, as-is)
- `editable !== false` → `<EditableTable node={node} />`
- `extractColumns` расширяется: читает `cellWidget`, `dataType`, `readonly`, `required` из `col.props`

### 4.2 editable-table.tsx — editable-каркас

Получает `node` и `columns`. Использует `useTableSync` для данных и операций.

- Рендерит `<TableToolbar>` сверху (если `allowAdd` / `allowReorder` / `allowDelete`)
- Рендерит TanStack Table (`useReactTable` + `getCoreRowModel`)
- `getRowId: (row) => row.rowId` — стабильная идентичность строк
- Для каждой ячейки рендерит `<TableCellEditor>` с `onChange` → `updateCell` и `onCommit` → `commitCell`
- `readonly`-колонки — display-only через `formatCellValue`
- Выбор строки: `selectedIndex` (useState) для enable/disable кнопок тулбара

### 4.3 table-cell-editor.tsx — редактор ячейки

Чистый презентационный свитч. Никакой бизнес-логики, никаких зависимостей между ячейками.

| `cellWidget` | Компонент из `shared/ui/inputs` |
|---|---|
| `TEXT_FIELD` | `TextInput` |
| `NUMBER_FIELD` | `NumberInput` (decimal = dataType === 'DECIMAL') |
| `DATE_FIELD` | `DateTimeInput` (dateOnly = true) |
| `DATETIME_FIELD` | `DateTimeInput` (dateOnly = false) |
| `CHECKBOX_FIELD` | MUI `Checkbox` |

Стили ячеек — compact (аналог `tableCellSx` из легаси).

`onChange` → мгновенный echo. `onCommit` → вызывается на blur / Enter / Tab.

Phase 2: добавятся `ENUM_FIELD` и `REFERENCE_FIELD` — новые case в свитче, без правок остальных компонентов.

### 4.4 table-toolbar.tsx — тулбар

Собственный компонент (~50 строк). Props:

```typescript
interface TableToolbarProps {
  onAdd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
}
```

Использует `shared/ui/buttons/Button` и MUI-иконки. Кнопки скрываются если соответствующий `allow*` = false.

---

## 5. Хук use-table-sync — coalescing и sync

### 5.1 Входы/выходы

```typescript
function useTableSync(
  node: ViewNode,
  columns: TableColumnDef[],
): UseTableSyncResult
```

Внутри: `useSduiSession()` для `getValue/setValue`, `useSduiDispatch()` для EVENT.

### 5.2 Состояние

- `localRows: TableRow[]` (`useState`) — то, что видит пользователь
- `inFlightRef: useRef<boolean>` — один in-flight table-EVENT на ТЧ
- `dirtyRef: useRef<Map<string, Record<string, unknown>>>` — `Map<rowId, {binding: rawValue}>`, накопленные правки во время in-flight

### 5.3 Жизненный цикл правки

1. **`updateCell(rowId, binding, value)`** — обновляет `localRows` (echo). Вызывает `session.setValue(node.binding, updatedRows)` для dirty-tracking (звёздочка вкладки).
2. **`commitCell()`** — если нет in-flight: dispatch EVENT с полным массивом, поднять `inFlightRef`. Если in-flight: записать текущие правки в `dirtyRef`.
3. **Ответ сервера** — `useEffect` на `getValue(node.binding)`:
   - Серверный канон → новая база `localRows`
   - Re-apply `dirtyRef` поверх: для каждого rowId из dirty переносим сырые значения трогнутых ячеек; `readonly`-колонки берём из канона
   - `inFlightRef = false`
   - Если `dirtyRef` непустой → сразу `commitCell()` (коалесцированный commit)

### 5.4 Row CRUD

- **`addRow(columns)`** — генерирует пустую строку с `rowId = "tmp-" + crypto.randomUUID()`, значения по умолчанию по `dataType` (`'' / 0 / false / null`). Добавляет в конец `localRows`. Вызывает `commitCell()`.
- **`deleteRow(index)`** — удаляет по индексу из `localRows`. Вызывает `commitCell()`.
- **`moveRow(from, to)`** — переставляет строку. Вызывает `commitCell()`.

### 5.5 Формат EVENT

```typescript
dispatch({
  type: 'EVENT',
  sourceNodeId: node.id,   // id TABLE-узла
  trigger: 'change',
  value: localRows,        // ПОЛНЫЙ массив
})
```

### 5.6 flushPending

Для flush-before-save. Если есть uncommitted-правки или dirty-снимок — форсит commit и возвращает Promise, который resolves после ответа сервера. Если ничего pending — resolves мгновенно.

---

## 6. Flush-before-save

### 6.1 Реестр (`pending-table-commits.ts`)

Module-level Map (паттерн как `panelStack` в `dispatch.ts`):

```typescript
const registry = new Map<string, () => Promise<void>>()

export function registerPendingFlush(binding: string, flush: () => Promise<void>): void
export function unregisterPendingFlush(binding: string): void
export async function flushAllPendingTableCommits(): Promise<void>
// вызывает все flush из реестра параллельно и ждёт
```

### 6.2 Интеграция

- `use-table-sync` при монтировании: `registerPendingFlush(node.binding, flushPending)`; при размонтировании: `unregisterPendingFlush(node.binding)`.
- `dispatch.ts` перед save-командами (строка ~197): `await flushAllPendingTableCommits()` перед `viewTransport.post`.

Единственная правка в `dispatch.ts` — одна строка `await`.

---

## 7. Обработка серверных патчей от шапки

Поле шапки меняется → бэк присылает `setValue(tableCode, rows)` → `setFromServer` обновляет view-state → `useEffect` на `getValue(node.binding)` в `use-table-sync` срабатывает → та же логика: канон + re-apply dirty. Не завязано на «свой in-flight».

---

## 8. rowId

- Сохранённые строки: `rowId = String(documentEntry.id)` (от сервера)
- Новые: `rowId = "tmp-" + crypto.randomUUID()` (фронт генерирует)
- `getRowId` в TanStack Table: `(row) => row.rowId` — стабильная идентичность
- После save: бэк возвращает `setValue(tableCode, rows)` с реальными rowId → `useEffect` применяет replace → `tmp-` исчезают

---

## 9. Инварианты

1. **Фронт НЕ вычисляет.** Никаких формул, пересчётов, валидаций. Только echo ввода + dispatch.
2. **EVENT всегда с ПОЛНЫМ массивом.** Усечённый массив → silent data loss на бэке.
3. **Один in-flight на ТЧ.** Правки во время in-flight → dirty-снимок → coalescing.
4. **cellWidget определяет редактор, dataType — только форматирование.**
5. **rowId стабилен** между правками/reorder. Меняется только при save (бэк переназначает).
6. **Save форсит flush** всех pending table-commits.

---

## 10. Scope Phase 1 / Phase 2

| Phase 1 (этот spec) | Phase 2 (отдельно) |
|---|---|
| TEXT_FIELD, NUMBER_FIELD, DATE_FIELD, CHECKBOX_FIELD | ENUM_FIELD, REFERENCE_FIELD |
| Inline edit + commit-on-blur | Ссылочные ячейки + drawer-выбор |
| Add/Delete/Reorder | Групповые операции / «Заполнить» |
| Coalescing + dirty-снимок | — |
| Flush-before-save | — |
| Прувпойнт: ГрафикПлатежей (4 примитивных колонки) | Другие ТЧ с ссылочными колонками |
