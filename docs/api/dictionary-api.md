# Dictionary API (Универсальный справочник)

**Base URL:** `http://92.38.49.213:31880`
**OpenAPI spec:** [dictionary-api.openapi.json](./dictionary-api.openapi.json)

---

## Типы справочников

### `GET /api/dictionaries/types`

Все типы справочников (с пагинацией).

**Query:** `page`, `size`, `sort`
**Response:** `ApiListResponse<DictionaryType>`

### `POST /api/dictionaries/types`

Создать новый тип справочника.

**Body:** `DictionaryType` (required: `code`, `code1C`, `nameRu`)

### `GET /api/dictionaries/types/{code}`

Тип справочника по коду (с атрибутами). Используется для построения динамических форм и таблиц.

### `POST /api/dictionaries/types/{code}/attributes`

Добавить атрибут к типу справочника.

**Body:** `DictionaryAttribute` (required: `code`, `code1C`, `dataType`, `nameRu`)

---

## Записи справочников

### `GET /api/dictionaries/{typeCode}/entries`

Все записи справочника (кроме удалённых).

### `POST /api/dictionaries/{typeCode}/entries`

Создать запись.

**Body:** `DictionaryEntryCreate` (required: `nameRu`)

### `GET /api/dictionaries/{typeCode}/entries/paged`

Записи с пагинацией.

**Query:** `page`, `size`, `sort`
**Response:** `ApiListResponse<DictionaryEntry>`

### `GET /api/dictionaries/{typeCode}/entries/active`

Только активные записи (`isActive=true`, `deletedAt=null`). Для select/combobox.

### `GET /api/dictionaries/{typeCode}/entries/search?q={query}`

Поиск по `nameRu`, `nameKz`, `code`. Регистронезависимый.

### `GET /api/dictionaries/{typeCode}/entries/tree`

Дерево записей (для иерархических справочников).

### `GET /api/dictionaries/entries/{id}`

Запись по ID (с атрибутами).

### `PUT /api/dictionaries/entries/{id}`

Обновить запись. Атрибуты мержатся (не заменяются целиком).

**Body:** `DictionaryEntryCreate`

### `DELETE /api/dictionaries/entries/{id}`

Soft delete (устанавливает `deletedAt`).

### `POST /api/dictionaries/entries/{id}/restore`

Восстановить удалённую запись.

---

## Модели

### DictionaryType

```
id            int64     (readonly)
code          string    (2-100, unique) — код для URL
code1C        string    (2-100) — код 1С
nameRu        string    (до 500)
nameKz        string    (до 500)
description   string    (до 1000)
isHierarchical boolean  (default: false) — древовидный справочник
isActive      boolean   (default: true)
isTablePart   boolean   (default: false)
parentTypeId  int64     — ID основного справочника (для табличных частей)
hasPredefinedName boolean
groupByAttribute string — атрибут для группировки
attributes    DictionaryAttribute[]
createdAt     datetime  (readonly)
updatedAt     datetime  (readonly)
deletedAt     datetime  (readonly, null если не удалён)
createdBy     string    (readonly)
updatedBy     string    (readonly)
```

### DictionaryEntry

```
id                  int64     (readonly)
dictionaryTypeCode  string    (readonly) — код типа
dictionaryTypeCode1C string   (2-100) — код типа 1С
code                string    (до 100, unique в рамках типа)
nameRu              string    (до 1000, required)
nameKz              string    (до 1000)
parentId            int64     — ID родителя (иерархия)
parentName          string    (readonly)
sortOrder           int32     (default: 0)
isActive            boolean   (default: true)
attributes          Record<string, any> — доп. поля
children            DictionaryEntry[] — дочерние (только в /tree)
createdAt           datetime  (readonly)
updatedAt           datetime  (readonly)
deletedAt           datetime  (readonly)
createdBy           string    (readonly)
updatedBy           string    (readonly)
```

### DictionaryEntryCreate

```
code        string    (до 100, optional)
nameRu      string    (до 1000, required)
nameKz      string    (до 1000)
parentId    int64     (для иерархических)
sortOrder   int32     (default: 0)
attributes  Record<string, any>
```

### DictionaryAttribute

```
id                    int64     (readonly)
code                  string    (1-100, required) — ключ в attributes
code1C                string    (2-100, required)
nameRu                string    (до 500, required) — label в форме
nameKz                string    (до 500)
dataType              enum      (required) — см. ниже
isRequired            boolean   (default: false)
maxLength             int32     — для STRING
referenceTypeCode     string    — код справочника (REFERENCE/TABLE/ENUMS)
referenceSelectionMode enum     (ELEMENT | GROUP_AND_ELEMENT, default: GROUP_AND_ELEMENT)
sortOrder             int32     (default: 0) — порядок в форме
showInList            boolean   (default: false) — показывать в таблице
showInForm            boolean   (default: true) — показывать в форме
defaultValue          string
```

### AttributeDataType (enum)

```
STRING              — input text
TEXT                — textarea
INTEGER             — input number
DECIMAL             — input number step=0.01
BOOLEAN             — checkbox
DATE                — datepicker
DATETIME            — datetimepicker
REFERENCE           — select (загрузка из referenceTypeCode)
TABLE               — табличная часть
ENUMS               — select (перечисление)
ACCOUNT_PLAN        — план счетов
CHARACTERISTICS_TYPE_PLAN — план видов характеристик
DOCUMENT            — документ
EXCHANGE_PLAN       — план обмена
```

### ApiListResponse\<T\>

```
list       T[]     — список элементов
totalSize  int32   — общее количество
```

### Pageable (query params)

```
page   int32   (>= 0)
size   int32   (>= 1)
sort   string[] (например: "nameRu,asc")
```
