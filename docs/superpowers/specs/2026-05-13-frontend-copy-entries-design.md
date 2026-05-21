# Frontend Copy Entries — Design Spec

Перенос копирования записей документов и справочников с бэкенда на фронтенд.

## Контекст

Ранее копирование вызывало `POST /api/.../copy` на бэкенде. Новая логика: кнопка "Копировать" открывает форму создания с предзаполненными данными из выбранной записи. Создание происходит через стандартный flow создания.

## Что копируется, что нет

Копируются **все** поля и табличные части записи, кроме:
- `id` — новый при создании
- `code` — генерируется бэкендом при создании
- `createdAt` / дата создания (`Data`) — устанавливается текущая дата

## 1. Document entries (полная страница)

### 1.1 `DocumentListToolbar`

**Файл:** `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx`

Текущее поведение: кнопка вызывает `copyMutation.mutate(selectedRowId)` через `copyDocumentEntry` API.

Новое поведение:
- Кнопка делает `navigate` на `/modules/${pageCode}/document/${moduleCode}/new?copyFrom=${selectedRowId}`
- Удалить: `copyMutation`, импорт `copyDocumentEntry`, `useMutation`, `useQueryClient`, `showToast`
- `disabled` остаётся `selectedRowId == null`

### 1.2 `useDocumentEntryForm`

**Файл:** `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts`

Добавить обработку query-параметра `copyFrom`:
- Читать `copyFrom` из `searchParams`
- Запрос `getDocumentEntry(copyFrom)` с `enabled: isNew && !!copyFrom`
- Запрос `getNewDocumentEntry` должен быть **отключён** когда `copyFrom` присутствует (`enabled: isNew && !!vidOperatsii && !copyFrom`)
- В `useEffect`, если есть `copyFromData`:
  - Берём `copyFromData.attributes`
  - Перезаписываем `Data` на `new Date().toISOString()` (свежая дата)
  - `form.reset(cleanedAttributes)`
- `isNew` остаётся `true` (URL содержит `/new`)
- `VidOperatsii` из атрибутов копируемой записи попадает автоматически, диалог выбора операции не показывается

## 2. Dictionary entries — полная страница

### 2.1 `DictionaryListToolbar`

**Файл:** `src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx`

Текущее поведение: кнопка вызывает `copyMutation.mutate(selectedRowId)` через `copyDictEntry` API.

Новое поведение:
- Кнопка делает `navigate` на `/modules/${pageCode}/dictionary/${moduleCode}/new?domain=${domain}&copyFrom=${selectedRowId}`
- Удалить: `copyMutation`, импорт `copyDictEntry`, `useMutation`, `useQueryClient`, `showToast`

### 2.2 `DictionaryEntryPage`

**Файл:** `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx`

Добавить обработку query-параметра `copyFrom`:
- Читать `copyFrom` из URL (аналогично `domain`)
- Запрос `fetchDictEntryById(domain, copyFrom)` с `enabled: isNew && !!copyFrom`
- В `useEffect`, если есть `copyFromData`:
  - Берём `attributes` + `nameRu` + `nameKz` (как при редактировании)
  - **Не** копируем `code`
  - `form.reset(cleanedValues)`
- Страница остаётся в режиме создания (`isNew = true`, `savedEntryId = null`)

## 3. Dictionary entries — sidebar

### 3.1 `DictSidebarPanel` тип

**Файл:** `src/features/dict-sidebar/types/dict-sidebar.ts`

Добавить опциональное поле `copyFromId?: number` в `DictSidebarPanel`.

### 3.2 `DictSidebarListView`

**Файл:** `src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx`

Текущее поведение: кнопка вызывает `copyMutation.mutate(selectedRowId)` через `copyDictEntry` API.

Новое поведение:
- Кнопка вызывает `push({ mode: 'create', domain, typeCode, onSelect, copyFromId: selectedRowId })`
- Удалить: `copyMutation`, импорт `copyDictEntry`, `useMutation`, `useQueryClient`, `showToast`

### 3.3 `DictSidebarFormView`

**Файл:** `src/features/dict-sidebar/ui/dict-sidebar-form-view.tsx`

Добавить обработку `panel.copyFromId`:
- Запрос `fetchDictEntryById(domain, copyFromId)` с `enabled: !savedEntryId && !!panel.copyFromId`
- В `useEffect`, если есть `copyFromData` и нет `savedEntryId`:
  - Берём `attributes` + `nameRu` + `nameKz`
  - **Не** копируем `code`
  - `form.reset(cleanedValues)`
- Форма остаётся в режиме создания

## 4. Зачистка бэкенд-копирования

### Удалить из кода:
- `copyDocumentEntry` из `src/entities/document-entry/api/document-entry.ts`
- Экспорт `copyDocumentEntry` из `src/entities/document-entry/index.ts`
- `copyDictEntry` из `src/features/dict-sidebar/api/dict-sidebar-api.ts`

### Удалить документацию:
- Файл `docs/api/copy-entry-api.md` — удалить целиком

### Неиспользуемые импорты:
После удаления copy-функций проверить и убрать неиспользуемые импорты (`useMutation`, `useQueryClient`, `showToast`) в файлах, где они использовались только для копирования.
