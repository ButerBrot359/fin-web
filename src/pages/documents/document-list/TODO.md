# Document List — TODO

## Пагинация

- API `/api/document-entries/{typeCode}/paged` уже возвращает `PagedResponse` с `totalElements`, `totalPages`, `number`, `size`
- `useDocumentEntries` берёт только `content`, выкидывая метаданные пагинации
- Нужно: передать `page`/`size` параметры в API, добавить UI пагинации (номера страниц или infinite scroll)

## Поиск

- `DocumentListToolbar` имеет `SearchInput` со стейтом `search` — но он **никуда не подключён**
- Нужно: пробросить `search` в `useDocumentEntries` как query-параметр, добавить debounce

## Сортировка

- TanStack Table подключён с `getCoreRowModel()` без `getSortedRowModel()`
- Заголовки колонок не кликабельны
- Нужно: добавить `getSortedRowModel()`, сделать заголовки интерактивными, передать sort params на бэк

## Виртуализация

- Без пагинации на больших списках DOM тяжёлый
- Рассмотреть `@tanstack/react-virtual` для виртуализации строк
