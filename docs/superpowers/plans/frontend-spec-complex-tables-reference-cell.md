# Frontend-спека: ссылочная/enum-ячейка в редактируемой ТЧ + флаг `fullSnapshot` (fin-web)

- **Статус:** Proposed — хвост после [ADR-0013](../adr/ADR-0013-sdui-complex-tables.md), когда бэкенд ИПН доведён до полной server-driven работоспособности
- **Дата:** 2026-07-08
- **Адресат:** фронт-разработчик `fin-web`
- **Прувпойнт:** `RegistratsiyaZayavleniyPoVychetamIPN`, master-ТЧ `VychetyIPN`, колонка `VychetIPN` (ссылка на `Справочник.ВычетыИПН`)

Это контракт «на проводе» + точечные правки кода — не переписывание таблиц. Наследует весь контракт [frontend-spec-complex-tables.md](frontend-spec-complex-tables.md) и [frontend-spec-tables.md](frontend-spec-tables.md) (модель строк `{rowId,...}`, table-level EVENT весь массив, coalescing, rowId-стабильность). Здесь — только два пункта, оставшиеся нереализованными на фронте после бэкенд-доводки ИПН.

---

## Пункт 1 — In-grid reference/enum picker в редактируемой ТЧ

### 1.1 Проблема (текущее состояние кода)

[`table-cell-editor.tsx`](../../../fin-web/src/features/sdui/ui/nodes/composite/table-cell-editor.tsx) — компонент `TableCellEditor`, `switch (cellWidget)` (строки 104-181) знает только `TEXT_FIELD` / `NUMBER_FIELD` / `DATE_FIELD` / `DATETIME_FIELD` / `CHECKBOX_FIELD`. Для `cellWidget: "REFERENCE_FIELD"` и `cellWidget: "ENUM_FIELD"` попадает в ветку `default` (строки 175-180):

```tsx
default:
  return (
    <span style={{ padding: '4px 8px', fontSize: 14 }}>
      {String(value ?? '')}
    </span>
  )
```

`String(value ?? '')` на объекте `{id, presentation}` даёт **`[object Object]`** — ссылочная ячейка не редактируется и отображается сломанной строкой.

Отдельно: функция `renderCellValue` (уже есть в [`build-column-defs.ts:16-21`](../../../fin-web/src/features/sdui/lib/utils/build-column-defs.ts)) корректно достаёт `presentation` из `{id, presentation}`, но подключена только в [`table-node.tsx:265`](../../../fin-web/src/features/sdui/ui/nodes/composite/table-node.tsx) (обычная нередактируемая таблица) и [`complex-editable-table.tsx:245`](../../../fin-web/src/features/sdui/ui/nodes/composite/complex-editable-table.tsx) (строка-подвал). В `TableCellEditor` (readonly-ветка `formatReadonlyValue`, строки 68-86, и default-ветка редактируемых виджетов) `renderCellValue` **не используется** — отсюда `[object Object]` и в readonly-режиме тоже (`formatReadonlyValue` не знает про объектные значения, `default: return String(value)`).

### 1.2 Контракт узла (уже отдаёт бэк — из ADR-0013 прувпойнта ИПН)

Пример колонки `VychetIPN` в master-ТЧ `VychetyIPN` ([ADR-0013 §3.1](../adr/ADR-0013-sdui-complex-tables.md)):

```jsonc
{
  "id": "col.vychetIPN",
  "type": "TABLE_COLUMN",
  "props": {
    "binding": "VychetIPN",
    "label": "Вычет ИПН",
    "cellWidget": "REFERENCE_FIELD",
    "dataType": "DICTIONARY",
    "domain": "DICTIONARY",
    "targetTypeCode": "VychetyIPN",
    "optionsSource": {
      "url": "/api/dictionary-entries/VychetyIPN/entries",
      "params": {}
    },
    "visible": true,
    "footer": false
  }
}
```

