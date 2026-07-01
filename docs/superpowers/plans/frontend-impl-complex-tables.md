# Frontend-имплемент-гайд: СЛОЖНЫЕ табличные части (ТЧ) в SDUI

- **Статус:** Implementation guide (Phase 1) — следует за [ADR-0013](../adr/ADR-0013-sdui-complex-tables.md) (главный источник), расширяет [ADR-0011](../adr/ADR-0011-sdui-editable-tables.md)
- **Дата:** 2026-06-23
- **Адресат:** разработчик `fin-web`
- **Прувпойнт:** `RegistratsiyaZayavleniyPoVychetamIPN` — две связанные ТЧ (`VychetyIPN` + `GrafikVycheta`)

> Это **не** контракт-спека (она — `frontend-spec-complex-tables.md`, может ещё не существовать). Это **объяснение реализации**: какие узлы/компоненты трогать, что переиспользовать из легаси TanStack, в каком порядке, с привязкой к реальным файлам `fin-web` (`файл:строка`). Читать после ADR-0013 целиком и после соседнего гайда редактируемых ТЧ.

> ⚠️ **ЭТО РАСШИРЕНИЕ РЕДАКТИРУЕМЫХ ТАБЛИЦ.** Редактируемость ячеек, table-level sync (весь массив одним EVENT), coalescing/dirty-снимок, `rowId`, flush-before-save, `cellWidget→редактор` — **всё описано в [frontend-impl-tables.md](frontend-impl-tables.md)** и здесь **НЕ дублируется**. Этот гайд описывает **только дельту сложных таблиц**: группы колонок (горизонтальные/вертикальные), составные ячейки, подвалы-итоги, скрытие колонок, master-detail. Всё, что про правку ячейки и round-trip, — там; всё, что про шапку/подвал/связь двух ТЧ, — тут.

---

## 1. Цель + ссылки

Достроить SDUI-таблицу (`table-node.tsx`) до **сложной**:
1. **группы колонок (горизонтальные)** — многоуровневая шапка с общим заголовком над под-колонками;
2. **вертикальные группы / составные ячейки** — несколько полей в одной визуальной ячейке стопкой (требование ИПН «Основание + Предоставлять вычет друг под другом»);
3. **подвалы-итоги** — серверно-вычисленная строка-итог под таблицей;
4. **скрытие / состав колонок** — рендерить только `visible:true`;
5. **master-detail** — две связанные ТЧ (`VychetyIPN` ↔ `GrafikVycheta`).

Контекст для чтения:
- **[ADR-0013](../adr/ADR-0013-sdui-complex-tables.md)** (главный): §2.1 (`NodeType.COLUMN_GROUP` + дети `TABLE_COLUMN`), §2.2 (orientation HORIZONTAL/VERTICAL), §2.3 (составная ячейка — данные плоские, commit-единица = поле), §2.4 (видимость), §4 (master-detail = две таблицы + **презентационный** фильтр на фронте), §5 (подвалы — server-driven), §11 (фазирование).
- **[frontend-impl-tables.md](frontend-impl-tables.md)** — НАСЛЕДУЕТСЯ целиком: §4 (round-trip/coalescing), §4.4 (table-level EVENT), §4.5 (rowId), §4.6 (flush-before-save), §4.1 (`cellWidget→редактор`).
- [ADR-0011](../adr/ADR-0011-sdui-editable-tables.md) §2.5 (server-driven дисциплина), §2.5.1 (cellWidget-override).
- [frontend-impl-movements.md](frontend-impl-movements.md) §3 — общий нормализатор объектной ячейки `{id,presentation}→presentation` (переиспользуем для ссылочных ячеек в группах/скрытом master-key).
- Код-якоря:
  - SDUI таблица (плоская): `fin-web/src/features/sdui/ui/nodes/composite/table-node.tsx`, `table-column-node.tsx`.
  - **Легаси-образец TanStack:** `form-renderer/ui/table-field.tsx` (`useReactTable`, `getHeaderGroups`, `flexRender`), `table-cell-renderer.tsx`, `lib/hooks/use-table-columns.ts`.
  - Ещё TanStack: `widgets/eav-entity-table/ui/eav-entity-table.tsx` (`getHeaderGroups`, `flexRender`, ресайз).
  - Инфра: `sdui/ui/node-renderer.tsx`, `sdui/lib/component-registry.ts`, `sdui/types/node-types.ts`, `sdui/lib/patch-applier.ts`.

