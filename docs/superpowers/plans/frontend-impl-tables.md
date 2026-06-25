# Frontend-имплемент-гайд: редактируемые табличные части (ТЧ) в SDUI

- **Статус:** Implementation guide (Phase 1) — следует за [ADR-0011](../adr/ADR-0011-sdui-editable-tables.md) и контракт-спекой [frontend-spec-tables.md](frontend-spec-tables.md)
- **Дата:** 2026-06-23
- **Адресат:** разработчик `fin-web`
- **Прувпойнт:** ТЧ «График платежей» в `ZayavkaNaRegistratsiyuGPSdelki`

> Это **не** контракт-спека (она — `frontend-spec-tables.md`: что бэк отдаёт, что фронт шлёт, JSON-формы). Это **объяснение реализации**: какие компоненты/хуки/сторы трогать, что переиспользовать из легаси, в каком порядке, с привязкой к реальным файлам `fin-web` (`файл:строка`). Читать после ADR-0011 §2.5 / §3.x и контракт-спеки.

---

## 1. Цель + ссылки

Превратить SDUI-таблицу из **read-only** в **редактируемую**: инлайн-правка ячеек, add/delete/reorder строк, серверный построчный пересчёт и итоги, сохранение строк. Не писать новый движок — **переиспользовать редакторы ячеек из легаси** `form-renderer/`, но **вырезать из них клиентский расчёт/валидацию** (вся логика на бэке, ADR-0011 §2.5.2).

Контекст для чтения:
- ADR-0011 §2.5 (server-driven дисциплина), §2.5.4 / §2.5.4а (round-trip + coalescing — **главная фронт-логика**), §3.1–3.5 (модель строк / scratch / rowId), §3.6.2 (пересчёт от шапки).
- Контракт-спека `frontend-spec-tables.md` §1 (что бэк отдаёт), §2 (что фронт шлёт), §3 (что фронт получает), §5 (таблица фронт-дельт).
- Код-якоря:
  - SDUI таблица (read-only сейчас): `fin-web/src/features/sdui/ui/nodes/composite/table-node.tsx`, `table-column-node.tsx`.
  - Легаси редактируемая ТЧ: `fin-web/src/features/form-renderer/ui/table-field.tsx`, `table-cell-renderer.tsx`, `table-field-toolbar.tsx`; хук колонок `form-renderer/lib/hooks/use-table-columns.ts`; `lib/utils/build-empty-row.ts`.
  - SDUI-инфра: `sdui/lib/dispatch.ts`, `sdui/lib/stores/view-state-store.ts`, `sdui/lib/sdui-session-context.tsx`, `sdui/lib/patch-applier.ts`, `sdui/lib/effect-handler.ts`, `sdui/lib/stores/sdui-cache-store.ts`.
  - Эталон field-узла с EVENT: `sdui/ui/nodes/fields/number-field-node.tsx`, `reference-field-node.tsx`.

---

## 2. Текущее состояние (подтверждено по коду)

### 2.1 SDUI `table-node.tsx` — READ-ONLY

`table-node.tsx` сегодня — статичная таблица MUI без редактирования:

- Строки читаются из view-state по binding узла: `const rows = (getValue(node.binding) as TableRow[]) ?? []` (`table-node.tsx:51`). `getValue` — из `useSduiSession()` (`:50`).
- Колонки собираются из дочерних `TABLE_COLUMN` через `extractColumns(node.children)` (`:54`, `:28-38`) — берутся только `label`/`binding`/`flex` из props.
- **Ячейка — чистый текст:** `String(row[col.binding] ?? '')` (`:112-114`). Никакого инпута, никакого редактора.
- **Add/Delete — COMMAND, не EVENT:** `dispatch({ type: 'COMMAND', command: \`addRow:${node.binding}\` })` (`:57`) и `deleteRow:${node.binding}:${rowId}` (`:61`). Гейтятся props `allowAdd`/`allowDelete` (`:48-49`).
- **Нет** инлайн-правки, **нет** reorder, **нет** выбора строки, **нет** `getRowId` (React-ключ = `row.rowId`, `:109`).
- `table-column-node.tsx` рендерит `null` (`:7`) — `TABLE_COLUMN` standalone не рендерится, его props читает родитель.

