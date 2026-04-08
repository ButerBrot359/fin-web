# Табличные части (TABLE) в Документах — Инструкция для фронтенда

## Общая архитектура

Табличная часть в WebbUh — это аналог табличной части документа в 1С. Она позволяет хранить список строк с произвольными колонками внутри одного документа.

### Как это устроено в БД

```
DocumentType (тип документа, напр. "АвансовыйОтчет")
  ├── DocumentAttribute (code="Organizatsiya", dataType=DICTIONARY)  — обычный реквизит
  ├── DocumentAttribute (code="Avansy", dataType=TABLE)              — табличная часть
  │     └── reference_table_type_id → DocumentType "AvansovyyOtchet_Avansy" (is_table_part=true)
  └── DocumentAttribute (code="Raskhody", dataType=TABLE)            — ещё одна ТЧ
        └── reference_table_type_id → DocumentType "AvansovyyOtchet_Raskhody" (is_table_part=true)

DocumentType "AvansovyyOtchet_Avansy" (is_table_part=true, parent=AvansovyyOtchet)
  ├── DocumentAttribute (code="DokumentAvansa", dataType=DOCUMENT)
  ├── DocumentAttribute (code="Summa", dataType=DECIMAL)
  └── ...колонки табличной части
```

Каждая табличная часть — это **отдельный DocumentType** с `is_table_part=true`, у которого:

- `parent_id` указывает на основной тип документа
- Собственные `DocumentAttribute` — это колонки табличной части

Строки табличной части — это `DocumentEntry` с `table_value_id` (FK на `DocumentValue` атрибута TABLE).

---

## 1. Получение метаданных типа документа (колонки ТЧ)

### Запрос

```
GET /api/document-types/{typeCode}
```

### Пример ответа

```json
{
  "id": 100,
  "code": "AvansovyyOtchet",
  "nameRu": "Авансовый отчет",
  "attributes": [
    {
      "id": 201,
      "code": "Organizatsiya",
      "nameRu": "Организация",
      "dataType": "DICTIONARY",
      "showInForm": true,
      "allowedTypes": [
        { "domainKind": "DICTIONARY", "dictionaryTypeRefCode": "Organizatsii" }
      ]
    },
    {
      "id": 202,
      "code": "Avansy",
      "nameRu": "Авансы",
      "dataType": "TABLE",
      "showInForm": true,
      "allowedTypes": [
        {
          "domainKind": "DOCUMENT",
          "documentTypeRefCode": "AvansovyyOtchet_Avansy"
        }
      ]
    },
    {
      "id": 203,
      "code": "Raskhody",
      "nameRu": "Расходы",
      "dataType": "TABLE",
      "showInForm": true,
      "allowedTypes": [
        {
          "domainKind": "DOCUMENT",
          "documentTypeRefCode": "AvansovyyOtchet_Raskhody"
        }
      ]
    }
  ]
}
```

### Как определить что атрибут — табличная часть

```typescript
const isTablePart = attribute.dataType === 'TABLE'
```

### Как получить колонки табличной части

Для каждого атрибута с `dataType === "TABLE"` нужно загрузить метаданные типа строк:

```
GET /api/document-types/{tableTypeCode}
```

Например:

```
GET /api/document-types/AvansovyyOtchet_Avansy
```

Код типа строк берётся из `allowedTypes[0].documentTypeRefCode` (или `dictionaryTypeRefCode` для справочников).

Ответ содержит `attributes` — это **колонки** табличной части:

```json
{
  "code": "AvansovyyOtchet_Avansy",
  "nameRu": "Авансы",
  "attributes": [
    {
      "code": "DokumentAvansa",
      "nameRu": "Документ аванса",
      "dataType": "DOCUMENT"
    },
    { "code": "Summa", "nameRu": "Сумма", "dataType": "DECIMAL" },
    {
      "code": "SchetUcheta",
      "nameRu": "Счёт учёта",
      "dataType": "ACCOUNT_PLAN"
    }
  ]
}
```

---

## 2. Чтение документа с табличными частями

### Запрос

```
GET /api/document-entries/id/{id}
```

### Ожидаемый формат ответа