---

## 2. Что приходит с бэка (модель по ADR-0013)

Дельта к плоскому `TABLE → TABLE_COLUMN` (ADR-0011). Подтверждено по ADR-0013 §2.1/§2.2/§2.4/§5/§4.2:

### 2.1 Дерево колонок с группами

`TABLE`-узел теперь содержит не только плоские `TABLE_COLUMN`, но и узлы **`COLUMN_GROUP`** с детьми `TABLE_COLUMN` (или вложенными `COLUMN_GROUP`, **≤ 2 уровня** — ADR-0013 §2.1):

```jsonc
{ "id": "table.vychetyIPN", "type": "TABLE", "binding": "VychetyIPN",
  "children": [
    { "id": "col.vychetIPN", "type": "TABLE_COLUMN",
      "props": { "binding": "VychetIPN", "label": "Вычет ИПН", "cellWidget": "REFERENCE_FIELD", "visible": true } },
    { "id": "colgroup.osnPredost", "type": "COLUMN_GROUP",
      "props": { "label": "Предоставлять вычет / основание", "orientation": "HORIZONTAL" },
      "children": [
        { "id": "col.osnovanie",   "type": "TABLE_COLUMN", "props": { "binding": "Osnovanie", "cellWidget": "TEXT_FIELD", "visible": true } },
        { "id": "col.predostavlyat","type": "TABLE_COLUMN", "props": { "binding": "PredostavlyatVychet", "cellWidget": "CHECKBOX_FIELD", "visible": true } }
      ] }
  ] }
```

- `COLUMN_GROUP.props.label` — общий заголовок группы (шапка). `COLUMN_GROUP` **не имеет `binding`** — это контейнер (ADR-0013 §10 Решение 1).
- Порядок групп/колонок = порядок `children`.

### 2.2 props ориентации группы (ADR-0013 §2.2)

`COLUMN_GROUP.props.orientation`:

| `orientation` | Рендер | Раздел |
|---|---|---|
| `HORIZONTAL` (default) | под-колонки **рядом** под общим заголовком → многоуровневая шапка | §3 |
| `VERTICAL` | поля **друг под другом** в **одной** визуальной ячейке-колонке (стопка) | §4 |

> ADR-0013 §3.3 (challenger D2): **прувпойнт ИПН реализуется на `HORIZONTAL`** (паритет с реальной УФ-1С). `VERTICAL` — опция, включается сменой одного prop `orientation` после подтверждения владельца; **не на критическом пути acceptance Phase 1**. Реализовать оба рендера стоит сразу (дёшево), но тест-чеклист (§9) обязателен только для HORIZONTAL.

### 2.3 Флаг подвала + значения итогов (ADR-0013 §5)

`TABLE_COLUMN.props.footer: Boolean` (есть ли подвал у колонки) + `footerAgg: "SUM"|"COUNT"|…` (тип агрегата, для подписи; default SUM). **Сами значения итогов фронт НЕ считает** — они приходят патчем с бэка (§5).

### 2.4 Флаг видимости (ADR-0013 §2.4)

`TABLE_COLUMN`/`COLUMN_GROUP`.props.`visible: Boolean` (default `true`). Скрытая колонка **не рендерится**, но **остаётся в данных строки** (нужна как master-detail-ключ).

### 2.5 master-detail (ADR-0013 §4.2)

detail-`TABLE`-узел несёт props связи: `masterTable`, `masterKey`, `detailKey`. Бэк отдаёт **ВСЕ** строки detail сразу; связь — по равенству ключа (см. §7).

### 2.6 Составная (вертикальная) ячейка — данные ОСТАЮТСЯ плоскими (ADR-0013 §2.3)