`optionsSource` — тот же формат, что у обычного `REFERENCE_FIELD` верхнего уровня формы ([ADR-0009](../adr/ADR-0009-sdui-server-driven-reference-field.md), [frontend-spec-server-driven-reference-field.md §1.1](frontend-spec-server-driven-reference-field.md)): готовый `url` + `params`, фронт берёт дословно, не строит URL сам.

Значение ячейки в строке `value[]` — ссылочный объект, как и на верхнем уровне формы:
```jsonc
{ "rowId": "101", "VychetIPN": { "id": "5", "presentation": "ИПН 10%" }, "PeriodDeystviyaKonets": "2026-12-31" }
```

### 1.3 Требования к фронту

**(a) Ветка `REFERENCE_FIELD` в `TableCellEditor`.** Добавить `case 'REFERENCE_FIELD':` — компактный автокомплит-пикер поверх той же инфраструктуры, что и обычное поле-ссылка:
- переиспользовать [`useReferenceOptions`](../../../fin-web/src/features/sdui/lib/hooks/use-reference-options.ts) (debounce, seq-гвард от гонок ответов, сброс кэша по `resetKey`) и [`fetchReferenceOptions`](../../../fin-web/src/features/sdui/api/reference-options.ts) — **не дублировать** логику фетча, которую уже использует [`reference-field-node.tsx`](../../../fin-web/src/features/sdui/ui/nodes/fields/reference-field-node.tsx);
- `optionsSource` для ячейки берётся из `props` соответствующего `TABLE_COLUMN`-узла (не из props самой TABLE) — компактный `AutocompleteInput` (тот же переиспользуемый инпут, что и у `ReferenceFieldNode`, без кнопок «Показать все»/«Добавить»/«проваливание» — в ячейке ТЧ эти аффордансы не нужны, только выбор из дропдауна);
- `TableCellEditor` — «глупый» презентационный компонент без доступа к `node`/`useFieldNode`; проп-контракт нужно расширить: помимо текущих `cellWidget/dataType/value/readonly/onChange/onCommit` добавить `props?: Record<string, unknown>` (передаётся из `build-column-defs.ts` как `node.props`, там уже есть `col` — расширить `nodeToTableColumnDef`/`TableColumnDef` полем `props: Record<string, unknown>`, чтобы прокинуть `optionsSource`/`domain`/`targetTypeCode` до ячейки без похода в `ViewNode` заново);
- `onChange` вызывать с полным ссылочным объектом `{id, presentation}` (не bare id) — консистентно с моделью строки ADR-0011/0013 (сравни `VychetIPN` в примерах §1.2 выше и в существующем контракте `frontend-spec-complex-tables.md §2.1`).

**(b) Отображение — `renderCellValue` подключить к обычным ячейкам и readonly-ветке.**
- в `build-column-defs.ts` (`buildColumnDefs`, ветка `TABLE_COLUMN`, строки 57-81) `TableCellEditor` уже получает `value: info.row.original[col.binding]` — сам `TableCellEditor` должен форматировать объектное значение через `renderCellValue`, а не `String(value)`;
- **вариант реализации** (минимальная правка, не разводя циклическую зависимость `table-cell-editor.tsx` ↔ `build-column-defs.ts`): вынести `renderCellValue`/`normalizeKey` в отдельный util-модуль без зависимостей на React (например `src/features/sdui/lib/utils/cell-value.ts`) и импортировать его из обоих мест — `build-column-defs.ts` (уже так) и `table-cell-editor.tsx` (новое). **Уточнить у фронта**, если такой модуль уже существует или есть более простой путь (например `renderCellValue` без изменения места, если циклической зависимости на самом деле нет — `table-cell-editor.tsx` сегодня не импортирует из `build-column-defs.ts`, так что прямой импорт тоже может быть приемлем; финальное решение — на усмотрение реализующего разработчика);
- `formatReadonlyValue` (строки 68-86) — добавить обработку объектных значений (`typeof value === 'object' && 'presentation' in value` → `renderCellValue(value)`) **до** `switch(dataType)`, либо новую ветку `dataType === 'DICTIONARY' || dataType === 'ENUMS'` → `renderCellValue(value)`;
- default-ветка редактируемого `REFERENCE_FIELD`/`ENUM_FIELD` (когда виджет **не** в фокусе редактирования, т.е. отображение выбранного значения в самом автокомплите) — значение в инпуте должно показывать `presentation`, не сериализованный объект (как и у `ReferenceFieldNode.toSelectOption`).

