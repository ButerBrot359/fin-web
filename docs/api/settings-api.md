# Settings API (Настройки)

**Base URL:** `http://92.38.49.213:31880`
**OpenAPI spec:** [settings-api.openapi.json](./settings-api.openapi.json)

---

## Настройки модулей

### `GET /api/settings/modules/{moduleCode}`

Получить настройки модуля. Возвращает список элементов (справочники, документы, регистры и т.д.), доступных в указанном модуле.

**Path:** `moduleCode` (string, required) — код модуля

**Response:** `ModuleItemsSettings`

**Коды ответов:**

- `200` — Настройки модуля
- `404` — Модуль не найден

---

## Модели

### ModuleItemsSettings

```
items   ModuleItem[][] — список разделов модуля (разбитый по колонкам)
```

### ModuleItem

```
nameRu    string            — название раздела на русском
nameKz    string            — название раздела на казахском
elements  ModuleItemElement[] — элементы раздела
```

### ModuleItemElement

```
code    string — код элемента
type    string — тип элемента (например "Document")
nameRu  string — название на русском
nameKz  string — название на казахском
```