```json
{
  "id": 500,
  "documentTypeCode": "AvansovyyOtchet",
  "code": "АО-000001",
  "isPosted": false,
  "attributes": {
    "Organizatsiya": {
      "id": 10,
      "nameRu": "ТОО \"Компания\"",
      "displayName": "ТОО \"Компания\""
    },
    "SummaDokumenta": 150000.0,
    "Avansy": [
      {
        "DokumentAvansa": {
          "id": 80,
          "nameRu": "ПКО-000005",
          "displayName": "ПКО-000005"
        },
        "Summa": 100000.0,
        "SchetUcheta": { "id": 30, "nameRu": "1010 Денежные средства в кассе" }
      },
      {
        "DokumentAvansa": {
          "id": 81,
          "nameRu": "ПКО-000006",
          "displayName": "ПКО-000006"
        },
        "Summa": 50000.0,
        "SchetUcheta": { "id": 30, "nameRu": "1010 Денежные средства в кассе" }
      }
    ],
    "Raskhody": [
      {
        "Nomenklatura": { "id": 200, "nameRu": "Канцтовары" },
        "Kolichestvo": 10,
        "Tsena": 500.0,
        "Summa": 5000.0
      }
    ]
  }
}
```

### Правила

- Значение TABLE-атрибута — это **массив объектов** (`List<Map<String, Object>>`)
- Каждый объект в массиве — одна строка табличной части
- Ключи объекта — коды атрибутов типа строк (колонки ТЧ)
- Значения — такие же как у обычных атрибутов (примитив или объект-ссылка)
- Если табличная часть пустая — значение будет `[]` или `null`

> Чтение и запись TABLE-атрибутов для документов полностью реализованы в `DocumentService.saveTableRows()` и `DocumentMapper.getValueAsObject()`.

---

## 3. Создание/обновление документа с табличными частями

### Создание

```
POST /api/document-entries/{typeCode}
Content-Type: application/json
```

### Обновление

```
PUT /api/document-entries/{id}
Content-Type: application/json
```

### Формат тела запроса

```json
{
  "isPosted": false,
  "attributes": {
    "Organizatsiya": 10,
    "SummaDokumenta": 150000.0,
    "Avansy": [
      {
        "DokumentAvansa": 80,
        "Summa": 100000.0,
        "SchetUcheta": 30
      },
      {
        "DokumentAvansa": 81,
        "Summa": 50000.0,
        "SchetUcheta": 30
      }
    ],
    "Raskhody": [
      {
        "Nomenklatura": 200,
        "Kolichestvo": 10,
        "Tsena": 500.0,
        "Summa": 5000.0
      }
    ]
  }
}
```

### Правила отправки TABLE-данных

| Тип колонки   | Что передавать           | Пример                  |
| ------------- | ------------------------ | ----------------------- |
| STRING, TEXT  | строку                   | `"Комментарий"`         |
| INTEGER       | число                    | `42`                    |
| DECIMAL       | число с дробной частью   | `1500.50`               |
| BOOLEAN       | `true` / `false`         | `true`                  |
| DATE          | строку ISO               | `"2026-03-15"`          |
| DATETIME      | строку ISO               | `"2026-03-15T10:30:00"` |
| DICTIONARY    | ID записи справочника    | `10`                    |
| DOCUMENT      | ID записи документа      | `80`                    |
| ACCOUNT_PLAN  | ID записи плана счетов   | `30`                    |
| ENUMS         | ID значения перечисления | `5`                     |
| Другие ссылки | ID записи                | `123`                   |

### Поведение при обновлении

При каждом сохранении документа все строки табличной части **пересоздаются заново** (delete + insert). Фронт всегда отправляет **полный массив строк**.

Чтобы:

- **Добавить строку** — добавить объект в массив
- **Удалить строку** — убрать объект из массива
- **Изменить строку** — изменить значения в объекте
- **Очистить ТЧ** — передать пустой массив `[]`

---

## 4. Обработка событий формы (form-event)

Некоторые события формы связаны с табличными частями. Обработчики могут заполнять ТЧ из бизнес-логики.

### Запрос