Вывод: каркас (колонки из layout, строки из `getValue(binding)`, props `allowAdd/allowDelete`) есть, но это витрина данных.

### 2.2 Легаси `table-field.tsx` — ПОЛНОСТЬЮ редактируемая (источник переиспользования)

`form-renderer/ui/table-field.tsx` — рабочий редактируемый движок на react-hook-form + TanStack Table:

- **Массив строк:** `useFieldArray({ control, name: attribute.code })` → `{ fields, append, remove, move, replace }` (`table-field.tsx:69-72`). Это ровно те операции, что нужны (add/delete/reorder/replace).
- **Колонки:** `useTableColumns(attribute)` (`:55`) грузит атрибуты **типа строки** (`attribute.allowedTypes[0].typeCode`) через `getDocumentType` и фильтрует `showInForm` (`use-table-columns.ts:9-27`).
- **Редакторы ячеек:** `TableCellRenderer` (`:115-120`), имя поля `${attribute.code}.${row.index}.${col.code}` (`:116`).
- **Тулбар:** `TableFieldToolbar` (`:166`) — Add / move up / move down / Remove; гейты `canMoveUp/canMoveDown/canRemove` от `selectedIndex` (`:171-175`).
- **`getRowId` по id строки:** `getRowId: (_, index) => fields[index]?.id ?? String(index)` (`:132`).
- **`replace` для серверных обновлений:** регистрируется как «table replacer» в контексте формы (`registerTableReplacer(attribute.code, replace)`, `:76`), чтобы ответ event'а мог заменить данные ТЧ. Это прямой аналог того, что в SDUI делает `setValue`-патч.
- **Reorder/add/remove** меняют локальный массив (`move/append/remove`, `:135-158`).

`TableCellRenderer` (`table-cell-renderer.tsx`) — набор редакторов по `column.dataType`:
- `BOOLEAN` → `Checkbox` (`:512-528`);
- двухрежимность display/edit: пока не в фокусе — `formatCellValue(value, column)` как текст (`:531-543`), по клику → `CellInput`;
- `CellInput` (`:362-498`) свитчит по типу: `STRING/TEXT` → `TextInput` (`:419-436`), `INTEGER/DECIMAL` → `NumberInput` (`:438-457`), `DATE/DATETIME` → `DateTimeInput` (`:459-478`), `ENUMS` → `EnumCell` (`:386-392`, autocomplete c `/api/enums/{code}/values`), ссылочные (`REFERENCE_DOMAIN_KINDS`) → `DictCell` (`:118-296`, autocomplete + сайдбар через `useDictSidebarStore`), `OBJECT` → `DictCell` по первому ссылочному `allowedType` (`:394-416`).
- **Локальная логика, которую надо вырезать:** `use-cell-dependency` (`table-cell-renderer.tsx:25,133`) — зависимые справочники; вся арифметика/валидация на уровне react-hook-form. В SDUI это уезжает на бэк (см. §3).

`build-empty-row.ts` (`:3-26`) — генерит пустую строку по типам колонок (`''`/`0`/`false`/`null`). Переиспользуемо для Add.

**Итого переиспользуемо:** `TableCellRenderer` + `CellInput`-свитч (как палитра редакторов по типу), `TableFieldToolbar` (как UI add/move/delete), `useFieldArray` (как локальный массив строк), `useReactTable`+`getRowId`, `build-empty-row`. **Не** переиспользуем: `useFormRendererContext`/`registerTableReplacer` (заменяем на SDUI view-state + patch-applier), `use-cell-dependency` и любую клиентскую арифметику.

---

## 3. Целевая модель (ADR-0011 §2.5): фронт = ЧИСТЫЙ рендерер

Фронт **ничего не вычисляет**. Правка ячейки → собрать весь массив → EVENT на бэк → применить вернувшиеся патчи (включая пересчитанные итоги/значения).

