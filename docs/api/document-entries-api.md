# Document Entries API (Записи документов)

**Base URL:** `http://92.38.49.213:31880`
**OpenAPI spec:** [document-entries-api.openapi.json](./document-entries-api.openapi.json)

---

## Записи документов

### `GET /api/document-entries/{typeCode}`

Все записи для указанного типа документа.

### `POST /api/document-entries/{typeCode}`

Создать запись документа.

**Body:** `DocumentEntryCreate`

### `GET /api/document-entries/{typeCode}/paged`

Записи с пагинацией.

**Query:** `page`, `size`, `sort`
**Response:** `ApiDataResponse` (внутри `ApiListResponse<DocumentEntry>`)

### `GET /api/document-entries/{typeCode}/new`

Шаблон нового документа с предзаполненными значениями по умолчанию и вычисленными полями.

**Query:** `params` (object) — дополнительные параметры

**Response:** `DocumentEntry`

### `GET /api/document-entries/id/{id}`

Запись документа по ID.

### `DELETE /api/document-entries/{id}`

Soft delete (мягкое удаление).

### `POST /api/document-entries/{typeCode}/reset-number`

Сбросить счётчик номеров до 0.

**Query:** `numberLength` (int32, optional) — длина номера (количество знаков)

---

## Печатные формы

### `GET /api/document-entries/{typeCode}/{id}/print`

Сформировать печатную форму документа (PDF). Заполняет XLSX-шаблон данными и конвертирует в PDF через LibreOffice (headless).

**Path:** `typeCode` (string), `id` (int64)
**Query:** `language` (string, optional) — пусто = русский, `Kz` = казахский

**Response:** `application/pdf`

**Коды ответов:**

- `200` — PDF-файл
- `404` — Документ не найден
- `501` — Тип документа не поддерживает печать

---

## Модели

### DocumentEntry

```
id                  int64     (readonly)
documentTypeCode    string    (readonly) — код типа документа
documentTypeCode1C  string    — код типа 1С
code                string    — номер документа (например "PKO-000001")
nameRu              string
nameKz              string
parentId            int64     — ID родителя (иерархия)
parentName          string    (readonly)
sortOrder           int32     (default: 0)
isActive            boolean   (default: true)
isPosted            boolean   (default: false) — проведён ли документ
attributes          Record<string, any> — доп. поля
children            DocumentEntry[] — дочерние записи
createdAt           datetime  (readonly)
updatedAt           datetime  (readonly)
deletedAt           datetime  (readonly)
createdBy           string    (readonly)
updatedBy           string    (readonly)
```

### DocumentEntryCreate

```
code        string    — номер документа
nameRu      string
nameKz      string
parentId    int64     (для иерархических)
sortOrder   int32     (default: 0)
isPosted    boolean   (default: false)
attributes  Record<string, any>
```
