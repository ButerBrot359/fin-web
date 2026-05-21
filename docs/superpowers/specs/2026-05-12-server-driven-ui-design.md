# Server-Driven UI Architecture

**Дата:** 2026-05-12  
**Статус:** Draft

## Цель

Перевести фронтенд из режима "знает про бизнес-сущности" в режим "тупой рендерер". Вся логика — какие данные показать, как нарисовать, что делать при действиях пользователя — полностью управляется бэкендом.

## Принятые решения

| Вопрос | Решение |
|--------|---------|
| Какие действия уходят на бэк | Все: клики, ввод, навигация, переключение табов |
| Модель коммуникации | Pull (фронт запрашивает, бэк отвечает) |
| Формат ответа | Полный UI-стейт при каждом ответе (не дельты) |
| Стейт сессии | Stateless — фронт шлёт все values с каждым запросом |
| Триггер события | Бэк задаёт на поле: `change`, `blur`, `debounce` |
| Валидация | Гибрид: простые правила (required, maxLength) — фронт, сложная бизнес-логика — бэк |
| Миграция | Параллельное существование: новая модель для новых страниц, старые работают как раньше |
| Архитектура бэка | Composition Layer (BFF-оркестратор) |

---

## 1. Протокол "Фронт - BFF"

Фронт знает только 3 эндпоинта:

### 1.1 Получить страницу

```
GET /api/ui/pages/{pageId}
```

`pageId` — идентификатор страницы (например `documents.invoice`, `dictionary.contractors`). Фронт получает его из роутинга.

### 1.2 Отправить событие

```
POST /api/ui/events
{
  pageId: "documents.invoice",
  event: {
    type: "field-change" | "click" | "blur" | "navigate" | "submit" | "tab-switch" | ...,
    source: "contractorField"       // ID элемента, вызвавшего событие
  },
  state: {                          // полное текущее состояние формы
    values: { contractor: "123", sum: 500, ... },
    activeTab: "main"
  }
}
```

### 1.3 Поиск для автокомплитов

```
GET /api/ui/search?endpoint={searchEndpoint}&q={query}&{...searchParams}
```

BFF проксирует на нужный сервис. Фронт не знает куда — просто шлёт на BFF.

### 1.4 Формат ответа (единый для GET page и POST event)

```typescript
interface UIPageResponse {
  pageId: string
  title: string

  // Что рисовать — рекурсивное дерево
  layout: UINode

  // Данные полей
  data: Record<string, unknown>

  // Метаданные полей (типы, лейблы, опции, видимость, валидация)
  fields: Record<string, FieldDescriptor>

  // Какие события слушать на каких элементах
  events: Record<string, EventBinding[]>

  // Команды навигации
  navigation?: NavigationAction[]

  // Серверные ошибки валидации
  errors?: Record<string, string[]>

  // Уведомления (toast)
  notifications?: Notification[]
}

interface EventBinding {
  trigger: "change" | "blur" | "debounce" | "click"
  action: string                    // имя действия, отправляется обратно на бэк
  debounceMs?: number               // только для trigger: "debounce"
}

interface NavigationAction {
  action: "redirect" | "open-tab" | "close-tab" | "back"
  to?: string                       // pageId для redirect/open-tab
  params?: Record<string, string>   // параметры страницы
}

interface Notification {
  type: "success" | "error" | "warning" | "info"
  message: string
}
```

---

## 2. FieldDescriptor

Описывает каждое поле формы:

```typescript
interface FieldDescriptor {
  type: "string" | "text" | "float" | "integer" | "boolean" | "date" | "datetime"
       | "enum-select" | "autocomplete-select" | "table"
  label: string
  visible: boolean
  readonly: boolean
  required: boolean

  // Для enum-select — фиксированный список (бэк может менять при каждом ответе)
  options?: { value: string; label: string }[]

  // Для autocomplete-select — поиск через BFF
  searchEndpoint?: string
  searchParams?: Record<string, string>   // контекстные параметры, обновляются бэком

  // Для table — описание колонок (вложенные FieldDescriptor)
  columns?: Record<string, FieldDescriptor>

  // Локальная валидация
  validation?: {
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
  }

  // Когда слать событие на бэк
  trigger?: "change" | "blur" | "debounce"
  debounceMs?: number
}
```

### Каскадные зависимости

Реализуются неявно: при событии бэк возвращает полный стейт, в котором `options` для enum-select и `searchParams` для autocomplete-select уже обновлены. Фронт не знает про зависимости — просто применяет новые значения.

---

## 3. UINode (layout дерево)

Расширение текущего `FormNode`:

