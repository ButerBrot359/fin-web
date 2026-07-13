# Дизайн: reference/enum-ячейка в редактируемой ТЧ + флаг `fullSnapshot`

- **Дата:** 2026-07-13
- **Исходная спека бэка:** [frontend-spec-complex-tables-reference-cell.md](../plans/frontend-spec-complex-tables-reference-cell.md)
- **Прувпойнт:** `RegistratsiyaZayavleniyPoVychetamIPN`, master-ТЧ `VychetyIPN`, колонка `VychetIPN`
- **Ветка:** `feat/sdui-reference-cell` от `dev` (коммиты + пуш, без PR)

## Проблема

1. `TableCellEditor` не знает `cellWidget: REFERENCE_FIELD` / `ENUM_FIELD` — объектное значение `{id, presentation}` рендерится как `[object Object]`, ячейка не редактируется. То же в readonly-ветке (`formatReadonlyValue`).
2. Table-level EVENT не несёт маркер полноты снимка — бэк не может отличить легитимное «удалить все строки» от усечённого снимка по ошибке (silent data-loss risk).

## Решения, принятые при брейншторме

- **TODO-3 спеки закрыт:** цикл реален (`build-column-defs.ts` импортирует `TableCellEditor`) → `renderCellValue`/`normalizeKey` выносятся в отдельный util.
- **Пикер — отдельный компонент** (вариант A): `ReferenceFieldNode` не трогаем вообще, допускаем ~15 строк дублирования разбора `optionsSource`. Общий хук не выносим (спека этого не требует).
- Оба пункта спеки — в одной ветке.

## Дизайн

### 1. Новый util `src/features/sdui/lib/utils/cell-value.ts`

Перенос `renderCellValue` + `normalizeKey` из `build-column-defs.ts` (без React-зависимостей). Реэкспортов не оставляем — импортёры (`table-node.tsx`, `complex-editable-table.tsx`, `build-column-defs.ts`) переключаются на новый модуль. Разрывает потенциальный цикл `table-cell-editor ↔ build-column-defs`.

### 2. Прокидка props колонки до ячейки

- `TableColumnDef` (`use-table-sync.ts`) получает поле `props: Record<string, unknown>`.
- `nodeToTableColumnDef` заполняет его как `node.props ?? {}`.
- `build-column-defs.ts` передаёт `props: col.props` в `TableCellEditor` в обеих ветках (обычная колонка и VERTICAL-группа).

### 3. Новый компонент `src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx`

- Пропсы: `{ colProps, value, onChange, onCommit }` — «глупый», без доступа к `ViewNode`/`useFieldNode`.
- Источник опций: приоритет `optionsSource` из `colProps` (готовый `url` + `params`, дословно); фолбэк по `domain`+`targetTypeCode` — тем же двухветочным паттерном, что у `ReferenceFieldNode`.
- Переиспользует `useReferenceOptions` + `fetchReferenceOptions` как есть (debounce, seq-гвард, resetKey).
- UI: компактный `AutocompleteInput size="small"` с cell-`sx` (прозрачный фон, без рамки, высота 28px — как `cellSx`), без label, без `onShowAll`/`onAdd`/`endAction` — только выбор из дропдауна.
- Выбор опции → `onChange({id, presentation})` → сразу `onCommit()` (как DATE/CHECKBOX). Очистка → `onChange(null)` + `onCommit()`.
- Значение в инпуте показывает `presentation` (конвертация `SelectOption ↔ {id, presentation}`).
- **ENUM-деградация:** если `optionsSource` отсутствует и фолбэк не построить (нет `targetTypeCode`) — нейтральный readonly-спан с `renderCellValue(value)`, без крэша. Ограничение бэка (resolveEnumOptions для колонок ТЧ) документируется, не обходится на фронте.

### 4. `table-cell-editor.tsx`

- Новый проп `props?: Record<string, unknown>`.
- `case 'REFERENCE_FIELD':` и `case 'ENUM_FIELD':` → рендер `ReferenceCellEditor`.
- `formatReadonlyValue`: проверка объектного значения (`typeof value === 'object' && 'presentation' in value` → `renderCellValue`) **до** `switch(dataType)` — закрывает readonly-ячейки (скрытый ключ `VychetIPN` в `GrafikVycheta`).
- default-ветка неизвестных виджетов — через `renderCellValue` вместо `String(value ?? '')`.

### 5. `fullSnapshot`

- `ViewAction` (`types/view.ts`): поле `fullSnapshot?: boolean`.
- `use-table-sync.ts` → `sendEvent()`: `fullSnapshot: true` в `dispatch({...})` безусловно — это единственная точка отправки table-level EVENT, и `rows` там всегда полный локальный снимок.
- Флаг относится только к table-level EVENT; per-field EVENT и COMMAND не трогаем.

## Затронутые файлы

| Файл | Изменение |
|---|---|
| `src/features/sdui/lib/utils/cell-value.ts` | новый: `renderCellValue`, `normalizeKey` |
| `src/features/sdui/lib/utils/build-column-defs.ts` | убрать `renderCellValue`/`normalizeKey`, импортировать из `cell-value.ts`; прокинуть `props` в `TableCellEditor` |
| `src/features/sdui/lib/hooks/use-table-sync.ts` | `TableColumnDef.props`; `sendEvent` — `fullSnapshot: true` |
| `src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx` | новый: компактный автокомплит-пикер ячейки |
| `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx` | cases `REFERENCE_FIELD`/`ENUM_FIELD`; `formatReadonlyValue` + default через `renderCellValue`; проп `props` |
| `src/features/sdui/ui/nodes/composite/table-node.tsx` | импорт `renderCellValue` из нового модуля |
| `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx` | импорт `renderCellValue` из нового модуля |
| `src/features/sdui/types/view.ts` | `ViewAction.fullSnapshot?: boolean` |
| `src/features/sdui/lib/hooks/use-reference-options.ts` | без изменений |
| `src/features/sdui/api/reference-options.ts` | без изменений |
| `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` | без изменений |

## Тестирование

Unit-тестов в проекте нет — ручная проверка по acceptance-критериям исходной спеки на прувпойнте:

1. Ячейка `VychetIPN` в ТЧ `VychetyIPN` — автокомплит, опции из `optionsSource`, выбор сохраняется и виден после перечитывания формы.
2. `presentation` везде: редактируемая ячейка, readonly-ячейка — нигде нет `[object Object]`.
3. Footer `Razmer` в `GrafikVycheta` не сломан.
4. `ENUM_FIELD` без `optionsSource` — не падает, нейтральное отображение.
5. Любой table-level EVENT несёт `fullSnapshot: true` (проверка в network-таб).
6. Удаление последней строки → `{ value: [], fullSnapshot: true }`.

## Вне scope

- `orientation: VERTICAL`-специфика сверх прокидки `props` (уже работает через тот же `TableCellEditor`).
- Серверный master-detail round-trip (`rowActivated`).
- Кнопки «Показать все»/«Добавить»/«проваливание» в ячейке.
- Рефакторинг `ReferenceFieldNode` / общий хук.
