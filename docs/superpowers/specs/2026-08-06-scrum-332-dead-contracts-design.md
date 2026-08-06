# SCRUM-332 — Замечания тестирования «Поступление от контрагента»: контракты, которые бэк отдаёт, а фронт не читает

Дата: 2026-08-06. Автор: front (fin-web). Основание: `specs-local/scrum-332-zamechaniya-postuplenie-ot-kontragenta/frontend-spec-dead-contracts-2026-08-04.md`.

## 0. Суть и проверка контракта

Три независимых фронт-дефекта документа «Поступление от контрагента» (SDUI), общий класс: бэк вычисляет и кладёт данные на провод, фронт их не потребляет. Все три — чисто фронтовые, бэк-правок не требуют. Контракт проверен вживую на dev-api (OPEN `PostuplenieOtKontragenta.ФормаОбъекта`, `/new`, HTTP 200):

- `field.vidOperatsii` — `props.readonly: true`, `ENUM_FIELD`;
- `table.osnovnyeSredstva.col.vidVNA` — `binding: "VidVNA"`, `props.rowFilter: {parent: "OsnovnoeSredstvo"}` (единственная колонка с rowFilter);
- у всех ТЧ есть серверная команда `table.copyRow:<Code>` («Скопировать»); **actions таблиц — только `change`, `activate` НЕ приходит** → механизм активной строки (`useRowActivate`) для этого документа неактивен, поэтому Вариант B из спеки неприменим, работает только Вариант A.

## 1. П.1 — «Скопировать» в панели ТЧ не работает (Вариант A)

**Причина.** Серверные ТЧ-команды (`props.tableCommands`, среди них `table.copyRow:<Code>`) диспатчатся в `src/features/sdui/ui/nodes/composite/table-toolbar.tsx` (`runCommand`) БЕЗ идентификатора строки — ни `value`, ни `sourceNodeId`. Сервер не знает, какую строку копировать → «Выберите строку…».

**Фикс.**

- `TableToolbar` получает новый проп `selectedRowId: string | null`.
- `runCommand`: `dispatch({ type: 'COMMAND', command: cmd.command, value: selectedRowId ? { rowId: selectedRowId } : undefined }, cmd.behavior)`.
- `ComplexEditableTable` передаёт `selectedRowId={selectedRowId}` (у него есть стейт `selectedRowId`).
- `EditableTable` передаёт `selectedRowId={sync.rows[selectedIndex]?.rowId ?? null}`.
- `runCommand` уже общий для кнопок тулбара и меню «Ещё» (`TableMoreMenu onCommand={runCommand}`) — покрыты оба.

**Почему безопасно.** `TableCommandService.extractRowId` на бэке уже понимает `{rowId: "..."}` — бэк-правок нет. rowId цепляется к любой ТЧ-команде при выбранной строке; сервер читает его только у построчных команд (copyRow), прочие (`podbor`, `zapolnit*`) `extractRowId` не вызывают и `value` игнорируют.

**Не Вариант B.** `table.rowActivate` фронт уже эмитит (`useRowActivate`), но только если у ноды есть action `trigger:'activate'`. Для «Поступление» бэк такой action не шлёт (проверено), поэтому B тут инертен. A и B не противоречат друг другу.

## 2. П.2 — readonly-перечисление выглядит редактируемым

**Причина.** `EnumFieldNode` (`src/features/sdui/ui/nodes/fields/enum-field-node.tsx`) рендерит `<Select readOnly={f.readonly}>`: список не открывается, но иконка раскрытия рисуется всегда → поле читается как редактируемое.

**Фикс.** `<Select … IconComponent={f.readonly ? () => null : undefined}>`. Общая правка для любого readonly-перечисления; сегодня один такой узел (`field.vidOperatsii`), регрессионный риск минимален. Ячейка-ENUM (`table-cell-editor`) не затронута: readonly-ячейка и так рендерится статическим `<span>` (ранний return), `<Select>` там не создаётся.

## 3. П.3 — per-row ключ `__rowParentIds` для пикера колонки с `rowFilter`

**Причина.** Бэк для каждой строки кладёт готовый parent-id в row-map: `row.__rowParentIds = { "VidVNA": 4711 }` (4711 = ГруппаОС выбранного ОС). Колонка `vidVNA` объявляет биндинг через `props.rowFilter: {parent: "OsnovnoeSredstvo"}`. Фронт `__rowParentIds` не читает → пикер «Вид ВНА» показывает весь справочник вместо видов активов выбранного ОС.

**Контракт.** `rowFilter` — `{ <paramName>: <sourceColumnBinding> }`: ключ = имя query-параметра (`parent`), значение = исходная колонка (информационно; вычисленное значение бэк уже положил в `__rowParentIds`). `__rowParentIds` keyed by binding целевой колонки (`col.binding`, здесь `"VidVNA"`).

**Фикс.**

- `buildColumnDefs` (плоская ячейка, `src/features/sdui/lib/utils/build-column-defs.ts`): если `col.props.rowFilter` есть — `paramName = Object.keys(rowFilter)[0]`; `parentVal = (row.__rowParentIds as Record<string, unknown>)?.[col.binding]`; при `parentVal != null` собрать `extraParams = { [paramName]: String(parentVal) }`. Передать `extraParams` в `TableCellEditor`.
- `TableCellEditor` (`table-cell-editor.tsx`): новый опциональный проп `extraParams?: Record<string, string>`, прокинуть в `ReferenceCellEditor`. `ObjectCellEditor` — намеренно НЕ трогаем (YAGNI): сегодня единственная rowFilter-колонка `vidVNA` — REFERENCE, ни одна OBJECT-колонка rowFilter не несёт; добавить при появлении.
- `ReferenceCellEditor` / `ObjectCellEditor`: `params = { ...resolveOptionsParams(optionsSource?.params, () => undefined), ...extraParams }`; `resetKey` считать по итоговым `params` (уже так) → смена ОС в строке перезапрашивает опции.
- Отсутствие ключа (`__rowParentIds` нет / ОС не выбран / ГруппаОС пуста) → `extraParams` пуст → полный список, поведение прежнее.

**Границы.** Затрагивает только `osnovnyeSredstva.col.vidVNA` → путь ComplexEditableTable (`buildColumnDefs`). В `EditableTable` (инлайн-ячейки) колонок с `rowFilter` сегодня нет — там не реализуем (добавить при появлении). Допущение keyed-by-binding — по бэк-спеке; на `/new` `__rowParentIds` пуст (штатно), проверить на строке с выбранным ОС при ручном прогоне.

## 4. Тесты

- **П.1** (`table-toolbar`): `runCommand` шлёт `value: {rowId}` при `selectedRowId`, `value: undefined` без выбора; меню «Ещё» — тот же `runCommand`. Проброс `selectedRowId` из обоих рендереров.
- **П.2** (`enum-field-node`): readonly → `IconComponent` рендерит null (нет стрелки); editable → стрелка есть; список readonly не открывается.
- **П.3** (`build-column-defs` + `reference-cell-editor`): колонка с `rowFilter` + `row.__rowParentIds[binding]` → в запрос опций уходит `parent`; без ключа → параметра нет (полный список).

## 5. Границы (общие)

- Только SDUI (`src/features/sdui/`), легаси не трогаем.
- Бэк-правок не требуется ни по одному пункту.
- Три пункта независимы — можно катить и ревьюить по отдельности.