**Что фронт НЕ делает** (контракт-спека §0.1):
- НЕ пересчитывает `Сумма = Кол-во × Цена`, НЕ складывает итоги документа;
- НЕ валидирует ТЧ (обязательность, контроль сумм/процентов) — ошибки приходят `setProp(error)`-патчами;
- НЕ выводит производные значения — вычисляемые колонки (`SummaOplaty`) берутся **только** из серверного канона;
- НЕ реализует бизнес-правила add/delete/reorder — локально меняет массив **только для показа**, нормализация/эффект — серверные;
- НЕ решает, какой виджет у ячейки / какие колонки / порядок — всё из метаданных (`cellWidget` / `TABLE_COLUMN`).

Единственное, что фронт **помнит сам**, — сырой пользовательский ввод между commit и ответом (**dirty-снимок**, §4.3). Это память ввода, не вычисление.

**При переносе легаси-редакторов:** из `TableCellRenderer`/`CellInput` оставить только ввод + показ + dispatch; вырезать любую клиентскую расчётную/зависимостную логику (`use-cell-dependency` и т.п.). Reorder/add/remove из `useFieldArray` оставляем — но они теперь лишь меняют массив для показа и триггерят EVENT.

---

## 4. Ключевая реализация — редактируемость + round-trip

### 4.1 `table-node.tsx` → editable

Перевести `table-node.tsx` с MUI-витрины на легаси-движок:

1. При `node.props.editable !== false` (default true для документов, контракт-спека §1.1) рендерить редактируемую таблицу; иначе оставить текущий read-only рендер (режим `dtkt.rows`).
2. Источник строк остаётся прежним — `getValue(node.binding)` (`table-node.tsx:51`); это серверный канон. Но локально завести **локальный массив** через `useFieldArray` (или `useState<Row[]>` — см. ниже про RHF) для редактирования и оптимистичного эха.
3. Колонки расширить: `extractColumns` (`:28-38`) сейчас тянет только `label/binding/flex`. Добавить чтение `cellWidget`, `dataType`, `readonly`, `required` из `col.props` (бэк присылает их, контракт-спека §1.2). Виджет ячейки выбирать **по `col.props.cellWidget`** (он уже разрешён бэком), а **не** выводить из `dataType` — `dataType` только для форматирования/маски (контракт-спека §1.2, §5 п.9).
4. Ячейку рендерить адаптированным `TableCellRenderer`: свитч `cellWidget → редактор`:

| `cellWidget` | редактор из легаси |
|---|---|
| `TEXT_FIELD` / `TEXT_AREA` | `TextInput` (`table-cell-renderer.tsx:419-436`) |
| `NUMBER_FIELD` | `NumberInput` (`:438-457`), `decimal = dataType==='DECIMAL'` |
| `DATE_FIELD` / `DATETIME_FIELD` | `DateTimeInput` (`:459-478`), `dateOnly = dataType==='DATE'` |
| `CHECKBOX_FIELD` | `Checkbox` (`:512-528`) |
| `ENUM_FIELD` | `EnumCell` (`:298-355`) — **Phase 2** для ГП (4 колонки примитивны) |
| `REFERENCE_FIELD` | `DictCell` (`:118-296`) — **Phase 2 / out-of-scope** |

5. `readonly`-колонки (`SummaOplaty`) — display-only: рендерить через `formatCellValue` (`table-cell-renderer.tsx:532`), без инпута. Значение приходит из канона.

**Про react-hook-form:** легаси завязан на `form.control` из `useFormRendererContext`, которого в SDUI нет. Два варианта:
- **(A, рекомендуется)** создать локальный `useForm()` внутри `table-node` только под эту ТЧ, синхронизировать его с `getValue(binding)`; переиспользовать `TableCellRenderer`/`CellInput` почти as-is (они принимают `control`/`name`). Минус — лишний RHF-инстанс; плюс — максимальное переиспользование редакторов.
- **(B)** переписать ячейки на controlled-инпуты поверх локального `useState<Row[]>`, дергая `shared/ui/inputs/*` (`TextInput`/`NumberInput`/`DateTimeInput`) напрямую. Больше работы, но без RHF и ближе к остальным SDUI field-узлам.

Эталон, как SDUI-поле локально показывает ввод и шлёт EVENT на blur — `number-field-node.tsx`: `onChange` пишет в view-state локально (`number-field-node.tsx:43-49`), `onBlur` шлёт `fireServerEvent('change', ...)` (`:50-52`, `:24-28`). Ячейка ТЧ повторяет этот паттерн, но **EVENT шлёт весь массив строк** (§4.4), не одно поле.