Критично: даже для `VERTICAL` строка — это всё те же плоские ключи: `{ rowId, Osnovanie: "...", PredostavlyatVychet: true }`. **Группировка чисто презентационная** — в `value`/scratch/save идут плоские ключи колонок. Модель строк ADR-0011 **не меняется**. VERTICAL вводит вложенность только в рендер, не в данные.

---

## 3. Группы колонок (ГОРИЗОНТАЛЬНЫЕ) — многоуровневая шапка

### 3.1 Проблема: `extractColumns` сейчас плоский

`table-node.tsx:28-38` фильтрует только `TABLE_COLUMN` (`c.type === 'TABLE_COLUMN'`) и игнорирует всё остальное — `COLUMN_GROUP` молча выпадет, а его дети-колонки потеряются (они не прямые дети `TABLE`). Шапка строится одним рядом (`table-node.tsx:88-93`). Этого не хватает.

### 3.2 Решение: перевести `table-node.tsx` на TanStack `useReactTable` с группами

Ручная MUI-таблица (`Table/TableHead/TableRow`) **не умеет** многоуровневую шапку из коробки. **`@tanstack/react-table` умеет нативно**: `columns: [{ header, columns: [...] }]` → `getHeaderGroups()` отдаёт **несколько рядов** заголовков с правильными `colSpan`. Это уже используется в проекте — образец рендера шапки:

- `form-renderer/ui/table-field.tsx:128-133` (`useReactTable` + `getCoreRowModel` + `getRowId`), `:189-207` (`getHeaderGroups().map` + `flexRender`);
- `widgets/eav-entity-table/ui/eav-entity-table.tsx:111-123` (конфиг), `:181-261` (`getHeaderGroups` → ряды `<th>`).

> Сейчас легаси `table-field.tsx` строит **плоские** `tableColumns` (`:99-126`) — без групп. Но `useReactTable`+`getHeaderGroups`+`flexRender` — ровно тот движок, который при **группированном** `ColumnDef` сам отрисует многоуровневую шапку. Переиспользуем механику, добавляем группировку в сборку колонок.

### 3.3 Маппинг `COLUMN_GROUP` → группа TanStack

Заменить плоский `extractColumns` (`table-node.tsx:28-38`) на **рекурсивную** сборку дерева в TanStack `ColumnDef[]`:

```ts
import type { ColumnDef } from '@tanstack/react-table'

// дитя TABLE: TABLE_COLUMN (лист) или COLUMN_GROUP (контейнер)
function buildColumnDefs(children: ViewNode[] | undefined): ColumnDef<TableRow>[] {
  if (!children) return []
  return children
    .filter((c) => (c.props?.visible ?? true) !== false)          // §6 — скрытые выкидываем
    .map((c) => {
      if (c.type === 'COLUMN_GROUP') {
        const orientation = (c.props?.orientation as string) ?? 'HORIZONTAL'
        if (orientation === 'VERTICAL') {
          // вертикальная группа → ОДНА колонка-лист с составной ячейкой (§4)
          return buildVerticalGroupColumn(c)
        }
        // горизонтальная → группа TanStack с вложенными columns
        return {
          id: c.id,
          header: (c.props?.label as string) ?? '',
          columns: buildColumnDefs(c.children),   // рекурсия (≤2 уровня, ADR-0013 §2.1)
        }
      }
      // TABLE_COLUMN — лист
      return buildLeafColumn(c)                    // см. frontend-impl-tables.md §4.1
    })
}
```

- `{ header, columns: [...] }` — это **штатный** способ TanStack описать группу: `getHeaderGroups()` сам вернёт ряд группового заголовка над рядом листовых. Никакого ручного `colSpan`/`rowSpan` — TanStack считает сам (`header.colSpan` доступен, но `flexRender` его не требует).
- `buildLeafColumn` (лист-колонка) — это **наследие [frontend-impl-tables.md §4.1](frontend-impl-tables.md)**: `cell` рендерит редактор по `cellWidget`. Здесь его не переписываем, только вызываем.
- Рендер шапки в JSX — как в `table-field.tsx:189-207` / `eav-entity-table.tsx:181-261`: `table.getHeaderGroups().map(hg => <tr>… hg.headers.map(h => <th colSpan={…}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)</tr>)`. При группированных колонках `getHeaderGroups()` вернёт **два ряда** автоматически.