**(c) Полный массив строк на table-level EVENT.** При выборе значения в ячейке коммит идёт как обычно через `syncRef.current?.updateCell(rowId, binding, val)` + `commitCell()` ([`use-table-sync.ts`](../../../fin-web/src/features/sdui/lib/hooks/use-table-sync.ts)) — весь массив строк уходит в EVENT (без изменений механики ADR-0011 §3.4/§2.1а). Значение ячейки внутри массива — `{id, presentation}` (или bare `id`, если так решит бэк-контракт колонки; ADR-0013 не специфицирует это отдельно от общей модели строк — **уточнить у бэка**, если для конкретной колонки ожидается bare id вместо объекта).

**(d) Ветка `ENUM_FIELD` — аналогично, с известным ограничением.** Добавить `case 'ENUM_FIELD':` тем же паттерном (автокомплит/select из опций), но:
> **Известный бэкенд-gap (зафиксировать, не реализовывать обход на фронте):** ENUMS-колонки в ТЧ сейчас **не гарантированно** получают `optionsSource` с бэка — механизм резолва enum-опций (`resolveEnumOptions`) на бэке завязан на **header-атрибуты** документа, не на атрибуты типа строки ТЧ. Для enum-колонки ТЧ контракт `optionsSource` может **отсутствовать** до отдельной бэкенд-доработки. Фронт должен: (1) если `optionsSource` пришёл — работать как для `REFERENCE_FIELD`; (2) если `optionsSource` отсутствует — деградировать в read-only-подобное отображение значения (без крэша), т.е. `TableCellEditor` не должен падать на `ENUM_FIELD` без `optionsSource` — это ограничение задокументировать как зависимость, не Phase 1 acceptance для enum-ячеек.

**(e) Скрытые/readonly ключи — без нового поведения.** `visible:false` колонка не рендерится (уже реализовано в `buildColumnDefs`, строка 53 `if (node.props?.visible === false) continue`). `readonly:true` (например, скрытый ключ связи master-detail `VychetIPN` в `GrafikVycheta`, ADR-0013 §1.6/§4.2) — `TableCellEditor` уже обрабатывает `readonly` веткой в начале компонента (строки 96-102), но она вызывает `formatReadonlyValue`, которая должна уметь показывать `presentation` (см. пункт (b)).

### 1.4 Затронутые файлы (fin-web)

| Файл | Изменение |
|---|---|
| `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx` | добавить `case 'REFERENCE_FIELD'`, `case 'ENUM_FIELD'`; `formatReadonlyValue` — обработка объектных значений через `renderCellValue`; новый проп `props?: Record<string, unknown>` для доступа к `optionsSource`/`domain`/`targetTypeCode` |
| `src/features/sdui/lib/utils/build-column-defs.ts` | `nodeToTableColumnDef`/`TableColumnDef` — прокинуть `props` (или явно `optionsSource`/`domain`/`targetTypeCode`) до `TableCellEditor`; `cell:` в ветке `TABLE_COLUMN` передаёт новый проп |
| `src/features/sdui/lib/hooks/use-reference-options.ts` | без изменений — переиспользуется как есть |
| `src/features/sdui/api/reference-options.ts` (`fetchReferenceOptions`) | без изменений — переиспользуется как есть |
| `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` | без изменений — источник паттерна для копирования (не рефакторить в общий компонент в рамках этой спеки, если не потребуется меньшими усилиями; **на усмотрение фронта**, можно выделить общий `useReferencePickerOptions(node)`-хук, если так проще, чем дублировать 5-10 строк) |
| новый util (опционально) `src/features/sdui/lib/utils/cell-value.ts` | вынос `renderCellValue`/`normalizeKey` без React-зависимостей, если потребуется для избежания циклического импорта |

