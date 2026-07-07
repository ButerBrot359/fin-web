# Дизайн: инвалидация кэша опций ссылочного поля + COLUMN_GROUP в read-only таблице

Дата: 2026-07-07. Ветка: `chore/sdui-docs-cleanup-and-review`.

Источник требований: `docs/superpowers/plans/frontend-handoff-2026-07-03-ref-cache-and-movements-colgroup.md`.
Проверка соответствия: `docs/superpowers/specs/2026-07-02-sdui-course-audit.md`.

## Контекст

Handoff от 2026-07-03 утверждал, что обе правки «уже внесены в рабочее дерево» и нужна только приёмка. Это не так: в текущем коде правок нет, их нужно реализовать заново. Код с момента написания handoff эволюционировал (коммиты M6/M7/M10):

- `reference-field-node.tsx` использует хук `useFieldNode` (`f.setValue`, `f.fireServerEvent`) вместо прямых вызовов из сниппета handoff.
- `nodeToTableColumnDef` (`build-column-defs.ts:168`) уже читает `node.binding ?? props.binding` — отдельный хелпер `readBinding` из handoff не нужен.
- Editable-таблицы с `COLUMN_GROUP` маршрутизируются в `ComplexEditableTable`; read-only путь (`editable=false`) группы игнорирует.

Обе правки — SDUI (`src/features/sdui/`), старая логика не затрагивается.

## Правка 1 — сброс кэша опций ссылочного поля

**Проблема.** После создания записи справочника из формы выбора значение выбирается в поле, но в выпадающем списке новой записи нет до перезагрузки страницы: опции кэшируются в локальном `useState`, а `onOpen` перезапрашивает только при пустом кэше.

**Решение.** В `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`, функция `applySelected` (~строка 98): добавить `setOptions([])` после `f.setValue(newVal)`. Следующий `onOpen` увидит `options.length === 0` и перезапросит свежий список.

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

Покрывает оба пути создания: server-driven (`applyToParent` → `ref.select`) и клиентский dict-sidebar (`onSelect` gateway). Цена — максимум один лишний refetch при следующем открытии дропдауна после обычного выбора.

## Правка 2 — двухуровневая шапка COLUMN_GROUP в ReadOnlyTable

**Контракт бэка.** Read-only TABLE-узел (`editable=false`) с детьми — смесь плоских `TABLE_COLUMN` и `COLUMN_GROUP` (label, children из `TABLE_COLUMN`). Данные строк плоские: ключи = `binding` листовых колонок; группировка чисто презентационная. Ссылочные ячейки — `{id, presentation, entityRef}`, рендер через существующий `renderCellValue`.

**Решение.** В `src/features/sdui/ui/nodes/composite/table-node.tsx` меняются только `ReadOnlyTable` и его хелперы (выбран вариант A; вариант B — readonly-режим в `ComplexEditableTable` — отвергнут как более рискованный, вариант C — общая утилита header-model — как преждевременная абстракция):

1. `extractReadOnlyColumns(children)` — рекурсивно спускается в `COLUMN_GROUP.children`, собирает листовые `TABLE_COLUMN` в порядке документа. Используется для рендера ячеек строк. Маппинг листа — существующий `nodeToTableColumnDef`.
2. `buildHeaderModel(children)` → `{ hasGroups, topRow, bottomRow }`:
   - `COLUMN_GROUP` → ячейка верхнего ряда, `colSpan` = число листовых колонок группы, выравнивание по центру;
   - плоский `TABLE_COLUMN` вне группы → ячейка верхнего ряда, `rowSpan = 2` (только когда `hasGroups`);
   - листья групп → нижний ряд.
3. Рендер `<TableHead>`: первый `<TableRow>` всегда; второй — только при `hasGroups`. Колонка удаления (`allowDelete`) — `rowSpan = 2` при группах.

**Инвариант обратной совместимости.** Без `COLUMN_GROUP` в детях: `hasGroups = false`, второй ряд не рендерится, `colSpan`/`rowSpan` не проставляются (`undefined`) — DOM идентичен текущему. Несгруппированные read-only таблицы (движения регистров накопления/сведений, диалог `dtkt.rows`) визуально не меняются.

Никакой ДтКт-специфики: рендер generic для любого `COLUMN_GROUP`-дерева. Существующее поведение (отсутствие фильтрации `visible === false` в read-only пути, конструирование `addRow:`/`deleteRow:` команд) не меняем — последнее зафиксировано в аудите (находка 1.3) и закрывается отдельным планом.

## Соответствие аудиту (2026-07-02-sdui-course-audit.md)

- Обе правки презентационные, без бизнес-логики: инвалидация кэша — UX-механика показа; группировку решает бэк в дереве нод, фронт лишь считает листья для `colSpan`. Канону (п. 4 «никакой бизнес-логики на фронте») соответствуют.
- Пропсы generic (`label`, `orientation`) — без бизнес-именованных флагов (канон п. 5).
- Известные нарушения в этих же файлах (1.3, 2.1, 3.3, 3.5) — вне скоупа, план фиксов отдельный.

## Проверка

1. `npm run build` — один раз в конце, зелёный typecheck (strict TS).
2. Playwright: двухуровневая шапка ДЕБЕТ/КРЕДИТ на движениях регистра бухгалтерии; регресс несгруппированных read-only таблиц; появление новой записи справочника в дропдауне без перезагрузки. Предусловие: бэк на `http://92.38.49.213:31880` эмитит `COLUMN_GROUP` (иначе плоский рендер — тоже корректно).
3. Ручная визуальная приёмка пользователем по чек-листу handoff:
   - [ ] новая запись справочника видна в списке без reload;
   - [ ] шапка ДтКт двухуровневая, плоские колонки спанят обе строки;
   - [ ] несгруппированные таблицы не изменились;
   - [ ] ссылочные ячейки показывают `presentation`, не `[object Object]`.

## Скоуп

- Ветка: `chore/sdui-docs-cleanup-and-review` (по решению пользователя).
- Затронутые файлы: `reference-field-node.tsx`, `table-node.tsx`. Другие файлы не меняются.
