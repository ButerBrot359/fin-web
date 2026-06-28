# Фронт-фикс: редактируемая SDUI-таблица теряет фокус ячейки (ввод по 1 символу)

> Для фронт-разработчика `fin-web`. Описывает баг, корень и **готовые правки** (2 файла) для редактируемых табличных частей SDUI (ADR-0011). Правки уже применены в рабочей копии; ниже — диффы, чтобы перенести/проверить у себя.
>
> Связано: [ADR-0011 — редактируемые ТЧ](../adr/ADR-0011-sdui-editable-tables.md) (§2.5.4 round-trip/оптимистичный эхо), [frontend-impl-tables.md](frontend-impl-tables.md).

---

## 1. Симптом

В редактируемой ТЧ (напр. «График платежей» в «Заявке на ГП-сделку») при вводе значения в ячейку **после первого же символа ячейка теряет фокус** — приходится заново кликать по ячейке и вводить следующий символ. Печатать нормально невозможно.

## 2. Затронутые файлы

| Файл | Что меняем |
|---|---|
| `src/features/sdui/lib/hooks/use-table-sync.ts` | убрать запись в session-стор на каждый символ в `updateCell` |
| `src/features/sdui/ui/nodes/composite/editable-table.tsx` | мемоизировать `tableColumns` + стабильные cell-колбэки через `syncRef` |

## 3. Анализ / корень

`TableCellEditor` для текстовых/числовых ячеек вызывает `onChange` **на каждый символ** (а `onCommit` — на blur/Enter). `onChange` → `sync.updateCell(...)`. Дальше две причины складываются:

1. **Посимвольная запись в общий стор.** `updateCell` на каждый символ вызывал `setValue(node.binding, next)` (запись в SDUI session-стор). Это меняло `canonRows = getValue(node.binding)`, из-за чего срабатывал `useEffect([canonRows])` внутри `useTableSync` → ещё один `setLocalRows` → дополнительный ре-рендер на каждый символ. (По дизайну ADR-0011 этот эффект должен реагировать **только на серверный canon**, а не на локальный ввод.)

2. **Пересоздание определений колонок.** `tableColumns` в `editable-table.tsx` строились заново (`columns.map(...)`) на **каждый** ре-рендер — новые объекты колонок и новые `cell`-функции. Для TanStack Table это сигнал перестроить колонки → ячейка-компонент (инпут) **ремонтируется** → нативный фокус теряется.

Итог: один символ → ре-рендер(ы) → пересозданные колонки → ремонт инпута → фокус слетел.

## 4. Фикс 1 — `use-table-sync.ts`: не писать в стор на каждый символ

В `updateCell` убрана строка `if (node.binding) setValue(node.binding, next)`. Правка ввода теперь **локальна** (`localRows`/`localRowsRef`); canon синхронизируется с сервером только на **commit** (blur/Enter → `commitCell` → EVENT → серверный `setValue`). Это и есть модель ADR-0011 §2.5.4: оптимистичный локальный эхо, canon — только от сервера.

```diff
   const updateCell = (rowId: string, binding: string, value: unknown) => {
     setLocalRows((prev) => {
       const next = prev.map((r) =>
         r.rowId === rowId ? { ...r, [binding]: value } : r,
       )
-      // Mark form dirty via session.setValue
-      if (node.binding) setValue(node.binding, next)
+      // НЕ пишем в session-стор на каждый символ. Запись canon (node.binding)
+      // меняла canonRows → срабатывал useEffect([canonRows]) → лишний ре-рендер;
+      // вместе с пересозданием колонок это ремонтило ячейку и сбрасывало фокус
+      // (баг «ввод по 1 символу»). Правка локальна (localRows); canon
+      // синхронизируется на commit (blur/Enter → EVENT → серверный setValue).
+      // ADR-0011: оптимистичный локальный эхо, canon — только от сервера.
       localRowsRef.current = next
       return next
     })

     // If in-flight, record in dirty snapshot
     if (inFlightRef.current) {
       const dirty = dirtyRef.current
       const existing = dirty.get(rowId) ?? {}
       dirty.set(rowId, { ...existing, [binding]: value })
     }
   }
```

Примечания:
- `setValue` остаётся импортированным/используемым — его по-прежнему вызывают `addRow`/`deleteRow`/`moveRow` (это не посимвольные действия, фокус-проблемы не создают). Unused-var не возникает.
- Отображение ячейки берётся из `sync.rows` (= `localRows`), который `updateCell` обновляет через `setLocalRows`, поэтому введённый символ виден сразу.

## 5. Фикс 2 — `editable-table.tsx`: мемоизировать колонки + стабильные колбэки

`tableColumns` оборачиваются в `useMemo([columns])`, чтобы определения колонок/`cell`-функций **не пересоздавались** при ре-рендере таблицы (ввод символа → `setLocalRows`). cell-колбэки берут актуальный `sync` через `syncRef.current` (иначе мемо захватил бы устаревший `sync`; методы `sync` читают refs, поэтому это безопасно).

### 5.1 Импорты

```diff
-import { useState, useEffect, type FC } from 'react'
+import { useState, useEffect, useMemo, useRef, type FC } from 'react'
```