```
POST /api/document-entries/{typeCode}/{id}/form-event
Content-Type: application/json

{
  "eventName": "OnFizicheskoeLitsoChanged",
  "params": {
    "currentDeductionCode": "VychetOPV",
    "existingDeductionCodes": ["VychetOPV", "VychetMZP"]
  }
}
```

### Ответ с заполненной ТЧ

Обработчик может вернуть данные для заполнения табличных частей через `params`:

```json
{
  "VychetyIPN": [
    { "VychetIPN": 15, "PredostavlyatVychet": true },
    { "VychetIPN": 16, "PredostavlyatVychet": true }
  ],
  "GrafikVycheta": [
    {
      "VychetIPN": 15,
      "PeriodDeystviyaNachalo": "2026-01-01T00:00:00",
      "Razmer": 14000.0
    },
    {
      "VychetIPN": 15,
      "PeriodDeystviyaKonec": "2026-12-31T00:00:00",
      "Razmer": 14000.0
    }
  ],
  "validationError": null
}
```

Фронт должен:

1. Проверить `validationError` — если не null, показать ошибку
2. Если есть ключи, совпадающие с кодами ТЧ — обновить данные таблицы
3. Проверить `resetDeduction`, `resetAmount` и другие флаги для сброса полей

---

## 5. Полный пример: TypeScript/React

### Интерфейсы

```typescript
// Атрибут типа
interface DocumentAttribute {
  id: number
  code: string
  nameRu: string
  nameKz?: string
  dataType: string // 'STRING' | 'TABLE' | 'DICTIONARY' | ...
  showInForm: boolean
  showInList: boolean
  isRequired: boolean
  readonly: boolean
  sortOrder: number
  allowedTypes: AllowedType[]
  formEvent?: string
}

interface AllowedType {
  domainKind: string
  dictionaryTypeRefCode?: string
  documentTypeRefCode?: string
  accountPlanTypeRefCode?: string
  enumsRefCode?: string
  // ...и другие доменные ссылки
}

// Запись документа
interface DocumentEntry {
  id: number
  documentTypeCode: string
  code: string
  isPosted: boolean
  nameRu: string
  attributes: Record<string, any>
  // attributes["Avansy"] → TableRow[]
}

// Строка табличной части
type TableRow = Record<string, any>
// Пример: { "DokumentAvansa": 80, "Summa": 100000.00 }

// DTO для создания/обновления
interface DocumentEntryCreateDto {
  isPosted?: boolean
  parentId?: number
  attributes: Record<string, any>
  // Табличные части передаются как массив объектов
}
```

### Загрузка метаданных с колонками ТЧ

```typescript
async function loadDocumentFormMeta(typeCode: string) {
  // 1. Загружаем тип документа с атрибутами
  const typeRes = await fetch(`/api/document-types/${typeCode}`)
  const docType = await typeRes.json()

  // 2. Для каждого TABLE-атрибута загружаем метаданные колонок
  const tableAttributes = docType.attributes.filter(
    (a: DocumentAttribute) => a.dataType === 'TABLE'
  )

  const tableMeta: Record<string, DocumentAttribute[]> = {}

  for (const tableAttr of tableAttributes) {
    // Код типа строк берём из allowedTypes
    const rowTypeCode = getTableRowTypeCode(tableAttr)
    if (rowTypeCode) {
      const rowTypeRes = await fetch(`/api/document-types/${rowTypeCode}`)
      const rowType = await rowTypeRes.json()
      tableMeta[tableAttr.code] = rowType.attributes
    }
  }

  return { docType, tableMeta }
}

function getTableRowTypeCode(attr: DocumentAttribute): string | null {
  if (!attr.allowedTypes?.length) return null
  const at = attr.allowedTypes[0]
  return at.documentTypeRefCode || at.dictionaryTypeRefCode || null
}
```

### Рендеринг табличной части