### 4.2 Триггер EVENT — на COMMIT ячейки, не на keystroke

Правка ячейки локально отражается сразу (оптимистичный эхо-показ — controlled-input/RHF держит введённое). Но **EVENT на бэк — только на commit ячейки** (blur / Tab / Enter / уход из ячейки), не на каждый символ. Это тот же триггер, что `ПриИзменении` в 1С (ADR-0011 §2.5.4).

- Эхо-показ **без вычислений**: показываем то, что пользователь ввёл; `SummaOplaty`/итоги локально **не** трогаем — они обновятся патчем.
- Эталон commit-on-blur — `number-field-node.tsx:50-52` (`onBlur → fireServerEvent('change', ...)`). В ТЧ blur ячейки/смена строки → собрать массив → EVENT.

### 4.3 Coalescing — главная фронт-логика (ADR-0011 §2.5.4а)

Вся логика на сервере → каждый commit = round-trip. Чтобы быстрый таб по ячейкам не терял ввод и `setValue(весь массив)` из ответа не затёр свежие правки:

**Правило: один in-flight table-EVENT на ТЧ + coalescing последнего снимка** (не очередь расходящихся правок).

1. **Один in-flight на ТЧ.** Пока commit A in-flight — **не слать** новый commit. Заведи на компонент ТЧ флаг `inFlightRef` (`useRef<boolean>`).
2. **Пока in-flight — копить правки в локальном dirty-снимке.** Это **память ВВОДА, не вычисление**: dirty несёт только сырые значения ячеек, которые пользователь трогал после отправки A (что напечатал/выбрал), и **не** содержит производных (`SummaOplaty`, итоги — всегда из канона). Где хранить: локальный стейт компонента ТЧ — `dirtyRef = useRef<Map<rowId, Partial<Row>>>` (по `rowId` → изменённые поля). Альтернатива — отдельный лёгкий zustand-стор на ТЧ; но `useRef`-Map проще и живёт ровно жизнь компонента.
3. **На возврат ответа A** (несёт `setValue(tableCode, <канон с пересчитанными колонками + проставленными rowId>)`):
   - применить серверный канон **как новую базу** локального массива (через `replace`/`setState`);
   - **re-apply dirty-снимка поверх**: для каждого `rowId` из dirty перенести сырые значения **только тех ячеек, что пользователь трогал**, поверх канона; вычисляемые (`readonly`) ячейки — из канона (сервер посчитал);
   - если dirty непустой — **сразу слать коалесцированный commit** (актуальный полный массив), очистив dirty и снова подняв `inFlightRef`.
   - так replace не теряет ввод, а гонка схлопывается в «последний снимок выигрывает».
4. **Активная (в фокусе) ячейка** не перетирается: её uncommitted-значение держит сам редактор (controlled-input/RHF-`Controller`). Replace массива обновляет другие строки, активный редактор сохраняет ввод до своего blur (стандартное поведение controlled-input).

**Грань «эхо vs клиентская логика»:** dirty переносит **ввод**, сервер даёт **производные**. Никакого merge-вычисления на фронте — только re-apply сырых значений по `rowId`/колонке.

Реализационно: где «применить ответ» — это `applyValuePatches` (`patch-applier.ts:113-122`) вызывает `setFromServer(binding, value)` (`view-state-store.ts:21-22`) → канон попадает в view-state. Локальный массив ТЧ должен реагировать на смену `getValue(binding)`: `useEffect` на `getValue(node.binding)` → `replace(canon)` затем re-apply dirty. Чтобы понять, что это **ответ на твой in-flight commit**, держи `inFlightRef`; при его сбросе делай шаг 3.

### 4.4 Sync table-level: весь массив одним EVENT

Любое изменение ТЧ (правка ячейки на commit, add, delete, reorder) → **один EVENT с полным массивом строк** (контракт-спека §2.1):

```
dispatch({
  type: 'EVENT',
  sourceNodeId: node.id,          // id TABLE-узла, напр. "table.grafik"
  trigger: 'change',
  value: currentRows,             // ВЕСЬ массив [{rowId, col:val}, ...]
})
```