---

## Пункт 2 — Флаг `fullSnapshot` на table-level EVENT

### 2.1 Проблема (silent data-loss без флага)

Бэк ([`DocumentService.java` — `saveTableRows`](../../../webbuh-api/src/main/java/kz/asiaservis/document/service/DocumentService.java), комментарий в районе строк 601-626) реализует **full-replace** семантику: table-level EVENT несёт **весь** массив строк ТЧ (ADR-0011 §3.4), и бэк расценивает пришедший массив как канонический полный снимок — отсутствующие в нём строки удаляются (`bulkHardDelete`+пересоздание).

Сейчас у бэка **нет** способа надёжно отличить:
- «пользователь легитимно удалил все строки» (пришёл пустой массив осознанно)
- от «фронт прислал усечённый снимок по ошибке» (например, показал только видимые detail-строки одного master вместо всего detail-массива — ровно тот кейс, которого позволяет избежать master-detail-модель ADR-0013 §4.2, но НЕ гарантирует защиту от регрессии в другом месте кода).

Бэк сейчас **только логирует WARN** при подозрительном усечении (комментарий в коде: «такого флага сейчас нет... поэтому здесь только ДЕТЕКЦИЯ/ЛОГ... не блокируем сохранение»), не блокируя запись — то есть сегодня defence-in-depth отсутствует и полагается только на корректность фронта.

### 2.2 Решение (согласовано владельцем)

Единая семантика:
- фронт **обязан** слать `fullSnapshot: true` на table-level `change` EVENT, когда отправляет **полный** массив строк ТЧ — а это именно то, что фронт **всегда** делает по инварианту ADR-0011 §3.4/table-level sync (весь массив, не срез);
- `fullSnapshot: true` + пустой массив `[]` = легитимное «удалить все строки» — бэк должен это удалять без WARN;
- если флаг не прислан или `false` — бэк трактует снимок как **неполный** и **не удаляет** отсутствующие строки (upsert-only по присланным `rowId`), логируя WARN.

> **Финальная JSON-форма (подтверждена реализацией 2026-07-08).** Бэк добавил поле `fullSnapshot` (nullable `Boolean`) в `webbuh-contract` [`ViewActionDto`](../../../webbuh-api/../webbuh-contract/src/main/java/kz/asiaservis/view/ViewActionDto.java) — соседнее поле `value` внутри `action`, ровно как в форме ниже. Имя поля и уровень вложенности зафиксированы. Семантика на бэке — tri-state: маркер **отсутствует** (`null`, все non-SDUI-вызовы) → legacy full-replace; SDUI-путь пишет маркер всегда → `true`=full-replace, `false`/omitted=partial-upsert. **Для фронта это внутренняя деталь бэка — со стороны провода нужно просто слать `fullSnapshot: true` на table-level EVENT.**

Контракт — `fullSnapshot` как соседнее поле `value` внутри `action` (не вложено в сам массив строк):

```jsonc
{
  "type": "EVENT",
  "formSessionId": "...",
  "revision": 15,
  "action": {
    "sourceNodeId": "table.grafikVycheta",
    "trigger": "change",
    "value": [ /* полный массив строк ТЧ, как сейчас */ ],
    "fullSnapshot": true
  }
}
```

### 2.3 Требования к фронту

**Файл:** [`use-table-sync.ts`](../../../fin-web/src/features/sdui/lib/hooks/use-table-sync.ts).