### 5.2 Стабильная ссылка на sync (сразу после `const sync = useTableSync(...)`)

```diff
   const sync = useTableSync(node, columns)
+  // Стабильная ссылка на актуальный sync для мемоизированных cell-колбэков:
+  // без неё useMemo(tableColumns) захватил бы устаревший sync. Методы sync
+  // читают refs, поэтому доступ через syncRef.current корректен.
+  const syncRef = useRef(sync)
+  syncRef.current = sync
   const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
```

### 5.3 Мемоизация колонок

```diff
-  const tableColumns: ColumnDef<TableRow>[] = columns.map((col) => ({
-    id: col.id,
-    accessorFn: (row: TableRow) => row[col.binding],
-    header: col.label,
-    size: col.flex ? undefined : 150,
-    cell: ({ row }) => (
-      <TableCellEditor
-        cellWidget={col.cellWidget}
-        dataType={col.dataType}
-        value={row.original[col.binding]}
-        readonly={col.readonly}
-        onChange={(val) => sync.updateCell(row.original.rowId, col.binding, val)}
-        onCommit={sync.commitCell}
-      />
-    ),
-  }))
+  // Мемоизируем колонки по [columns]: при ре-рендере EditableTable (ввод символа →
+  // setLocalRows) определения колонок/cell-функций НЕ пересоздаются, поэтому TanStack
+  // не ремонтит ячейку и инпут сохраняет фокус. cell-колбэки берут актуальный sync
+  // через syncRef.current.
+  const tableColumns = useMemo<ColumnDef<TableRow>[]>(
+    () =>
+      columns.map((col) => ({
+        id: col.id,
+        accessorFn: (row: TableRow) => row[col.binding],
+        header: col.label,
+        size: col.flex ? undefined : 150,
+        cell: ({ row }) => (
+          <TableCellEditor
+            cellWidget={col.cellWidget}
+            dataType={col.dataType}
+            value={row.original[col.binding]}
+            readonly={col.readonly}
+            onChange={(val) =>
+              syncRef.current.updateCell(row.original.rowId, col.binding, val)
+            }
+            onCommit={() => syncRef.current.commitCell()}
+          />
+        ),
+      })),
+    [columns],
+  )
```

> `columns` — это проп от `TableNode` (`extractEditableColumns(node.children)`). Во время набора текста `TableNode` не ре-рендерится (после фикса 1 локальный ввод не пишет в стор), поэтому ссылка `columns` стабильна и мемо держится. Мемо инвалидируется только при реальном изменении дерева/колонок (серверный патч) — это корректно.

## 6. Почему оба фикса нужны

- **Только фикс 2** (мемо) недостаточен, если запись в стор на каждый символ вызывает ре-рендер выше по дереву (подписчики `node.binding`) → новый проп `columns` → мемо инвалидируется → ремонт. Фикс 1 убирает этот источник.
- **Только фикс 1** недостаточен: собственный `setLocalRows` таблицы всё равно ре-рендерит `EditableTable`, а без мемо колонки пересоздаются → ремонт.
- Вместе: ввод локальный и не дёргает стор; колонки стабильны → инпут не ремонтится → фокус держится; на blur/Enter уходит один EVENT с полным массивом строк (как и задумано).

## 7. На что обратить внимание (побочные эффекты)

- **Dirty-трекинг вкладки во время набора.** Раньше посимвольная запись в стор помечала форму «грязной» сразу. Теперь dirty помечается на **commit** (blur/Enter → EVENT → серверный `setValue`). Для звёздочки вкладки/диалога «несохранённые изменения» это обычно ок (commit происходит при уходе из ячейки). Если требуется мгновенный dirty во время набора — добавить лёгкий флаг dirty без записи полного массива в `node.binding` (не возвращать посимвольный `setValue` — он и есть причина бага).
- **`flushPending` (flush-before-save)** не затронут: он сравнивает `localRowsRef` с `canonRows` и шлёт незакоммиченный ввод перед сохранением. Незакоммиченный последний символ долетит до бэка.

## 8. Как проверить

1. Открыть «Заявку на ГП-сделку», включить «Использовать график платежей», вкладка «График платежей».
2. Добавить строку, в текстовую/числовую ячейку ввести несколько символов подряд — **фокус не теряется**, набирается строка целиком.
3. Заполнить дату/процент/сумму — значения раскладываются по своим колонкам (не дублируются — это отдельный, уже закрытый на бэке фикс `binding`).
4. Blur/Enter — уходит один EVENT с полным массивом строк; сервер возвращает пересчитанные значения (напр. `SummaOplaty`), они применяются.

## 9. Вне рамок этого фикса (уже сделано на бэке — на фронте трогать не нужно)

- **Дублирование значений по колонкам** (все ячейки показывали одно значение) — это был backend-баг: `TABLE_COLUMN` не нёс `props.binding`. Исправлено на бэке (`NodeBuilder` теперь ставит `props.binding`). Фронт читает `c.props?.binding` — менять не нужно.
- **Ложная ошибка «заполните строку графика» при проведении** — backend-баг порядка валидации (`onCheckFilling` до сохранения строк). Исправлено на бэке.
