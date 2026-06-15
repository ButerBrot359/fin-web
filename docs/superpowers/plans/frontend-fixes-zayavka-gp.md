# SDUI: спека фронт-правок (fin-web) — Заявка на регистрацию ГП-сделки

Документ для фронт-команды (`fin-web`). Описывает три бага SDUI, которые **невозможно** починить на бэкенде — данные либо не доходят до сервера, либо относятся к чистому рендерингу. По каждому: корень, точное место, минимальная правка, и что бэк уже готов поддержать.

Бэк-баги (видимый заголовок формы, возврат номера после записи) уже исправлены отдельно — здесь только фронт.

Контекст архитектуры: единый эндпоинт `POST /api/view`, действия `OPEN/EVENT/COMMAND/CLOSE`. Фронт держит дерево узлов и `view-state` (значения по `binding`). Сервер не получает значения на COMMAND — только то, что фронт прислал ранее (EVENT) или в `route`/`state` на OPEN.

---

## Баг 2 — «Скопировать» из списка документов открывает пустую форму

### Симптом
В списке документов выделяем строку → «Скопировать» → открывается новая форма, но **все поля пустые** (данные исходного документа не перенеслись).

### Корень
Тулбар списка корректно навигирует на маршрут с `copyFrom`:

`src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx:147`
```ts
`/modules/${pageCode}/document/${moduleCode}/new?copyFrom=${String(selectedRowId)}`
```

Но SDUI-диспатч при OPEN отправляет на сервер **только `location.pathname`, без query-строки**:

`src/features/sdui/lib/dispatch.ts:83`
```ts
route: location.pathname,   // ← '?copyFrom=123' теряется здесь
```

Итог: до `ViewController.handleOpen` параметр `copyFrom` не доезжает вообще. Сервер видит `route = /modules/.../new`, хвост = `new` → создаёт пустую запись. (Старая, не-SDUI форма читала `copyFrom` из `searchParams` сама — `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts:33`, поэтому там копирование работает.)

### Минимальная правка (фронт)
В `dispatch.ts` слать путь вместе с query-строкой:

```ts
// было
route: location.pathname,
// стало
route: location.pathname + location.search,
```

`location.search` (из `useLocation()`) уже доступен в хуке. Изменение безопасно: для обычного открытия `search` пустой; бэк-парсер маршрута и так срезает query при извлечении id.

### Что готовит бэк (после правки фронта)
`ViewController.handleOpen` / `resolveDocumentEntry` начнёт читать `copyFrom` из query маршрута: грузит исходный документ, копирует значения (кроме `Nomer`/`Data`) в новую запись и наполняет scratch, чтобы значения сохранились при первом `save`. Это уже на стороне бэка — отдельная задача, разблокируется этой фронт-правкой.

> Альтернатива (если правка `route` нежелательна): прокидывать `copyFrom` через поле `ViewRequest.state` на OPEN — у DTO уже есть `state?: Record<string, unknown>`. Тогда `dispatch` для OPEN должен класть `state: { copyFrom }` из `location.search`. Оба варианта рабочие; правка `route` — на 1 строку меньше.

---

## Баг 3 — «Показать все» у ссылочного поля показывает пустой список

### Симптом
У полей «Договор контрагента» и «Банковский счёт» в выпадающем списке записи есть, а по кнопке **«Показать все»** список пустой.

### Корень
Дропдаун и «Показать все» бьют в **разные эндпоинты** и по-разному передают фильтр.

Дропдаун (`fetchOptions`) — `src/features/sdui/ui/nodes/fields/reference-field-node.tsx:71-74`:
```ts
url: `/api/${domainPath}/${targetTypeCode}/entries`,
params: { search, page: 0, size: 20, ...filter },   // ← фильтр передаётся
```

«Показать все» (`openDictList`) — `reference-field-node.tsx:100-107`:
```ts
useDictSidebarStore.getState().push({
  mode: 'list',
  domain,
  typeCode: targetTypeCode!,
  onSelect: applySelected,
  // ← filter НЕ передаётся (нет searchParams)
})
```

Панель списка (`DictSidebarListView`) шлёт запрос в `/api/universaldomain-entries/{domain}/{typeCode}/paged`, прокидывая `panel.searchParams` (`dict-sidebar-list-view.tsx:92`). Раз `searchParams` пустой — фильтр не уходит.