- в `sendEvent(rows)` (строки 147-165) — единственном месте, откуда уходит table-level `change` EVENT (`dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger: 'change', value: rows })`) — добавить `fullSnapshot: true` к объекту `dispatch(...)`, так как `rows`, передаваемый в `sendEvent`, **всегда** полный локальный снимок (`localRowsRef.current` или `merged` после coalescing) — фронт никогда не отправляет срез;
- расширить тип `ViewAction` ([`fin-web/src/features/sdui/types/view.ts:19-26`](../../../fin-web/src/features/sdui/types/view.ts)) полем `fullSnapshot?: boolean`;
- флаг ставится **безусловно** на всех вызовах `sendEvent` (commitCell, addRow, deleteRow, moveRow, coalesced commit в `useEffect([canonRows])`) — это единая точка отправки, отдельного различения «удаление всех строк» от «обычной правки» на фронте не требуется: и то, и другое — полный снимок;
- **не путать** с EVENT других типов (per-field `change` для обычных полей формы, COMMAND) — флаг относится **только** к table-level EVENT, отправляемому из `use-table-sync.ts`.

### 2.4 Затронутые файлы (fin-web)

| Файл | Изменение |
|---|---|
| `src/features/sdui/lib/hooks/use-table-sync.ts` | `sendEvent()` — добавить `fullSnapshot: true` в `dispatch({...})` |
| `src/features/sdui/types/view.ts` | `ViewAction` — добавить `fullSnapshot?: boolean` |

---

## Acceptance-критерии

1. **In-grid reference picker:** в master-ТЧ `VychetyIPN` документа `RegistratsiyaZayavleniyPoVychetamIPN` ячейка колонки `VychetIPN` рендерится автокомплитом (не `[object Object]`), опции подгружаются из `optionsSource` колонки; выбор значения в строке ТЧ сохраняется (table-level EVENT с `{id,presentation}`) и **виден после перечитывания** формы (canon от бэка возвращает то же значение).
2. **Отображение presentation везде:** и в редактируемой ячейке (выбранное значение показывает `presentation`, не объект), и в readonly-ячейке (например, скрытый ключ связи `VychetIPN` в `GrafikVycheta` с `readonly:true`) значение форматируется через `renderCellValue`/эквивалент — нигде не остаётся `[object Object]`.
3. **Подвал виден:** после доводки бэка `Razmer` в `GrafikVycheta` показывает строку-подвал (`footer:true`) сразу при открытии формы (регрессия к [ADR-0013](../adr/ADR-0013-sdui-complex-tables.md) §5, уже описанному контракту — здесь только подтверждение, что реализация пункта 1 не сломала существующий footer-рендер в `complex-editable-table.tsx`).
4. **ENUM-ограничение задокументировано, не замаскировано:** если `optionsSource` для `ENUM_FIELD`-колонки не пришёл — фронт не падает и не эмулирует опции локально; UI явно нейтрален (не редактируется как рабочий пикер без данных).
5. **`fullSnapshot` на месте:** любой table-level `change` EVENT из `use-table-sync.ts` несёт `fullSnapshot: true`.
6. **Усечённый снимок без флага не теряет строки:** если по какой-то причине (баг, легаси-путь) EVENT ушёл без `fullSnapshot` или с `false`, бэк не удаляет отсутствующие в присланном массиве строки (upsert-only, WARN в логе) — фронт **не обязан** тестировать серверную часть этого критерия (не его код), но обязан гарантировать свою половину — флаг всегда `true` на table-level sync.
7. **Легитimное удаление всех строк работает:** пользователь удаляет последнюю строку ТЧ через `deleteRow` → уходит `{ value: [], fullSnapshot: true }` → бэк удаляет все строки без WARN.

---

## Вне scope

