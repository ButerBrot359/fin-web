# SCRUM-281 «Виды ОС» — дизайн фронта

Исходная спека бэка: `docs/superpowers/plans/SCRUM-281-frontend-spec.md` (бэк: ветка
`talgat/os-card-fields`, webbuh). Оба изменения аддитивные: пока бэк не выкачен на dev,
поведение фронта не меняется.

## Рамки

- Ветка: `feat/scrum-281-vidy-os` от `feat/sdui-scrum-265`.
- Зона: **только легаси** (`src/features/dict-sidebar/`, `src/features/form-renderer/`)
  плюс один опциональный field в общем типе `DocumentAttribute`
  (`src/entities/document-type/`). SDUI не трогаем: канал 2 спеки (props узла
  TABLE_COLUMN) — форвард на будущее, `ReferenceCellEditor` ссылочные ячейки ТЧ с
  фильтрами пока не поддерживает.
- Правила легаси: минимальные изменения, без рефакторинга под новые стандарты.

## Часть 1 — «Группа ОС»: displayName в списке пикера

Единственная правка: `src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx:233`,
колонка «Наименование» (id `nameRu`):

```ts
// было
accessorFn: (row) => getLocalizedName(row, i18n.language),
// станет
accessorFn: (row) => row.displayName ?? getLocalizedName(row, i18n.language),
```

Обоснование: бэк присылает у групп справочника `VidyDolgosrochnykhAktivov`
`displayName = "{код счёта} - {наименование}"` (напр. «2360 - Машины и оборудование»).
Поле `displayName?: string` в `DictEntry` уже объявлено
(`dict-sidebar-api.ts:32-43`); label чипа выбранного значения (`handleSelect`) и
inline-автокомплит ячейки уже используют `displayName ?? …` — правится только колонка
таблицы «Показать все».

Юнит-тест не пишем (легаси-файл 475 строк, извлечение accessor ради теста = рефакторинг);
проверка руками по чек-листу спеки.

## Часть 2 — rowFilter: отбор «Вид ВНА» по «Счёту учёта» строки ТЧ

### Контракт (легаси-канал, основной)

`GET /api/universaldomain-types/DOCUMENT/{rowTypeCode}` → у атрибута-колонки ТЧ может
прийти `rowFilter: Record<string, string>`:

- ключ — код атрибута ЦЕЛЕВОГО справочника (af-ключ), напр. `SchetUcheta`;
- значение — binding колонки ТЕКУЩЕЙ строки ТЧ, откуда брать значение, напр. `SchetUcheta`;
- у атрибутов без правила ключ в JSON отсутствует вовсе (не `null`);
- map может содержать >1 пары — обработка универсальная, без хардкода под VidVNA.

### Изменения

1. **Тип.** `src/entities/document-type/types/document-type.ts`, интерфейс
   `DocumentAttribute` += `rowFilter?: Record<string, string>`. Ключа нет → undefined →
   механизм выключен (текущее поведение).

2. **Хук.** Новый `src/features/form-renderer/lib/hooks/use-row-filter.ts`:

   ```ts
   function useRowFilter(
     rowFilter: Record<string, string> | undefined,
     rowPathPrefix: string, // '<КодТЧ>.<idx>'
   ): Record<string, string>
   ```

   - `useWatch` по путям `${rowPathPrefix}.${binding}` для всех пар map;
   - shape ссылочной ячейки — `{ id, ... } | null`; заполненные собираются в
     `{ af: '<attrCode>:<id>' }`, несколько пар — af через запятую (формат уже
     поддержан `mergeSearchParams` и бэком);
   - пустая ячейка (`null`/undefined/без `id`) — пара пропускается; все пустые или
     `rowFilter === undefined` → `{}`.

   Паттерн зеркалит `useCellDependency` (тот же контракт «вернуть searchParams»),
   но метаданные не грузит и читает строку, а не шапку.

3. **Встраивание.** `table-cell-renderer.tsx` (DictCell): префикс строки выводится из
   существующего prop `name` (`'<КодТЧ>.<idx>.<col>'` минус последний сегмент); результат
   хука добавляется к цепочке фильтров:
   `mergeSearchParams(mergeSearchParams(serverFilterParams, depParams), rowParams)`.
   Это четвёртый фильтр-источник рядом с dependsOn, серверными fieldFilters и
   synthesizeReferenceFilter; от них не зависит.

### Что получается бесплатно (не менять)

- Дропдаун: `searchParams` уже спредятся в params запроса `/search`
  (`table-cell-renderer.tsx:179-181`) и входят в queryKey (`:178`).
- «Показать все»: `searchParams` уже уходят в `push({ searchParams })` и далее в
  `/search` и `/paged` DictSidebar; входят в оба queryKey
  (`dict-sidebar-list-view.tsx:76-85, 111-118`) — смена «Счёта учёта» даёт свежий
  фильтр без стейл-кэша.
- В легаси-пути везде af-формат; «плоский параметр `{attr}={id}`» из спеки относится
  только к SDUI-optionsSource (форвард-канал, не реализуем).
- Отбор мягкий: фильтруется только пикер этого поля, глобальные списки не трогаем.

### Обработка краёв

- binding из map отсутствует в строке → `useWatch` вернёт undefined → пара не шлётся;
- значение ячейки не ссылочного shape (нет `id`) → пара не шлётся;
- `rowFilter` пуст (`{}`) → хук возвращает `{}`.

## Тесты

Vitest на `useRowFilter` (renderHook + FormProvider-обёртка):

1. заполненная ячейка → `{ af: 'SchetUcheta:4711' }`;
2. пустая ячейка → `{}`;
3. две пары map → af через запятую;
4. `rowFilter === undefined` → `{}`.

## Приёмка руками (dev, после выкладки бэка)

1. Карточка ОС → «Группа ОС» → дропдаун и «Показать все»: группы вида «2310 - Земля»,
   «2360 - Машины и оборудование» (10 групп с префиксом, 3 без — ок).
2. «Поступление от контрагента» → ТЧ «Основные средства» → строка со «Счётом учёта»
   2360 → пикер «Вид ВНА» показывает только виды 2360; очистить счёт → полный список
   (51 запись).
3. Регрессия: колонки без `rowFilter` (МОЛ, Основное средство) работают как раньше.