### 3.4 Итог по §3

Перевод `table-node.tsx` с ручной MUI-таблицы на `useReactTable` — **обязательная база** для всего этого гайда: и группы, и подвал (§5 — `getFooterGroups`), и master-detail-рендер опираются на TanStack. Read-only-витрину (`editable===false`, режим `dtkt.rows`) можно оставить на текущем MUI-рендере или тоже перевести — но editable-ветка идёт через TanStack.

---

## 4. ВЕРТИКАЛЬНЫЕ группы / СОСТАВНЫЕ ячейки («друг под другом»)

Это требование ИПН: `Osnovanie` + `PredostavlyatVychet` в одной ячейке стопкой (ADR-0013 §2.3). В прувпойнте по умолчанию HORIZONTAL (§2.2/§3.3), но рендер VERTICAL реализуем как опцию.

### 4.1 Модель: одна колонка TanStack, кастомный `cell`

VERTICAL-группа = **одна** колонка-лист TanStack (визуально одна колонка таблицы), в `cell` которой несколько редакторов **вертикально** (`flex-col` / MUI `Stack` direction="column"):

```ts
function buildVerticalGroupColumn(group: ViewNode): ColumnDef<TableRow> {
  const subCols = (group.children ?? []).filter((c) => (c.props?.visible ?? true) !== false)
  return {
    id: group.id,
    header: (group.props?.label as string) ?? '',
    // одна визуальная колонка; в ячейке — стопка под-редакторов
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        {subCols.map((sub) => (
          <CellEditor                                 // редактор из frontend-impl-tables.md §4.1
            key={sub.id}
            rowId={row.original.rowId}
            binding={sub.props?.binding as string}
            cellWidget={sub.props?.cellWidget as string}
            dataType={sub.props?.dataType as string}
            readonly={sub.props?.readonly as boolean}
          />
        ))}
      </div>
    ),
  }
}
```

- **Ключ:** под-поля внутри VERTICAL-ячейки — это **обычные плоские колонки строки** (`Osnovanie`, `PredostavlyatVychet`). Каждый под-редактор пишет/коммитит в свою колонку через ту же механику, что и любая редактируемая ячейка ([frontend-impl-tables.md §4.1–4.4](frontend-impl-tables.md)). Вертикальность — только верстка `cell`, данные не вкладываются.
- **Commit-единица VERTICAL = ПОЛЕ (под-колонка), не визуальная ячейка** (ADR-0013 §2.3, переопределяет ADR-0011 §2.5.4). Два редактора — **разные** commit-триггеры: `Osnovanie` (текст) → blur/Tab/Enter; `PredostavlyatVychet` (флажок) → клик. Каждый коммитит **самостоятельно** и эмитит table-level EVENT с полным массивом (§4.4 соседнего гайда). Это нормально — данные плоские.
- **Coalescing работает по-полю, не по визуальной ячейке** (ADR-0013 §2.3). Сценарий «печатает Osnovanie, кликает флажок не уводя фокус»: клик коммитит массив, где `Osnovanie` ещё uncommitted в активном редакторе; при возврате ответа dirty-снимок (он трекает ввод **по `rowId`+колонке**, [frontend-impl-tables.md §4.3](frontend-impl-tables.md)) re-apply'ит сырой ввод `Osnovanie` поверх канона → ввод не теряется. VERTICAL это **не ломает**, т.к. dirty уже по-колонке, а не по-ячейке.

> Не вводи отдельный «составной commit» для VERTICAL-ячейки. Каждый под-редактор — независимый коммиттер существующей механики; единственная новизна — что их два в одном `<td>`.

---

## 5. ПОДВАЛЫ-ИТОГИ (footer)

### 5.1 Фронт НЕ считает — server-driven (ADR-0013 §5.2, ADR-0011 §2.5)

Подвал — серверно-вычисленная агрегатная строка. Фронт **локально НЕ суммирует** (как `SummaOplaty` не пересчитывает в §3 соседнего гайда). Бэк при table-EVENT/master-detail-change считает агрегаты колонок с `footer:true` (`TablePartHelper.sumColumn`) и присылает их **патчем**.