- `sourceNodeId` = `node.id` TABLE-узла (как `number-field-node.tsx:26` шлёт `sourceNodeId: node.id`). Бэк резолвит его в `tableCode` без точки.
- per-cell EVENT **не используется** (ADR-0011 §3.4 / §9 Решение 1).
- Контракт «всегда ПОЛНЫЙ массив»: усечённый массив → бэк full-replace молча удалит недостающие строки (ADR-0011 §3.4 A3, silent data loss). Это фронт-инвариант + тест.

### 4.5 rowId — стабильный идентификатор

- сохранённые строки: `rowId = String(documentEntry.id)`;
- новые: фронт генерит `rowId = "tmp-" + uuid`, **держит неизменным** до save;
- reorder/delete **не меняют** rowId существующих строк; порядок несёт **позиция в массиве** (бэк → `sortOrder`);
- `useReactTable`-`getRowId → row.rowId` (не индекс) — чтобы React не терял идентичность при reorder. Легаси использует `fields[index]?.id` (`table-field.tsx:132`) — заменить на `row.rowId`.
- **После save** бэк возвращает `setValue(tableCode, <массив с реальными rowId>)` (full-replace пересоздаёт строки с новыми id, ADR-0011 §3.5). Фронт **обязан** применить replace — иначе `tmp-`/старые rowId протухнут, фокус/выделение слетят, строки задублируются (контракт-спека §3.2). Не игнорировать `setValue` на TABLE в save-ответе.

### 4.6 Flush dirty-снимка ПЕРЕД save

Перед `COMMAND save`/`saveAndClose`/`post`/`postAndClose`: **форсить flush pending ТЧ-EVENT (последнюю незакоммиченную правку ячейки + dirty-снимок) и дождаться его ответа**, затем слать save (контракт-спека §2.3, ADR-0011 §3.4 A2). Иначе правка, сидящая в blur-таймере/dirty, не доедет до scratch и save запишет старьё.

Где включить: в `dispatch.ts` save-команды распознаются по имени — `const saveCommands = ['save', 'saveAndClose', 'post', 'postAndClose']` (`dispatch.ts:185`). Логику flush-before-save ставить **до** отправки save: либо хук-обёртка над `dispatch` (ТЧ регистрирует «есть pending», save ждёт его commit), либо `table-node` слушает «грядёт save» и форсит commit активной ячейки. Практично — общий маленький стор/реестр «pending table commits» (по аналогии с легаси `registerTableReplacer`): save опрашивает его и `await`-ит pending EVENT перед своим запросом.

### 4.7 Row CRUD: add / delete / move

Выполняются фронтом над локальным массивом, затем **весь массив** табличным EVENT (§4.4), а не отдельными командами:

- **Add:** `append(buildEmptyRow(columns))` с `rowId = "tmp-" + uuid` (легаси `handleAdd`, `table-field.tsx:135-138`; `build-empty-row.ts`) → EVENT.
- **Delete:** `remove(index)` (`:140-146`) → EVENT.
- **Reorder:** `move(from, to)` (`handleMoveUp/Down`, `:148-158`) → EVENT.
- Тулбар — `TableFieldToolbar` (`table-field-toolbar.tsx`), переиспользовать as-is; выбор строки через `selectedIndex` (`table-field.tsx:56`, `:216-218`).
- Старые COMMAND `addRow:`/`deleteRow:` (`table-node.tsx:57,61`) **остаются только для read-only** режима; для editable не используются. `moveRow:` не вводим — reorder едет в массиве.
- Ответ применяется как обычно: `setValue(tableCode, rows)` (пересчитанные ячейки, проставленные rowId для новых строк) через `applyValuePatches → setFromServer` (`patch-applier.ts:113-122`) + re-apply dirty (§4.3).

### 4.8 Пересчёт может прийти и от правки ШАПКИ

