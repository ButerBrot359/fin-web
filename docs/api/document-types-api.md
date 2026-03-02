# Document Types API (Типы документов)

**Base URL:** `http://92.38.49.213:31880`
**OpenAPI spec:** [document-types-api.openapi.json](./document-types-api.openapi.json)

---

## Типы документов

### `GET /api/document-types`

Все типы документов.

**Response:** `DocumentType[]`

### `GET /api/document-types/{code}`

Тип документа по коду (с атрибутами и табличными частями). Используется для построения динамических форм и таблиц.

### `GET /api/document-types/{code}/on-get-form`

Данные формы документа — списки справочников, значения по умолчанию и т.д.

**Response:** `OnGetFormResponse[]`

---

## Модели

### DocumentType

```
id                int64     (readonly)
code              string    (unique) — код для URL
code1C            string    — код 1С
nameRu            string    (required)
nameKz            string
description       string
isHierarchical    boolean   (default: false)
isActive          boolean   (default: true)
isTablePart       boolean   (default: false)
parentTypeId      int64     — ID основного типа (для табличных частей)
hasPredefinedName boolean   (default: false)
groupByAttribute  string    — атрибут для группировки
attributes        DocumentAttribute[]
createdAt         datetime  (readonly)
updatedAt         datetime  (readonly)
deletedAt         datetime  (readonly)
createdBy         string    (readonly)
updatedBy         string    (readonly)
```

### DocumentAttribute

```
id                    int64     (readonly)
code                  string    (required) — ключ в attributes
code1C                string    — код 1С
nameRu                string    (required) — label в форме
nameKz                string
dataType              AttributeDataType (required)
isRequired            boolean   (default: false)
maxLength             int32     — для STRING
referenceTypeCode     string    — код справочника/перечисления
referenceSelectionMode enum     (ELEMENT | GROUP_AND_ELEMENT, default: GROUP_AND_ELEMENT)
sortOrder             int32     (default: 0) — порядок в форме
tableSortOrder        int32     (default: 0) — порядок в таблице
showInList            boolean   (default: false) — показывать в таблице
showInForm            boolean   (default: true) — показывать в форме
defaultValue          string
```

### OnGetFormResponse

```
fieldName   string        — имя поля (например "VidOperatsii")
elements    EnumsValue[]  — список доступных значений для выбора
```

### AttributeDataType (enum)

```
STRING                — input text
TEXT                  — textarea
INTEGER               — input number
DECIMAL               — input number step=0.01
BOOLEAN               — checkbox
DATE                  — datepicker
DATETIME              — datetimepicker
DICTIONARY            — select (загрузка из referenceTypeCode)
TABLE                 — табличная часть
ENUMS                 — select (перечисление)
ACCOUNT_PLAN          — план счетов
CHARACTERISTICS_PLAN  — план видов характеристик
DOCUMENT              — документ
EXCHANGE_PLAN         — план обмена
CALCULATION_PLAN      — план расчёта
ACCUMULATION_REGISTER — регистр накопления
INFORMATION_REGISTER  — регистр сведений
```