```typescript
type UINode =
  // Layout-контейнеры
  | { type: "vstack"; children: UINode[]; gap?: number; flex?: number }
  | { type: "hstack"; children: UINode[]; gap?: number; flex?: number; align?: string }
  | { type: "tabs"; children: TabPane[] }
  | { type: "card"; title?: string; children: UINode[] }
  | { type: "toolbar"; children: UINode[] }

  // Поля (ссылка на FieldDescriptor по коду)
  | { type: "field"; code: string; label?: string }

  // Таблица
  | { type: "table"; code: string }

  // Интерактивные элементы
  | { type: "button"; code: string; label: string; variant?: "primary" | "secondary" | "danger" }

  // Визуальные
  | { type: "separator" }
  | { type: "label"; text: string }

  // Модальные окна
  | { type: "modal"; code: string; title: string; children: UINode[]; open: boolean }

interface TabPane {
  key: string
  label: string
  children: UINode[]
}
```

Видимость элементов: бэк просто не включает невидимый узел в `layout`.

Расширяемость: новый тип элемента = новый `type` в UINode + соответствующий React-компонент.

---

## 4. Архитектура BFF

BFF — тонкий оркестрационный слой без бизнес-логики.

### 4.1 Сервисы за BFF

```
Фронт <-> BFF (UI Orchestrator)
              |-> Page Registry Service     — какие страницы существуют, из чего состоят
              |-> Layout Service            — как рисовать (текущий form-configs)
              |-> Metadata Service          — атрибуты полей (текущий document-types)
              |-> Data Service              — данные записей (текущий document-entries)
              |-> Event Handler Service     — обработка событий, бизнес-логика
              |-> Search Service            — поиск для автокомплитов
```

### 4.2 Поток при загрузке страницы

```
GET /api/ui/pages/documents.invoice?entryId=123

BFF:
  1. Page Registry -> какие сервисы дёргать для этой страницы
  2. Параллельно:
     - Layout Service -> layout дерево
     - Metadata Service -> field descriptors
     - Data Service -> значения полей
  3. Собрать UIPageResponse
  4. Вернуть фронту
```

### 4.3 Поток при событии

```
POST /api/ui/events { pageId, event, state }

BFF:
  1. Event Handler Service -> обработать событие, получить:
     - обновлённые данные (values)
     - инструкции по изменению полей (видимость, опции, readonly)
     - уведомления, ошибки валидации
     - команды навигации
  2. Layout Service -> layout (может измениться)
  3. Metadata Service -> базовые field descriptors
  4. Смержить базовые descriptors + инструкции от Event Handler
  5. Собрать UIPageResponse
  6. Вернуть фронту
```

### 4.4 Принцип: BFF не думает

BFF не содержит `if/else` по бизнес-логике. Он:
- Знает маршруты (pageId -> какие сервисы вызвать)
- Параллелит запросы где возможно
- Мержит ответы в единый формат
- Прокидывает ошибки

Вся логика "что показать, что скрыть, какие опции отдать" — в Event Handler Service и Metadata Service.

---

## 5. Архитектура фронтенда

### 5.1 Ядро — UIPageRenderer

```
UIPageRenderer (получает UIPageResponse)
  |-> LayoutRenderer     — рекурсивно рисует дерево layout
  |-> FieldRenderer      — рисует поле по FieldDescriptor (маппит type -> компонент)
  |-> TableRenderer      — рисует таблицу, ячейки делегирует FieldRenderer-у
  |-> EventManager       — слушает действия пользователя, отправляет события на BFF
  |-> StateManager       — хранит текущие values + обновляет из ответов BFF
```

### 5.2 EventManager

Единственное место, которое знает про API. Все компоненты вызывают `emit(event)`:

```typescript
const { emit, isLoading } = useUIEvents(pageId)

// Поле:
emit({ type: "field-change", source: "contractor" })

// Кнопка:
emit({ type: "click", source: "saveBtn" })

// Навигация:
emit({ type: "navigate", source: "invoicesTab" })
```

EventManager внутри:
1. Собирает текущий `state` (все values формы)
2. Шлёт `POST /api/ui/events`
3. Получает новый `UIPageResponse`
4. Обновляет layout, data, fields, errors, notifications
5. Если пришла команда навигации — выполняет переход

### 5.3 StateManager — React Hook Form

```typescript
const form = useForm()

// При получении UIPageResponse:
// 1. form.reset(response.data) — обновить значения
// 2. Сохранить fields, layout, events в Zustand-стор
```

React Hook Form управляет значениями и локальной валидацией (из `FieldDescriptor.validation`). Но не знает про бизнес-сущности — просто key/value.