```tsx
function TablePartEditor({
  tableCode, // "Avansy"
  columns, // DocumentAttribute[] — колонки ТЧ
  rows, // TableRow[] — текущие строки
  onChange, // (rows: TableRow[]) => void
}: Props) {
  const addRow = () => {
    const emptyRow: TableRow = {}
    columns.forEach((col) => {
      emptyRow[col.code] = getDefaultValue(col.dataType)
    })
    onChange([...rows, emptyRow])
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index))
  }

  const updateCell = (rowIndex: number, colCode: string, value: any) => {
    const updated = [...rows]
    updated[rowIndex] = { ...updated[rowIndex], [colCode]: value }
    onChange(updated)
  }

  return (
    <div>
      <h3>{tableCode}</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            {columns
              .filter((c) => c.showInForm)
              .map((col) => (
                <th key={col.code}>{col.nameRu}</th>
              ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {columns
                .filter((c) => c.showInForm)
                .map((col) => (
                  <td key={col.code}>
                    <CellEditor
                      attribute={col}
                      value={row[col.code]}
                      onChange={(val) => updateCell(i, col.code, val)}
                    />
                  </td>
                ))}
              <td>
                <button onClick={() => removeRow(i)}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={addRow}>Добавить строку</button>
    </div>
  )
}

function getDefaultValue(dataType: string): any {
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return ''
    case 'INTEGER':
      return 0
    case 'DECIMAL':
      return 0.0
    case 'BOOLEAN':
      return false
    case 'DATE':
    case 'DATETIME':
      return null
    default:
      return null // Ссылочные типы — null по умолчанию
  }
}
```

### Сохранение документа с ТЧ

