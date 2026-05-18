# Поле типа DIRECTORY в form-renderer

## Обзор

Добавить поддержку нового `dataType: "DIRECTORY"` в form-renderer. Поле работает как автокомплит для выбора папки (группы) из иерархического справочника. Использует эндпоинт `/api/universaldomain-directories/{domain}/{typeCode}` вместо стандартного поиска записей.

## Контекст

Атрибут с `dataType: "DIRECTORY"` приходит от бэкенда со стандартной структурой `allowedTypes`:

```json
{
  "code": "Parent",
  "dataType": "DIRECTORY",
  "domainKind": "DICTIONARY",
  "allowedTypes": [{ "domainKind": "DICTIONARY", "typeCode": "StatiDvizheniyaDenezhnykhSredstv" }],
  "referenceSelectionMode": "GROUP_AND_ELEMENT"
}
```

## API

### Эндпоинт

`GET /api/universaldomain-directories/{domain}/{typeCode}`

### Query-параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `isHierarchical` | boolean | `false` — плоский список всех групп с поиском. `true` — дерево с вложенными children. Для автокомплита используем `false`. |
| `q` | string | Поиск по имени папки |

### Формат ответа

Плоский массив (не обёрнут в `{ data: { content: [...] } }`):

```json
[
  {
    "id": 66967,
    "code": null,
    "nameRu": "Batyr",
    "nameKz": "Batyr",
    "displayName": "Batyr",
    "parentId": null,
    "parentName": null,
    "isGroup": true,
    "isActive": true,
    "dictionaryTypeCode": "StatiDvizheniyaDenezhnykhSredstv",
    "attributes": null,
    "children": null
  }
]
```

## Изменения

### 1. `src/shared/lib/consts/data-types.ts`

- Добавить `'DIRECTORY'` в тип `DataType`
- Добавить URL-билдер:

```ts
export const getUniversalDirectoriesUrl = (domain: string, typeCode: string) =>
  `/api/universaldomain-directories/${domain}/${typeCode}`
```

### 2. `src/shared/ui/form-fields/dict-field.tsx`

Добавить опциональный проп `selectOptions` — кастомная функция трансформации AxiosResponse в `SelectOption[]`. Если передан — используется в `select` у `useQuery` вместо дефолтной трансформации `response.data.data.content.map(...)`. Если не передан — поведение не меняется.

### 3. `src/features/form-renderer/ui/field-node.tsx`

Добавить ветку `dataType === 'DIRECTORY'` **перед** проверкой `REFERENCE_DOMAIN_KINDS`. Это важно: у DIRECTORY-атрибута `domainKind: "DICTIONARY"` в `allowedTypes`, и без ранней проверки он попадёт в обычный reference-блок.

Порядок проверок в `renderField()`:

1. `IGNORED_DATA_TYPES` → skip
2. `TABLE` → TableField
3. **`DIRECTORY` → DictField с directory-конфигурацией** (новое)
4. `REFERENCE_DOMAIN_KINDS` → DictField (как сейчас)
5. Примитивы switch

Конфигурация для DIRECTORY:
- `searchUrl`: `getUniversalDirectoriesUrl(domain, typeCode)`
- `searchParams`: `{ isHierarchical: 'false' }`
- `selectOptions`: трансформер, маппящий плоский массив `response.data` → `SelectOption[]`
- Без `onShowAll`, `onAdd`, `onOpenEntry`

## Что НЕ входит в скоуп

- Поддержка DIRECTORY в `table-cell-renderer.tsx` (таблицы) — позже
- Sidebar-действия ("Показать все", "Добавить") — позже
- Древовидный выбор с `isHierarchical=true` — позже

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/shared/lib/consts/data-types.ts` | Добавить `DIRECTORY` в `DataType`, новый URL-билдер |
| `src/shared/ui/form-fields/dict-field.tsx` | Добавить опциональный проп `selectOptions` |
| `src/features/form-renderer/ui/field-node.tsx` | Добавить ветку `dataType === 'DIRECTORY'` |