### 5.2 Откуда брать значения подвала

Бэк присылает итоги одним из двух способов (по контракт-спеке/ответу бэка — уточнить в `frontend-spec-complex-tables.md`):

- **(A)** отдельный `setValue` под синтетическим binding подвала, напр. `setValue("VychetyIPN.footer", { Razmer: 12345 })` — фронт читает его через `getValue(binding+'.footer')` (механика `setValue→setFromServer`, `patch-applier.ts:113-122`); **или**
- **(B)** как часть нормализованного ответа TABLE — отдельное поле итогов рядом с массивом строк.

В любом случае фронт **только отображает присланное**. Зафиксировать выбранный формат по ответу бэка; не угадывать и не складывать на клиенте.

### 5.3 Рендер строки-подвала — TanStack `footer` / `getFooterGroups`

TanStack нативно поддерживает подвалы: `ColumnDef.footer` (контент ячейки подвала) + `table.getFooterGroups()` (как `getHeaderGroups`, но низ). Дельта к §3.3:

```ts
function buildLeafColumn(col: ViewNode): ColumnDef<TableRow> {
  const hasFooter = col.props?.footer === true
  return {
    id: col.id,
    header: (col.props?.label as string) ?? '',
    cell: /* редактор, frontend-impl-tables.md §4.1 */,
    ...(hasFooter
      ? { footer: () => renderFooterValue(col.props?.binding as string) }  // значение из §5.2, НЕ из reduce
      : {}),
  }
}
```

Рендер строки подвала в JSX — зеркало шапки (`table-field.tsx:189-207`), но через `getFooterGroups()`:

```tsx
<tfoot>
  {table.getFooterGroups().map((fg) => (
    <tr key={fg.id}>
      {fg.headers.map((h) => (
        <td key={h.id}>
          {h.column.columnDef.footer
            ? flexRender(h.column.columnDef.footer, h.getContext())
            : null}
        </td>
      ))}
    </tr>
  ))}
</tfoot>
```

> `renderFooterValue` **читает** присланный каноном итог (§5.2), а **не** `rows.reduce(...)`. Никакой клиентской арифметики — это граница server-driven.

---

## 6. ВИДИМОСТЬ / СОСТАВ КОЛОНОК (ADR-0013 §2.4)

- При сборке `ColumnDef[]` (§3.3) **фильтровать** `visible:false` — `.filter((c) => (c.props?.visible ?? true) !== false)`. Скрытая колонка **не попадает** в `columns`, значит её нет ни в шапке, ни в ячейках, ни в подвале.
- **Но данные строки не трогаем:** значение скрытой колонки остаётся в `{rowId, …}` (бэк отдаёт), нужно как master-detail-ключ (§7). Скрытие — **только рендер**, не модель.
- Динамика видимости (показать колонку по условию) — `setProp(colNodeId, "visible", …)`-патч от хендлера (ADR-0013 §2.4), применяется штатным `applyOne`/`setProp` (`patch-applier.ts:47-51`). `useReactTable` пересоберёт `columns` при смене props узла.

**Прувпойнт ИПН (ADR-0013 §3.1):** `GrafikVycheta` показывает **только 3 колонки** — `Razmer` + группа периода {`PeriodDeystviyaNachalo`, `PeriodDeystviyaKonets`}; ключ связи `VychetIPN` — **`visible:false`** (в данных есть, в шапке нет).

---

## 7. MASTER-DETAIL (две связанные ТЧ) — по решению ADR-0013 §4

> **Следуй ADR, не выдумывай.** ADR-0013 §4.2 выбрал: **две отдельные `TABLE`-узла** (master сверху, detail снизу, обе всегда видны) + **презентационный фильтр detail на фронте** по равенству ключа. **НЕ** вложенные таблицы (§10 Альт.2а отклонена), **НЕ** server-side round-trip в Phase 1 (§4.4 — опция для огромного detail).

### 7.1 Рендер — просто два TABLE-узла

`VychetyIPN` и `GrafikVycheta` — два независимых `TABLE`-узла в layout (как любые два узла). Каждый рендерится своим `TableNode`. Никакой вложенности. Save — независимый (две full-replace, ADR-0011 §3.7).