```typescript
async function saveDocument(
  typeCode: string,
  entryId: number | null,
  formData: Record<string, any>,
  tableData: Record<string, TableRow[]>
) {
  // Собираем attributes: обычные реквизиты + табличные части
  const attributes: Record<string, any> = { ...formData }

  // Для каждой ТЧ подготавливаем массив строк
  // Ссылочные значения конвертируем в ID
  for (const [tableCode, rows] of Object.entries(tableData)) {
    attributes[tableCode] = rows.map((row) => {
      const cleanRow: Record<string, any> = {}
      for (const [key, value] of Object.entries(row)) {
        // Если значение — объект со свойством id (ссылка), отправляем только id
        if (value && typeof value === 'object' && 'id' in value) {
          cleanRow[key] = value.id
        } else {
          cleanRow[key] = value
        }
      }
      return cleanRow
    })
  }

  const body = { isPosted: false, attributes }

  if (entryId) {
    // Обновление
    const res = await fetch(`/api/document-entries/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  } else {
    // Создание
    const res = await fetch(`/api/document-entries/${typeCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }
}
```

### Обработка form-event для ТЧ

```typescript
async function handleFormEvent(
  typeCode: string,
  entryId: number,
  eventName: string,
  params: Record<string, any>,
  setTableData: (code: string, rows: TableRow[]) => void
) {
  const res = await fetch(
    `/api/document-entries/${typeCode}/${entryId}/form-event`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, params }),
    }
  )
  const result = await res.json()

  // Проверяем ошибки валидации
  if (result.validationError) {
    alert(result.validationError)
  }

  // Обновляем ТЧ если сервер вернул данные
  // Ключи в result, совпадающие с кодами ТЧ — это обновлённые строки
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value)) {
      setTableData(key, value as TableRow[])
    }
  }
}
```

---

## 6. Конкретный пример: документ "Регистрация заявлений по вычетам ИПН"

Этот документ имеет 2 табличные части: **ВычетыИПН** и **ГрафикВычета**.

### Метаданные

| Код атрибута       | Тип        | Описание           |
| ------------------ | ---------- | ------------------ |
| `Organizatsiya`    | DICTIONARY | Организация        |
| `FizicheskoeLitso` | DICTIONARY | Физическое лицо    |
| `VychetyIPN`       | TABLE      | ТЧ "Вычеты ИПН"    |
| `GrafikVycheta`    | TABLE      | ТЧ "График вычета" |

### Колонки ТЧ "VychetyIPN"

| Код                    | Тип        | Описание              |
| ---------------------- | ---------- | --------------------- |
| `VychetIPN`            | DICTIONARY | Ссылка на вычет       |
| `PredostavlyatVychet`  | BOOLEAN    | Предоставлять вычет   |
| `PeriodDeystviyaKonec` | DATETIME   | Период действия конец |

### Колонки ТЧ "GrafikVycheta"

| Код                      | Тип        | Описание        |
| ------------------------ | ---------- | --------------- |
| `VychetIPN`              | DICTIONARY | Ссылка на вычет |
| `PeriodDeystviyaNachalo` | DATETIME   | Начало периода  |
| `PeriodDeystviyaKonec`   | DATETIME   | Конец периода   |
| `Razmer`                 | DECIMAL    | Размер вычета   |

### Сценарий: при изменении "ФизическоеЛицо"

```typescript
// Пользователь выбрал ФизическоеЛицо — отправляем form-event
const result = await handleFormEvent(
  'RegistratsiyaZayavleniyPoVychetamIPN',
  documentId,
  'OnFizicheskoeLitsoChanged',
  {} // params — пустой, handler сам прочитает значение из entry
)

// Сервер вернёт:
// {
//   "VychetyIPN": [
//     { "VychetIPN": 15, "PredostavlyatVychet": true },
//     { "VychetIPN": 16, "PredostavlyatVychet": true }
//   ],
//   "GrafikVycheta": [
//     { "VychetIPN": 15, "PeriodDeystviyaNachalo": "2026-01-01T00:00:00", "Razmer": 14000 }
//   ]
// }
// → фронт обновляет обе ТЧ
```

### Сценарий: при изменении вычета в строке ТЧ

```typescript
// Пользователь изменил VychetIPN в строке ТЧ
await handleFormEvent(
  'RegistratsiyaZayavleniyPoVychetamIPN',
  documentId,
  'OnVychetIPNChanged',
  {
    currentDeductionCode: 'VychetMnogodetnoyKazhdogo',
    existingDeductionCodes: ['VychetOPV', 'VychetMnogodetnoyOdnogo'],
  }
)

// Если дубль/конфликт → result содержит:
// { "validationError": "ТЧ уже содержит ...", "resetDeduction": true }
// → фронт показывает ошибку и сбрасывает поле
```

### Полный JSON для сохранения документа

```json
{
  "isPosted": false,
  "attributes": {
    "Organizatsiya": 10,
    "FizicheskoeLitso": 25,
    "VychetyIPN": [
      {
        "VychetIPN": 15,
        "PredostavlyatVychet": true,
        "PeriodDeystviyaKonec": "2026-12-31T00:00:00"
      },
      {
        "VychetIPN": 16,
        "PredostavlyatVychet": true,
        "PeriodDeystviyaKonec": null
      }
    ],
    "GrafikVycheta": [
      {
        "VychetIPN": 15,
        "PeriodDeystviyaNachalo": "2026-01-01T00:00:00",
        "PeriodDeystviyaKonec": "2026-06-30T00:00:00",
        "Razmer": 14000.0
      },
      {
        "VychetIPN": 15,
        "PeriodDeystviyaNachalo": "2026-07-01T00:00:00",
        "PeriodDeystviyaKonec": "2026-12-31T00:00:00",
        "Razmer": 15000.0
      }
    ]
  }
}
```

---

## 7. Важные замечания

### Текущее состояние бэкенда

| Домен      | Запись TABLE                    | Чтение TABLE                      | Статус   |
| ---------- | ------------------------------- | --------------------------------- | -------- |
| Dictionary | DictionaryService.saveTableRows | DictionaryMapper.getValueAsObject | Работает |
| Document   | DocumentService.saveTableRows   | DocumentMapper.getValueAsObject   | Работает |

Оба домена полностью поддерживают табличные части.

### Правила

1. TABLE-значение — всегда **массив объектов** (даже если 0 строк → `[]`)
2. При сохранении отправлять **полный массив** (все строки пересоздаются)
3. Ссылочные значения в строках — передавать **ID** (число), получать **объект** `{ id, nameRu, displayName }`
4. Колонки ТЧ берутся из метаданных типа строк (отдельный запрос GET /api/document-types/{rowTypeCode})
5. `formEvent` на обычных атрибутах может возвращать данные для заполнения ТЧ — проверять ключи ответа
