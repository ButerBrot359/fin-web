# Enums API (Управление перечислениями)

**Base URL:** `http://92.38.49.213:31880`
**OpenAPI spec:** [enums-api.openapi.json](./enums-api.openapi.json)

---

## Перечисления

### `GET /api/enums`

Список всех перечислений (с пагинацией).

**Query:** `page`, `size`, `sort`
**Response:** `ApiListResponse<Enums>`

### `POST /api/enums`

Создать новое перечисление.

**Body:** `Enums` (required: `code`, `name`)

### `GET /api/enums/{code}`

Перечисление по коду (с values).

**404** если не найдено.

### `GET /api/enums/{code}/values`

Список всех значений перечисления.

**Response:** `EnumsValue[]`

### `POST /api/enums/{code}/values`

Добавить значение в перечисление.

**Body:** `EnumsValue` (required: `code`, `name`)

---

## Модели

### Enums

```
id          int64     (readonly)
code        string    (required, unique) — код перечисления
code1C      string    — код в 1С
name        string    (required) — название
isActive    boolean   (default: true)
values      EnumsValue[] — список значений
createdAt   datetime  (readonly)
updatedAt   datetime  (readonly)
```

### EnumsValue

```
id          int64     (readonly)
code        string    (required, unique в рамках enum) — код значения
code1C      string    — код в 1С
name        string    (required) — название значения
enumCode    string    — код родительского перечисления
isActive    boolean   (default: true)
createdAt   datetime  (readonly)
updatedAt   datetime  (readonly)
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
sort   string[] (например: "name,asc")
```