### 5.4 Роутинг

Роутер маппит URL -> pageId:

```
/documents/:typeCode/:id   ->  pageId = "documents.{typeCode}"
/dictionary/:typeCode      ->  pageId = "dictionary.{typeCode}"
```

При переходе — `GET /api/ui/pages/{pageId}`. Фронт не знает что за страница.

### 5.5 Сосуществование со старым кодом

```
App.tsx
  |-> /documents/invoice/*      ->  UIPageRenderer (новая модель)
  |-> /documents/payment/*      ->  DocumentEntryPage (старая модель)
  |-> /dictionary/contractors/*  ->  UIPageRenderer (новая модель)
  |-> /dictionary/currencies/*  ->  DictListPage (старая модель)
```

Переключение постранично. Постепенная миграция.

---

## 6. Пример полного цикла

### 6.1 Загрузка страницы счёта-фактуры

```
GET /api/ui/pages/documents.invoice
```

Ответ:

```json
{
  "pageId": "documents.invoice",
  "title": "Новый счёт-фактура",
  "layout": {
    "type": "vstack",
    "children": [
      {
        "type": "toolbar",
        "children": [
          { "type": "button", "code": "save", "label": "Сохранить", "variant": "primary" },
          { "type": "button", "code": "post", "label": "Провести" }
        ]
      },
      {
        "type": "hstack",
        "gap": 16,
        "children": [
          { "type": "field", "code": "number" },
          { "type": "field", "code": "date" },
          { "type": "field", "code": "contractor" }
        ]
      },
      { "type": "table", "code": "lines" }
    ]
  },
  "data": {
    "number": "",
    "date": "2026-05-12",
    "contractor": null,
    "lines": []
  },
  "fields": {
    "number": {
      "type": "string", "label": "Номер", "readonly": true,
      "visible": true, "required": false
    },
    "date": {
      "type": "date", "label": "Дата", "readonly": false,
      "visible": true, "required": true, "trigger": "blur"
    },
    "contractor": {
      "type": "autocomplete-select", "label": "Контрагент",
      "required": true, "visible": true, "readonly": false,
      "searchEndpoint": "/api/ui/search/contractors",
      "searchParams": {},
      "trigger": "change"
    },
    "lines": {
      "type": "table", "label": "Строки", "visible": true,
      "columns": {
        "item": {
          "type": "autocomplete-select", "label": "Номенклатура",
          "searchEndpoint": "/api/ui/search/items", "trigger": "change"
        },
        "qty": {
          "type": "float", "label": "Кол-во",
          "trigger": "blur", "validation": { "min": 0 }
        },
        "price": { "type": "float", "label": "Цена", "trigger": "blur" },
        "sum": { "type": "float", "label": "Сумма", "readonly": true }
      }
    }
  },
  "events": {
    "contractor": [{ "trigger": "change", "action": "field-change" }],
    "lines[*].item": [{ "trigger": "change", "action": "field-change" }],
    "lines[*].qty": [{ "trigger": "blur", "action": "field-change" }],
    "lines[*].price": [{ "trigger": "blur", "action": "field-change" }],
    "save": [{ "trigger": "click", "action": "submit" }],
    "post": [{ "trigger": "click", "action": "submit-post" }]
  }
}
```

### 6.2 Выбор контрагента

```json
// POST /api/ui/events
{
  "pageId": "documents.invoice",
  "event": { "type": "field-change", "source": "contractor" },
  "state": {
    "values": {
      "number": "", "date": "2026-05-12",
      "contractor": "contractor-123", "lines": []
    }
  }
}
```

Ответ — полный `UIPageResponse`, в котором:
- `fields.lines.columns.item.searchParams` обновился (номенклатура фильтруется по контрагенту)
- Возможно появилось новое поле `warehouse` в layout (бэк решил показать для этого контрагента)

### 6.3 Сохранение

```
Фронт:
  1. Локальная валидация (required, min/max)
  2. Если ок — POST /api/ui/events { event: { type: "click", source: "save" }, state: { values: {...} } }

BFF -> Event Handler:
  - Успех -> notifications: [{ type: "success", message: "Сохранено" }]
  - Ошибка валидации -> errors: { "date": ["Дата не может быть в будущем"] }
  - Редирект -> navigation: [{ action: "redirect", to: "documents.invoice", params: { id: "new-id" } }]
```

---

## 7. Что НЕ входит в скоуп

- WebSocket/SSE для push-обновлений (можно добавить позже)
- Оффлайн-режим
- Оптимистичные обновления (UI ждёт ответ BFF)
- Миграция существующих страниц (только новые страницы)