Не предполагать, что патч на ТЧ — только ответ на ТЧ-EVENT. Если пользователь меняет поле шапки (`СуммаДокумента`), бэк-хук шапки тоже пересчитывает график и шлёт `setValue(GrafikPlatezhey, rows)` (ADR-0011 §3.6.2, контракт-спека §3.1). Фронт применяет его так же: канон → база, re-apply dirty, replace. `useEffect` на `getValue(binding)` (§4.3) ловит это автоматически — главное не завязывать применение строго на «свой in-flight».

---

## 5. Пошаговый план (по файлам)

1. **`table-node.tsx` — editable-каркас.** Ветка `props.editable`: завести локальный массив строк (`useFieldArray` через локальный `useForm`, вариант A §4.1, либо `useState<Row[]>`, вариант B). Read-only ветку (`editable===false`) сохранить как есть.
2. **`table-node.tsx` / `extractColumns` (`:28-38`).** Расширить ColumnDef: добавить `cellWidget`, `dataType`, `readonly`, `required` из `col.props`. Виджет — по `cellWidget` (не выводить из `dataType`).
3. **Адаптировать `TableCellRenderer` (`table-cell-renderer.tsx`) под SDUI.** Свитч `cellWidget → редактор` (§4.1). **Вырезать** клиентскую логику: `use-cell-dependency` (`:25,133`), любую арифметику/валидацию. Оставить ввод + показ + сообщить наверх об изменении. `readonly`-колонки — `formatCellValue` display-only.
4. **Commit-триггер (§4.2).** На blur/Tab/Enter ячейки (или смену активной строки) → собрать массив → объявить «pending commit». Эталон blur-EVENT — `number-field-node.tsx:50`.
5. **Coalescing + dirty-снимок (§4.3).** `inFlightRef` (один in-flight на ТЧ) + `dirtyRef: Map<rowId, Partial<Row>>`. `useEffect` на `getValue(node.binding)`: канон → база → re-apply dirty → если dirty непустой, отправить коалесцированный commit. Это самая тонкая часть — покрыть тестом (§6 п.2/п.7).
6. **rowId (§4.5).** `getRowId → row.rowId`; новые строки = `tmp-uuid`; применять `setValue(tableCode, …)` из save-ответа (replace), сбрасывая `tmp-`.
7. **Flush-before-save (§4.6).** Реестр pending table-commits; `dispatch.ts` save-команды (`:185`) ждут flush перед отправкой. Включить либо в `dispatch`, либо хук-обёрткой.
8. **Reorder UI / тулбар (§4.7).** Переиспользовать `TableFieldToolbar` (`table-field-toolbar.tsx`) + `useFieldArray` `append/remove/move`; каждый CRUD → EVENT с массивом.
9. **Привязка `cellWidget → редактор` (§4.1).** Маппинг-таблица; `dataType` — только форматирование/маска.

Бэк-зависимости (не фронт, но нужны для прувпойнта): сериализация строк в `value` (фикс «TABLE→null»), `onTableChanged`, save через `saveTableRows`, layout-сид ГП — ADR-0011 §3.1/§3.6/§3.7/§3.9, §6 (таблица бэк-артефактов).

---

## 6. Тест-чеклист (Phase 1, ГП)

1. **Базовый round-trip:** ввод в ячейку `ProtsentOplaty` → blur → бэк пересчитал `SummaOplaty` → `setValue(GrafikPlatezhey, rows)` пришёл → ячейка `SummaOplaty` обновилась каноном.
2. **Coalescing:** быстрый таб по 5 ячейкам подряд при медленном ответе (искусственная задержка) → ни одна правка не потеряна и не откатилась (один in-flight + re-apply dirty, §4.3).
3. **Row CRUD:** add → пустая строка с `tmp-` rowId; delete; move up/down → массив и порядок корректны после save.
4. **Save с незакоммиченным вводом:** правка ячейки + сразу клик save (правка ещё в blur-таймере/dirty) → правка **доезжает** (flush-before-save, §4.6).
5. **Remap после save:** save → повторный open показывает строки; повторная правка в **той же** сессии после save не ломает identity (replace с реальными rowId, §4.5).
6. **Пересчёт от шапки:** меняем `СуммаДокумента` при непустом графике → все `SummaOplaty` пересчитались (§4.8).
7. **Активная ячейка при replace:** во время редактирования ячейки приходит `setValue(массив)` от другого commit → активный редактор сохраняет ввод, остальные строки обновляются (§4.3 п.4).
8. **Read-only режим:** `editable===false` (как `dtkt.rows`) рендерится по-старому, без инпутов.
9. **Ссылочная ячейка через сайдбар** — **Phase 2** (все 4 колонки ГП примитивны); проверять только когда появится `REFERENCE_FIELD`-колонка.