«Договор контрагента» и «Банковский счёт» — **зависимые справочники** (зависят от Контрагента/владельца). Бэк на paged-эндпоинте вызывает `validateRequiredFilters` и при отсутствии обязательного фильтра **бросает ошибку** → фронт ловит её и показывает «нет данных». Дропдаун же работает, потому что фронт-форма к этому моменту проставила `filter` (через `setProp filter`, прилетает по EVENT при заполнении Контрагента).

### Минимальная правка (фронт)
В `openDictList` (и желательно `openDictCreate`) передать тот же `filter` в `searchParams`. Тип `DictSidebarPanel.searchParams` — `Record<string, string>`, поэтому значения привести к строке:

```ts
const openDictList = () => {
  useDictSidebarStore.getState().push({
    mode: 'list',
    domain,
    typeCode: targetTypeCode!,
    onSelect: applySelected,
    searchParams: filter
      ? Object.fromEntries(
          Object.entries(filter).map(([k, v]) => [k, String(v)]),
        )
      : undefined,
  })
}
```

После этого «Показать все» применит тот же отбор, что и дропдаун (например, договоры только выбранного контрагента), и список перестанет быть пустым.

> Формат `searchParams` на paged-эндпоинте: бэк ждёт фильтры по атрибутам как `af=AttrCode:EntryId` (`UniversalDomainEntryController.getPaged`, параметр `af`). Уточните в `dict-sidebar-api.ts`/`getUniversalPagedUrl`, как `searchParams` мапятся в query: если они уходят плоско (`Vladelets=123`), а не как `af=Vladelets:123` — фильтр не применится. Тогда мапить нужно в `af`-формат. Это ключевая деталь — проверьте сетевой запрос: должно быть `...&af=Vladelets:123`.

### Замечание про доступность
У «Договора контрагента» кнопка «Показать все» появляется только когда поле активно: `canBrowse = !!targetTypeCode && !readonly && enabled` (`reference-field-node.tsx:98`). Бэк присылает `enabled:false`, пока не заполнены Организация и Контрагент — это by design. Тестируйте «Показать все» на заполненном (активном) поле.

---

## Баг 4 — у ссылочного поля пропала кнопка «проваливания» (открыть выбранную запись)

### Симптом
У ссылочных полей нет кнопки перехода в выбранную запись справочника (раньше была в старой форме).

### Корень
SDUI-компонент ссылочного поля **не передаёт `endAction`** в `AutocompleteInput`. Сам `AutocompleteInput` кнопку поддерживает:

`src/shared/ui/inputs/autocomplete-input.tsx:198-203`
```tsx
endAdornment: (
  <>
    {params.InputProps.endAdornment}
    {!disabled && endAction}   // ← рендерится, если endAction передан и поле не disabled
  </>
),
```

Но в `reference-field-node.tsx` (рендер `<AutocompleteInput .../>`, строки 120-145) проп `endAction` **не передаётся вообще** — кнопки нет ни у одного ссылочного поля SDUI, не только у «Договора».

### Минимальная правка (фронт)
Добавить `endAction` в `ReferenceFieldNode` — иконку-кнопку, видимую когда есть выбранное значение и поле доступно:

```tsx
endAction={
  selectedOption && canBrowse ? (
    <IconButton
      size="small"
      onMouseDown={(e) => {
        e.preventDefault()
        // открыть форму записи справочника
        useDictSidebarStore.getState().push({
          mode: 'form',           // или существующий режим просмотра/редактирования записи
          domain,
          typeCode: targetTypeCode!,
          entryId: selectedOption.id,
        })
      }}
    >
      <ArrowForwardIcon fontSize="small" />
    </IconButton>
  ) : undefined
}
```

(Конкретный режим/иконку согласуйте с тем, как «проваливание» реализовано в старой форме. Условие показа — `selectedOption && canBrowse`: есть что открывать и поле активно. `AutocompleteInput` сам скроет кнопку при `disabled`.)

### Бэк
Не требуется — это чистый рендеринг на фронте.

---

## Сводка

| Баг | Где правка | Размер | Бэк-поддержка |
|-----|-----------|--------|----------------|
| 2 — копирование | `dispatch.ts:83` | 1 строка (`+ location.search`) | да, отдельная задача (читать `copyFrom`) |
| 3 — «Показать все» | `reference-field-node.tsx` `openDictList` | ~5 строк (передать `filter`→`searchParams`/`af`) | уже готово (paged-эндпоинт + фильтры) |
| 4 — проваливание | `reference-field-node.tsx` рендер | ~10 строк (`endAction`) | не нужна |

Все три — независимые точечные правки в `fin-web`. Баги 1 (видимый заголовок) и 5 (возврат номера после записи) уже исправлены на бэке.