- **`orientation: VERTICAL`-группа колонок** — отдельная опция ADR-0013 §2.2/§3.3, не часть этой спеки (не затрагивает reference-ячейку или `fullSnapshot`).
- **Серверный master-detail round-trip** (ADR-0013 §4.4, `rowActivated`-EVENT при смене master-строки) — презентационный фильтр на фронте (ADR-0013 §4.2/§4.3) остаётся как есть, не меняется этой спекой.
- **Nested table-in-table** — вне контракта ADR-0011/ADR-0013, не рассматривается.
- **Кнопки «Показать все»/«Добавить»/«проваливание» внутри ячейки ТЧ** — не переносятся из [frontend-spec-server-driven-reference-field.md](frontend-spec-server-driven-reference-field.md); в компактной ячейке ТЧ — только дропдаун-выбор, без сайдбара/drawer.
- **Рефакторинг `ReferenceFieldNode` в общий переиспользуемый компонент** между полем формы и ячейкой ТЧ — не требуется этой спекой; допустимо ограничиться переиспользованием хуков/утилит без выноса общего UI-компонента, если так проще для реализующего разработчика.

---

## TODO-флаги на сверку с бэком/фронтом

| # | Флаг | Раздел | Что уточнить |
|---|---|---|---|
| ~~TODO-1~~ ✅ ЗАКРЫТ | Финальная форма `fullSnapshot` | §2.2 | Реализовано 2026-07-08: поле `fullSnapshot` (nullable `Boolean`) в `webbuh-contract/ViewActionDto`, соседнее с `value` в `action` — форма в §2.2 финальна. |
| ~~TODO-2~~ ✅ ЗАКРЫТ | Значение ячейки — объект `{id,presentation}` или bare `id` | §1.3(c) | Бэк принимает **оба** варианта (`ValueFieldHelper.setValue` → `asLong` резолвит и `{id,...}`, и bare id). По умолчанию слать полный объект `{id,presentation}`, как поле формы. |
| TODO-3 | Циклическая зависимость `table-cell-editor.tsx`↔`build-column-defs.ts` при подключении `renderCellValue` | §1.3(b) | Проверить фактическим импортом при реализации; если конфликта нет — не создавать лишний util-модуль |
| TODO-4 | Срок бэкенд-доработки `resolveEnumOptions` для колонок ТЧ | §1.3(d) | У кого/когда в бэклоге; фронт закладывает graceful-деградацию уже сейчас, независимо от срока |

---

## Ссылки

- [ADR-0013 — сложные таблицы](../adr/ADR-0013-sdui-complex-tables.md)
- [ADR-0011 — редактируемые ТЧ](../adr/ADR-0011-sdui-editable-tables.md) (табличная модель, table-level sync, §3.4 инвариант полного массива)
- [ADR-0009 — server-driven ссылочное поле](../adr/ADR-0009-sdui-server-driven-reference-field.md)
- [frontend-spec-complex-tables.md](frontend-spec-complex-tables.md) — базовый контракт сложных ТЧ (группы, подвалы, master-detail), наследуется
- [frontend-spec-server-driven-reference-field.md](frontend-spec-server-driven-reference-field.md) — контракт `optionsSource`/`REFERENCE_FIELD` верхнего уровня формы, источник паттерна для in-grid ячейки
- [frontend-handoff-2026-07-07-validatepatches-drops-insertnode.md](frontend-handoff-2026-07-07-validatepatches-drops-insertnode.md) — соседний handoff-документ (иной предмет, для контекста стиля)
- Код: `fin-web/src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`, `fin-web/src/features/sdui/lib/utils/build-column-defs.ts`, `fin-web/src/features/sdui/lib/hooks/use-reference-options.ts`, `fin-web/src/features/sdui/api/reference-options.ts`, `fin-web/src/features/sdui/ui/nodes/fields/reference-field-node.tsx`, `fin-web/src/features/sdui/lib/hooks/use-table-sync.ts`, `fin-web/src/features/sdui/types/view.ts`, `webbuh-api/src/main/java/kz/asiaservis/document/service/DocumentService.java` (`saveTableRows`)