### 7.2 Связь — фильтр видимости строк detail (ОТБОР, не вычисление)

detail-`TABLE` несёт props (ADR-0013 §4.2): `masterTable` (id master-узла), `masterKey` (колонка-ключ в master), `detailKey` (колонка-ключ в detail). Бэк отдаёт **ВСЕ** строки detail сразу.

Фронт-реализация (паритет с 1С `ТаблицаФормы.ОтборСтрок` — **клиентский** отбор, ADR-0013 §4.1/§4.3):

1. master-таблица держит **выбранную строку** (`selectedIndex`/`selectedRowId` — уже есть в легаси, `table-field.tsx:56`, `:216-218`).
2. По выбору master фронт берёт значение `masterKey` выбранной строки (напр. `selectedMasterRow[masterKey]`).
3. detail-таблица **визуально показывает только** строки, где `row[detailKey] === выбранныйКлюч`:
   ```ts
   const masterKeyVal = normalizeKey(selectedMasterRow?.[masterKey])
   const visibleDetailRows = allDetailRows.filter(
     (r) => normalizeKey(r[detailKey]) === masterKeyVal,
   )
   ```
   `normalizeKey` извлекает скаляр сравнения из ссылочной ячейки `{id,presentation}` → `id` (ключ хранится ссылкой, ADR-0013 §4.2; **не** rowIndex — устойчиво к reorder/delete master).
4. **Round-trip НЕ требуется** — это фильтр уже присланных строк, не запрос новых.

### 7.3 Граница (ADR-0013 §4.3) — почему это НЕ нарушает «логику на бэке»

- Фронт **только фильтрует видимость** уже присланных строк по равенству ключа — это **презентационный отбор** (как фронт сам листает присланный LIST, ADR-0009 §2.1.1), **не** вычисление нового.
- Бэк объявляет связь **декларативно** (`masterKey/detailKey` в метаданных) — фронт **не решает** правило связи, не вычисляет ключ, не меняет данные.
- Если связь сложнее равенства ключа (диапазон, условие) → это бизнес-логика → round-trip EVENT (`rowActivated`) на бэк (ADR-0013 §4.4) — **out-of-scope Phase 1**.
- Скрытый master-key detail-строки заполняется **при добавлении** detail-строки (берётся `masterKey` активной master-строки), пользователь его не редактирует (ADR-0013 §11 out-of-scope).

### 7.4 Связь с редактируемостью

Правка/add/delete строк detail — это редактируемость из [frontend-impl-tables.md](frontend-impl-tables.md) (table-level EVENT с полным массивом). master-detail-фильтр — **поверх**: фильтруем что показать, но в EVENT при правке/add detail летит **полный** массив detail (все строки, включая отфильтрованные-невидимые) — иначе full-replace на бэке удалит невидимые строки других master (silent data loss, [frontend-impl-tables.md §4.4](frontend-impl-tables.md)). **Фильтр — только для показа, не для отправки.**

---

## 8. Пошаговый план (по файлам)