---

## 7. Gotchas

- **Фронт НЕ пересчитывает.** При переносе `table-field.tsx`/`table-cell-renderer.tsx` **вырезать** всю расчётную/валидационную/зависимостную логику (`use-cell-dependency`, react-hook-form-расчёты). Оставить ввод + показ + dispatch. Производные (`SummaOplaty`, итоги) — только из серверного канона.
- **Object-ячейка `{id, presentation}`** (ссылочные/ENUM колонки): показывать `presentation`, в EVENT слать как `{id, presentation}` (паритет со ссылочным полем, см. `reference-field-node.tsx:31-37` `toSelectOption/fromSelectOption`). Phase 1 ГП этого не требует.
- **Dirty-трекинг для звёздочки вкладки.** Локальная правка ячейки делает форму dirty. View-state-store ставит `dirty=true` только на `set` (`view-state-store.ts:19-20`), но не на `setFromServer` (`:21-22`). Если редактирование ТЧ идёт мимо `set(binding,...)` (через локальный RHF-инстанс), звёздочка «грязной» вкладки может не зажечься — нужно явно дёргать `setValue(binding, localRows)` (через `set`, `:19`) при локальной правке, чтобы dirty взвёлся. `resetDirty` зовётся на save-команды (`dispatch.ts:186-188`).
- **Синтетические binding с точкой в scratch не идут** — это бэк-инвариант (ADR-0011 §4.1): `tableCode` без точки оседает в scratch штатно, а `таблица.строка.колонка` (точки) — намеренно исключён `captureSetValuePatchesToScratch`. Фронту это значит: слать table-level массив под `sourceNodeId = TABLE-узел` (binding `tableCode` без точки), **не** per-cell с точечным binding.
- **`setValue`-патч не трогает дерево.** В `patch-applier.ts` `applyOne` для `op==='setValue'` возвращает дерево как есть (`:53-54`); значение применяется отдельно через `applyValuePatches → setFromServer` (`:113-122`). Локальный массив ТЧ реагирует на смену view-state (`getValue(binding)`), а не на дерево — вешать `useEffect` на `getValue(node.binding)`.
- **`getRowId` обязан быть по `rowId`, не индексу.** Иначе reorder/replace дёргают React-идентичность строк, теряется фокус и дублируются строки.
- **Один in-flight — глобальное правило сессии** (ADR-0006). Coalescing ТЧ должен укладываться в него: не плодить параллельные table-EVENT, копить в dirty.

---

## 8. Главные фронт-артефакты (резюме)

| Артефакт | Файл | Что делать |
|---|---|---|
| Editable TABLE-узел | `sdui/ui/nodes/composite/table-node.tsx` | read-only → editable; локальный массив; commit-EVENT с полным массивом; применение `setValue(tableCode)`; coalescing |
| ColumnDef + cellWidget | `table-node.tsx` (`extractColumns`) | добавить `cellWidget/dataType/readonly/required`; виджет по `cellWidget` |
| Редакторы ячеек | переиспользование `form-renderer/ui/table-cell-renderer.tsx` | свитч `cellWidget→редактор`, **вырезать** клиентскую логику |
| Тулбар + CRUD | переиспользование `form-renderer/ui/table-field-toolbar.tsx` + `useFieldArray` | add/delete/move → EVENT с массивом |
| Coalescing / dirty-снимок | `table-node.tsx` (`inFlightRef`+`dirtyRef`) | **главная фронт-логика**; один in-flight + re-apply сырого ввода |
| Flush-before-save | `sdui/lib/dispatch.ts` (save-команды `:185`) + реестр pending | дождаться pending table-EVENT перед save |
| Применение патчей | существующие `sdui/lib/patch-applier.ts` + `view-state-store.ts` | без изменений; `setValue→setFromServer` |