1. **`sdui/types/node-types.ts:13` — добавить `COLUMN_GROUP`** в union `NodeType` (рядом с `TABLE | TABLE_COLUMN | …`).
2. **`sdui/lib/component-registry.ts` — зарегистрировать `COLUMN_GROUP`.** Как и `TABLE_COLUMN` (`component-registry.ts:73`), он рендерится **не standalone** — его читает родитель `TableNode`. Завести `ColumnGroupNode = () => null` (копия `table-column-node.tsx:7`) и `COLUMN_GROUP: ColumnGroupNode` в реестре (`:45-79`), чтобы `getComponent` не падал в `UnknownNode` (`node-renderer.tsx:8`).
3. **`table-node.tsx` — перевести editable-ветку на TanStack `useReactTable`** (§3.2). Образец — `table-field.tsx:128-207` (конфиг + `getHeaderGroups`+`flexRender`). Read-only-ветку (`editable===false`) сохранить/перевести по желанию.
4. **`table-node.tsx` — рекурсивный `buildColumnDefs`** (§3.3) вместо плоского `extractColumns` (`:28-38`): `COLUMN_GROUP`(HORIZONTAL)→`{header, columns:[...]}`, лист→`buildLeafColumn` (из [frontend-impl-tables.md §4.1](frontend-impl-tables.md)). Фильтр `visible` встроить здесь (§6).
5. **`table-node.tsx` — `buildVerticalGroupColumn`** (§4): VERTICAL-группа → одна колонка с `cell`-стопкой под-редакторов. Под-поля — обычные плоские колонки, та же commit-механика.
6. **`table-node.tsx` — строка-подвал** (§5): `ColumnDef.footer` для колонок с `footer:true`; `<tfoot>` через `getFooterGroups()`; значения — из канона (§5.2), **не reduce**.
7. **`table-node.tsx` — master-detail-фильтр** (§7) по решению ADR-0013 §4.2: detail-`TableNode` читает `masterTable/masterKey/detailKey`, фильтрует видимые строки по выбранной master-строке; в EVENT шлёт **полный** массив (§7.4).
8. **Объектная ячейка `{id,presentation}`** — переиспользовать общий нормализатор `renderCellValue` ([frontend-impl-movements.md §3](frontend-impl-movements.md)) для ссылочных ячеек в группах и `normalizeKey` для master-key (§7.2). Не плодить второй `String({...})` → `[object Object]`.

> Бэк-зависимости (не фронт): `NodeType.COLUMN_GROUP` в contract (`-am`-сборка!), `NodeBuilder` COLUMN_GROUP-ветка, подвал-агрегат в хендлере, master-detail props, layout-сид ИПН — ADR-0013 §7. Сборку SDUI всегда с `-am` ([[sdui-build-am-gotcha]]).

---

## 9. Тест-чеклист (Phase 1, прувпойнт ИПН)

1. **Группа с общей шапкой (HORIZONTAL):** `VychetyIPN` показывает группу {`Osnovanie`, `PredostavlyatVychet`} как **две колонки рядом** под одним заголовком; шапка двухрядная (`getHeaderGroups()` вернул 2 ряда). ← критический путь Phase 1 (ADR-0013 §3.3).
2. **`GrafikVycheta` — только 3 колонки:** `Razmer` + группа периода {`PeriodDeystviyaNachalo`, `PeriodDeystviyaKonets`}; ключ `VychetIPN` (`visible:false`) **не виден** в шапке, но присутствует в данных строки (§6).
3. **Подвал-итог:** колонка с `footer:true` (напр. `Razmer`) показывает строку-итог; значение = присланное каноном; правка ячейки → бэк пересчитал → итог обновился; фронт **не** суммировал локально (§5).
4. **Скрытие колонки динамически:** `setProp(col, "visible", false)` от хендлера → колонка исчезла из шапки/ячеек/подвала, данные строки целы.
5. **master-detail-фильтр:** выбор строки master `VychetyIPN` → `GrafikVycheta` показывает только строки с тем же `VychetIPN`; смена выбора → меняется срез; round-trip не уходит (§7.2). При правке/add detail в EVENT летит **полный** массив detail (§7.4).
6. **Составная (VERTICAL) ячейка** — **опция, не критический путь** (ADR-0013 §3.3). Проверять только при включённом `orientation:VERTICAL`: `Osnovanie` + `PredostavlyatVychet` стопкой в одной ячейке; текст коммитит по blur, флажок по клику; печать текста + клик флажка без потери ввода (coalescing по-полю, §4).
7. **Наследуемое (sanity):** редактируемость/round-trip/coalescing/rowId/save — по чеклисту [frontend-impl-tables.md §6](frontend-impl-tables.md), здесь не дублируется.

---

## 10. Gotchas

- **Фронт НЕ вычисляет итоги и НЕ вычисляет связь** (server-driven, ADR-0013 §5.2/§4.3). Подвал — присланное каноном значение, **не** `rows.reduce`. master-detail — фильтр видимости по равенству **присланного** ключа, бэк объявляет связь декларативно (`masterKey/detailKey`). Сложнее равенства → round-trip (§4.4 ADR), не клиентская логика.
- **Составная (VERTICAL) ячейка в редактируемом режиме = несколько НЕЗАВИСИМЫХ редакторов в одном `<td>`** (§4). Не объединять их в один commit: каждый коммитит по своему триггеру (текст→blur, флажок→клик) и шлёт полный массив. Coalescing/dirty работает **по полю-колонке** (а не по визуальной ячейке) — это уже так в [frontend-impl-tables.md §4.3](frontend-impl-tables.md), VERTICAL не ломает, т.к. данные плоские (ADR-0013 §2.3).
- **Данные строки плоские даже для VERTICAL** (ADR-0013 §2.3). Группировка — презентация. В `value`/scratch/save — плоские ключи колонок. Не вкладывать группу в данные строки.
- **Скрытая колонка остаётся в данных** (§6): `visible:false` убирает из рендера, **не** из `{rowId,…}`. master-key скрыт, но участвует в связи.
- **master-detail: EVENT шлёт ПОЛНЫЙ массив detail, не отфильтрованный срез** (§7.4). Фильтр — только показ. Усечённый массив → full-replace удалит невидимые строки других master (silent data loss).
- **Объектная ячейка `{id,presentation}` → `presentation`** через общий нормализатор ([frontend-impl-movements.md §3](frontend-impl-movements.md), `renderCellValue`). Для master-key сравнения — `normalizeKey` извлекает `id` (§7.2). Иначе `String({...})` = `[object Object]` и сравнение объектов по ссылке сломает фильтр.
- **`COLUMN_GROUP` ≤ 2 уровня** (ADR-0013 §2.1/§6). Рекурсия `buildColumnDefs` это поддержит, но глубже 2 — CI-гейт бэка (error); фронт не должен «спасать» более глубокую вложенность.
- **Перевод `table-node` на TanStack — обязательная база** (§3.3): группы (`getHeaderGroups`), подвал (`getFooterGroups`), `getRowId` по `rowId` (не индексу, [frontend-impl-tables.md §4.5](frontend-impl-tables.md)) — всё на одном движке. Ручная MUI-таблица многоуровневую шапку/подвал из коробки не даёт.
- **`-am` при сборке SDUI** ([[sdui-build-am-gotcha]]): `COLUMN_GROUP` — новый член contract-enum; без `-am` webbuh-api соберётся против устаревшего contract-jar → ложные «missing symbol».

---

## 11. Главные фронт-артефакты (резюме)

| Артефакт | Файл | Что делать |
|---|---|---|
| `COLUMN_GROUP` в типах | `sdui/types/node-types.ts:13` | добавить член union |
| `COLUMN_GROUP` в реестр | `sdui/lib/component-registry.ts` | `ColumnGroupNode = () => null` (не standalone, как `TABLE_COLUMN`); родитель читает props |
| TanStack-группы (шапка) | `table-node.tsx` (`buildColumnDefs`) | рекурсия `COLUMN_GROUP`→`{header, columns:[...]}`; перевод на `useReactTable`+`getHeaderGroups` (образец `table-field.tsx:189-207`) |
| Vertical-cell (составная) | `table-node.tsx` (`buildVerticalGroupColumn`) | одна колонка, `cell`-стопка под-редакторов; commit по-полю; данные плоские |
| Footer (подвал) | `table-node.tsx` (`ColumnDef.footer` + `<tfoot>`/`getFooterGroups`) | значения из канона (§5.2), **не** reduce |
| Фильтр видимых колонок | `table-node.tsx` (`buildColumnDefs` `.filter(visible)`) | `visible:false` вне рендера, в данных остаётся |
| master-detail-фильтр | `table-node.tsx` (`masterTable/masterKey/detailKey`) | **решение ADR-0013 §4.2**: две таблицы + презентационный фильтр по ключу; EVENT шлёт полный массив; round-trip не нужен |
| Нормализатор ячейки | переиспользование `renderCellValue` ([frontend-impl-movements.md §3](frontend-impl-movements.md)) | `{id,presentation}`→текст; `normalizeKey`→`id` для master-key |
| Наследуемая механика | [frontend-impl-tables.md](frontend-impl-tables.md) | редактируемость/sync/coalescing/rowId/save — **там**, не дублировать |
