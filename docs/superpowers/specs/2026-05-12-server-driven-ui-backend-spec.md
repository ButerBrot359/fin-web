# Server-Driven UI — Backend Spec

**Дата:** 2026-05-12
**Статус:** Draft
**Проект:** webbuh (Spring Boot)
**Связанная спека:** [Frontend spec](2026-05-12-server-driven-ui-design.md)

---

## Цель

Добавить в webbuh-api новый пакет `kz.asiaservis.ui`, который реализует Server-Driven UI — фронтенд становится "тупым" рендерером, а бэкенд полностью управляет тем, что показывать, как рисовать, и что делать при действиях пользователя.

Существующие эндпоинты (`/api/document-entries/*`, `/api/universaldomain-*/*` и т.д.) **не трогаем** — они продолжают работать. Новые эндпоинты `/api/ui/*` работают параллельно. Миграция страниц — постепенная.

---

## Принципы

- **Stateless** — сервер не хранит состояние между запросами. Фронт шлёт все текущие значения формы с каждым запросом
- **Полный ответ** — каждый ответ содержит полное описание страницы (layout + данные + метаданные полей + события). Не дельты
- **UiService не содержит бизнес-логику** — он оркестрирует существующие сервисы (DocumentService, DomainServiceRegistry, DocumentHandlerFactory, form-configs)
- **Расширяемость** — новый тип поля или элемента UI = новое значение в enum, без изменения контракта

---

## 1. Новые эндпоинты

### 1.1 Получить страницу

```
GET /api/ui/pages/{pageId}
```

Query-параметры (опциональные):
- `entryId` — ID записи (для редактирования)
- Любые доп. параметры, которые нужны для инициализации (как текущий `GET /new?param=value`)

Примеры pageId:
- `documents.prihodniy_kassoviy_order` — форма приходного кассового ордера
- `dictionary.organizatsii` — список организаций
- `documents.prihodniy_kassoviy_order.list` — список документов этого типа

### 1.2 Отправить событие

```
POST /api/ui/events
```

Request body:
```json
{
  "pageId": "documents.prihodniy_kassoviy_order",
  "event": {
    "type": "field-change",
    "source": "Organizatsiya"
  },
  "state": {
    "values": {
      "Organizatsiya": { "id": 42 },
      "Summa": 15000.00,
      "Nachisleniya": [
        { "Sotrudnik": { "id": 1 }, "Summa": 15000.00 }
      ]
    },
    "activeTab": "main"
  }
}
```

Типы событий (`event.type`):
- `field-change` — изменение значения поля
- `click` — нажатие кнопки
- `blur` — потеря фокуса поля
- `navigate` — переход (вкладка, модалка)
- `submit` — сохранение
- `submit-post` — проведение
- `tab-switch` — переключение вкладки
- `table-add-row` — добавление строки в таблицу
- `table-remove-row` — удаление строки из таблицы

### 1.3 Поиск для автокомплитов

```
GET /api/ui/search/{searchKey}?q={query}&size={size}&{...extraParams}
```

`searchKey` — ключ, который UiService резолвит в конкретный домен + typeCode. Фронт не знает куда идёт запрос.

Ответ:
```json
{
  "data": [
    { "value": "42", "label": "ООО Альфа" },
    { "value": "43", "label": "ТОО Бета" }
  ]
}
```

---

## 2. Формат ответа — UIPageResponse

Единый формат для GET `/pages` и POST `/events`:

```java
public class UiPageResponse {
    private String pageId;
    private String title;

    private UiNode layout;                              // дерево UI
    private Map<String, Object> data;                   // значения полей
    private Map<String, FieldDescriptor> fields;        // метаданные полей
    private Map<String, List<EventBinding>> events;     // привязки событий

    private List<NavigationAction> navigation;          // команды навигации (опц.)
    private Map<String, List<String>> errors;           // ошибки валидации (опц.)
    private List<Notification> notifications;           // toast-сообщения (опц.)
}
```

---

## 3. DTO-модели (в webbuh-contract)

### 3.1 UiNode — дерево UI

```java
public class UiNode {
    private String type;    // "vstack", "hstack", "tabs", "field", "table",
                            // "button", "toolbar", "card", "modal",
                            // "separator", "label"

    // Layout-контейнеры
    private List<UiNode> children;
    private Integer gap;
    private Integer flex;
    private String align;

    // Для type="field" и type="table"
    private String code;

    // Для type="button"
    private String label;
    private String variant;     // "primary", "secondary", "danger"

    // Для type="label"
    private String text;

    // Для type="tabs"
    private List<TabPane> panes;

    // Для type="card"
    private String title;

    // Для type="modal"
    private Boolean open;
}

public class TabPane {
    private String key;
    private String label;
    private List<UiNode> children;
}
```

Jackson `@JsonInclude(NON_NULL)` — пустые поля не попадают в JSON.

### 3.2 FieldDescriptor — метаданные поля

```java
public class FieldDescriptor {
    private String type;        // "string", "text", "float", "integer", "boolean",
                                // "date", "datetime", "enum-select",
                                // "autocomplete-select", "table"

    private String label;
    private boolean visible;
    private boolean readonly;
    private boolean required;

    // Для enum-select — фиксированный список
    private List<SelectOption> options;

    // Для autocomplete-select
    private String searchKey;                       // ключ для GET /api/ui/search/{searchKey}
    private Map<String, String> searchParams;       // контекстные параметры фильтрации

    // Для table — описание колонок
    private Map<String, FieldDescriptor> columns;

    // Локальная валидация (фронт применяет без запроса)
    private ValidationRules validation;

    // Когда отправлять событие на бэк
    private String trigger;     // "change", "blur", "debounce"
    private Integer debounceMs;
}

public class SelectOption {
    private String value;
    private String label;
}

public class ValidationRules {
    private Integer maxLength;
    private BigDecimal min;
    private BigDecimal max;
    private String pattern;
}
```

### 3.3 EventBinding

```java
public class EventBinding {
    private String trigger;     // "change", "blur", "debounce", "click"
    private String action;      // имя действия, которое фронт отправляет обратно
    private Integer debounceMs;
}
```

### 3.4 NavigationAction и Notification

```java
public class NavigationAction {
    private String action;      // "redirect", "open-tab", "close-tab", "back"
    private String to;          // pageId
    private Map<String, String> params;
}

public class Notification {
    private String type;        // "success", "error", "warning", "info"
    private String message;
}
```

### 3.5 UiEventRequest — запрос события

```java
public class UiEventRequest {
    private String pageId;
    private UiEvent event;
    private UiFormState state;
}

public class UiEvent {
    private String type;        // "field-change", "click", "blur", "submit", ...
    private String source;      // код поля/кнопки, вызвавшего событие
}

public class UiFormState {
    private Map<String, Object> values;
    private String activeTab;
}
```

---

## 4. Архитектура пакета

```
kz.asiaservis.ui/
├── controller/
│   └── UiController.java              // REST-контроллер /api/ui/*
├── service/
│   ├── UiService.java                 // Основной оркестратор
│   ├── PageResolver.java             // pageId → какие сервисы вызывать
│   ├── UiResponseBuilder.java        // Собирает UiPageResponse из частей
│   ├── FieldDescriptorMapper.java    // DocumentAttribute → FieldDescriptor
│   ├── LayoutAdapter.java            // FormConfig → UiNode (или fallback)
│   └── SearchKeyRegistry.java        // searchKey → domain + typeCode
├── dto/
│   └── (все DTO из секции 3, если не в webbuh-contract)
└── config/
    └── UiConfig.java                  // Конфигурация (URL form-configs и т.д.)
```

---

## 5. Логика UiService

### 5.1 GET /pages/{pageId} — загрузка страницы

```
UiService.getPage(pageId, entryId, params):

1. PageResolver.resolve(pageId)
   → { domain, typeCode, mode: "form" | "list", ... }

2. Параллельно (CompletableFuture.allOf):
   a) Получить метаданные типа:
      - Для documents: documentService.getTypeByCode(typeCode)
      - Для dictionary: domainServiceRegistry.getTypeByCode(domain, typeCode)
      → List<DocumentAttribute>

   b) Получить layout:
      - HTTP GET к form-configs: /api/configs/{typeCode}?type={domain}
      - Если нет конфига → buildFallbackLayout(attributes)
      → FormConfig (или fallback)

   c) Получить данные:
      - Если entryId != null: documentService.getEntryById(entryId)
      - Если новый: documentService.getNewEntry(typeCode, params)
      → DocumentEntryDto

   d) Получить enum-значения:
      - documentService.getOnGetFormData(typeCode)
      → Map<String, List<EnumsValueDto>>

3. Собрать UiPageResponse:
   - LayoutAdapter.toUiNode(formConfig) → layout
   - FieldDescriptorMapper.map(attributes, enumValues, entryData) → fields
   - Извлечь data из entry.attributes
   - Построить events из attributes[*].formEvent + trigger правила
   - UiResponseBuilder.build(layout, data, fields, events)
```

### 5.2 POST /events — обработка события

```
UiService.handleEvent(request):

1. PageResolver.resolve(request.pageId)
   → { domain, typeCode, ... }

2. Определить тип события:

   Если event.type == "submit" или "submit-post":
     → Сохранение/проведение записи
     a) Десериализовать state.values в DocumentEntryDto
     b) documentService.saveEntry(entryId, typeCode, dto)
     c) Вернуть UiPageResponse с:
        - notifications: [{ type: "success", message: "Сохранено" }]
        - navigation: [{ action: "redirect", to: pageId, params: { entryId: newId } }]
     d) При ошибке валидации: вернуть errors + notifications

   Если event.type == "field-change" | "blur":
     → Обработка формового события
     a) Найти атрибут по event.source
     b) Проверить что у атрибута есть formEvent
     c) Собрать FormEventRequestDto:
        - eventName = attribute.formEvent.getEventName()
        - entry = state.values (десериализовать)
     d) documentService.handleFormEvent(typeCode, formEventRequest)
     e) Получить FormEventResponseDto (обновлённые attributes + formConfig)
     f) Пересобрать полный UiPageResponse:
        - data = мержить state.values + response.attributes
        - fields = пересчитать с учётом response.formConfig
          (видимость, readonly, обновлённые options)
        - layout = пересчитать (если formConfig влияет на layout)

   Если event.type == "click" (кнопки):
     → Определить действие по event.source:
       - "save" → submit
       - "post" → submit-post
       - "print" → сгенерировать PDF, вернуть URL
       - "copy" → documentService.copyEntry()
       - "delete" → documentService.deleteEntry()
       - Кастомные → через handler

   Если event.type == "table-add-row":
     → Добавить пустую строку в state.values[tableCode]
     → Пересобрать UiPageResponse

   Если event.type == "navigate" | "tab-switch":
     → Пересобрать UiPageResponse с обновлённым activeTab
     → Или вернуть navigation action для перехода на другую страницу

3. В любом случае — вернуть полный UiPageResponse
```

### 5.3 GET /search/{searchKey} — поиск для автокомплитов

```
UiService.search(searchKey, query, size, extraParams):

1. SearchKeyRegistry.resolve(searchKey)
   → { domain: UniversalDomain, typeCode: String }

2. domainServiceRegistry.search(domain, typeCode, query, size, extraParams)
   → List<EntryDto>

3. Маппить в List<SelectOption>:
   - value = entry.id.toString()
   - label = entry.displayName
```

---

## 6. Ключевые маппинги

### 6.1 PageResolver — разбор pageId

```java
public class PageResolverResult {
    UniversalDomain domain;     // DOCUMENT, DICTIONARY, ACCOUNT_PLAN, ...
    String typeCode;            // "prihodniy_kassoviy_order"
    PageMode mode;              // FORM, LIST
}

// Правила разбора:
// "documents.{typeCode}"       → domain=DOCUMENT, typeCode, mode=FORM
// "documents.{typeCode}.list"  → domain=DOCUMENT, typeCode, mode=LIST
// "dictionary.{typeCode}"      → domain=DICTIONARY, typeCode, mode=LIST
// "dictionary.{typeCode}.form" → domain=DICTIONARY, typeCode, mode=FORM
// "accountplan.{typeCode}"     → domain=ACCOUNT_PLAN, typeCode, mode=LIST
// ... и т.д. для всех доменов
```

### 6.2 FieldDescriptorMapper — DocumentAttribute → FieldDescriptor

```
AttributeDataType    →  FieldDescriptor.type
─────────────────────────────────────────────
STRING               →  "string"
TEXT                 →  "text"
INTEGER              →  "integer"
DECIMAL              →  "float"
BOOLEAN              →  "boolean"
DATE                 →  "date"
DATETIME             →  "datetime"
ENUMS                →  "enum-select"
DICTIONARY           →  "autocomplete-select"
TABLE                →  "table"
OBJECT               →  "autocomplete-select" (с несколькими allowedTypes)

Маппинг полей:
- label         ← attribute.nameRu (или nameKz по языку)
- visible       ← attribute.showInForm
- readonly      ← attribute.readonly
- required      ← attribute.isRequired
- options       ← enumValues (для ENUMS)
- searchKey     ← генерируется: "{domain}_{typeCode}" из allowedTypes[0]
- searchParams  ← из зависимостей (dependsOn) + текущих значений формы
- validation    ← { maxLength: attribute.maxLength, min: attribute.positiveOnly ? 0 : null }
- trigger       ← если attribute.formEvent != null → "change", иначе null
- columns       ← рекурсивно для TABLE (загрузить атрибуты дочернего типа)
```

### 6.3 SearchKeyRegistry — searchKey → домен/тип

```java
// Регистрирует маппинги при старте:
// Проходит по всем типам, по всем атрибутам с dataType DICTIONARY/OBJECT,
// для каждого allowedType создаёт searchKey:
//   "dictionary_organizatsii" → { domain: DICTIONARY, typeCode: "organizatsii" }
//   "accountplan_hozraschetnyj" → { domain: ACCOUNT_PLAN, typeCode: "hozraschetnyj" }
```

---

## 7. Интеграция с существующим кодом

### Что используем напрямую (без изменений)

| Существующий класс | Как используем |
|---|---|
| `DocumentService` | getTypeByCode, getEntryById, getNewEntry, saveEntry, handleFormEvent, copyEntry, deleteEntry |
| `DomainServiceRegistry` | getTypeByCode, search, getEntries |
| `DocumentHandlerFactory` | Через handleFormEvent — без прямого вызова |
| `DocumentNumberService` | Через saveEntry — без прямого вызова |
| `EnumsService` | Получение значений enum-ов для options |

### Что нужно доработать

1. **FormEventResponseDto** — уже возвращает `attributes` + `formConfig`. Нужно стандартизировать формат `formConfig`:
   ```java
   // Сейчас: Map<String, Object> — произвольный формат
   // Предлагается: структурированный формат
   public class FormConfigUpdate {
       // Какие поля скрыть/показать
       private Map<String, Boolean> visibility;
       // Какие поля сделать readonly
       private Map<String, Boolean> readonlyFields;
       // Обновлённые опции для enum/select полей
       private Map<String, List<SelectOption>> updatedOptions;
       // Обновлённые searchParams для autocomplete полей
       private Map<String, Map<String, String>> updatedSearchParams;
   }
   ```
   Это основное изменение в существующем коде. Все хендлеры (`*FormHandler`) нужно будет обновить — вместо произвольного Map возвращать структурированный `FormConfigUpdate`.

2. **form-configs HTTP-клиент** — в webbuh-api добавить клиент для form-configs сервиса:
   ```java
   @Component
   public class FormConfigClient {
       // GET {formConfigsBaseUrl}/api/configs/{name}?type={type}
       public FormConfig getConfig(String name, String type);
   }
   ```

---

## 8. Обработка formConfig от хендлеров

Текущие хендлеры возвращают `formConfig` как `Map<String, Object>`. При пересборке `UiPageResponse` этот formConfig применяется поверх базовых `FieldDescriptor`:

```
Базовый FieldDescriptor (из атрибутов типа)
    ↓ мержим formConfig
Финальный FieldDescriptor (в ответе)

Примеры:
- formConfig.visibility["SkladPoluchatel"] = false
  → fields["SkladPoluchatel"].visible = false
  → убрать "SkladPoluchatel" из layout дерева

- formConfig.readonlyFields["Summa"] = true
  → fields["Summa"].readonly = true

- formConfig.updatedOptions["VidOperatsii"] = [...]
  → fields["VidOperatsii"].options = [...]

- formConfig.updatedSearchParams["Kontragent"]["orgType"] = "legal"
  → fields["Kontragent"].searchParams["orgType"] = "legal"
```

---

## 9. Пример: полный цикл для приходного кассового ордера

### 9.1 Загрузка новой формы

```
GET /api/ui/pages/documents.prihodniy_kassoviy_order

UiService:
  1. PageResolver → domain=DOCUMENT, typeCode="prihodniy_kassoviy_order", mode=FORM
  2. Параллельно:
     a) DocumentService.getTypeByCode("prihodniy_kassoviy_order")
        → DocumentType с 15 атрибутами
     b) FormConfigClient.getConfig("prihodniy_kassoviy_order", "DOCUMENT")
        → layout дерево (vstack → hstack → fields...)
     c) DocumentService.getNewEntry("prihodniy_kassoviy_order", params)
        → entry с дефолтами (номер, дата, организация по умолчанию)
     d) DocumentService.getOnGetFormData("prihodniy_kassoviy_order")
        → enum-значения для полей типа ENUMS
  3. Собрать UiPageResponse:
     - layout: FormConfig → UiNode дерево
     - data: { "Nomer": "PKO-000042", "Data": "2026-05-12", "Organizatsiya": {...}, ... }
     - fields: { "Nomer": { type: "string", readonly: true, ... }, ... }
     - events: { "Organizatsiya": [{ trigger: "change", action: "OnOrganizatsiyaChanged" }], ... }
```

### 9.2 Пользователь меняет организацию

```
POST /api/ui/events
{
  "pageId": "documents.prihodniy_kassoviy_order",
  "event": { "type": "field-change", "source": "Organizatsiya" },
  "state": {
    "values": { "Organizatsiya": { "id": 42 }, "Nomer": "PKO-000042", ... }
  }
}

UiService:
  1. Найти атрибут "Organizatsiya" → formEvent = ON_ORGANIZATSIYA_CHANGED
  2. DocumentService.handleFormEvent("prihodniy_kassoviy_order", {
       eventName: "OnOrganizatsiyaChanged",
       entry: { attributes: state.values }
     })
  3. Хендлер PrihodniyKassoviyOrderFormHandler:
     - Обновляет кассу по умолчанию для этой организации
     - Обновляет доступные счета
     - Возвращает: { attributes: { "Kassa": {...} }, formConfig: { visibility: {...} } }
  4. Пересобрать полный UiPageResponse:
     - data = мерж state.values + response.attributes
     - fields = базовые + formConfig (обновлённая видимость/опции)
     - layout = пересобрать (убрать скрытые поля)
```

### 9.3 Пользователь сохраняет

```
POST /api/ui/events
{
  "pageId": "documents.prihodniy_kassoviy_order",
  "event": { "type": "click", "source": "save" },
  "state": { "values": { ... все поля ... } }
}

UiService:
  1. event.source == "save" → сохранение
  2. Десериализовать state.values → DocumentEntryDto
  3. DocumentService.saveEntry(null, "prihodniy_kassoviy_order", dto)
  4. Успех → UiPageResponse с:
     - data: обновлённые данные (с ID, сгенерированным номером)
     - notifications: [{ type: "success", message: "Документ сохранён" }]
     - navigation: [{ action: "redirect", to: "documents.prihodniy_kassoviy_order",
                       params: { entryId: "123" } }]
  5. Ошибка валидации → UiPageResponse с:
     - errors: { "Summa": ["Сумма должна быть больше 0"] }
     - notifications: [{ type: "error", message: "Ошибка валидации" }]
```

---

## 10. Миграция хендлеров

### Текущий формат (не меняется)

Хендлеры продолжают работать как раньше. `UiService` вызывает их через `DocumentService.handleFormEvent()`. Единственное изменение — **стандартизация formConfig**.

### До (произвольный Map):
```java
@Override
public void handleEvent(DocumentEntry entry, String eventName, Map<String, String> params) {
    // ... бизнес-логика ...
    Map<String, Object> formConfig = new HashMap<>();
    formConfig.put("SkladPoluchatel_visible", false);
    formConfig.put("VidOperatsii_options", optionsList);
    setFormConfig(formConfig);
}
```

### После (структурированный FormConfigUpdate):
```java
@Override
public void handleEvent(DocumentEntry entry, String eventName, Map<String, String> params) {
    // ... бизнес-логика (та же) ...
    getFormConfigUpdate().setVisibility("SkladPoluchatel", false);
    getFormConfigUpdate().setReadonly("Summa", true);
    getFormConfigUpdate().setOptions("VidOperatsii", optionsList);
    getFormConfigUpdate().setSearchParams("Kontragent", Map.of("orgType", "legal"));
}
```

Миграция хендлеров — постепенная. `UiResponseBuilder` поддерживает оба формата на переходный период.

---

## 11. Что НЕ входит в скоуп

- Страницы-списки (mode=LIST) — первая итерация только формы (mode=FORM)
- WebSocket/SSE push-обновления
- Авторизация/права доступа на уровне полей (можно добавить позже через FieldDescriptor)
- Кеширование layout/metadata на стороне BFF
- Новые бизнес-хендлеры — только адаптация существующих

---

## 12. Порядок реализации (рекомендация)

1. **DTO-модели** в webbuh-contract: UiPageResponse, UiNode, FieldDescriptor, EventBinding, и т.д.
2. **UiController** — три эндпоинта, делегирует в UiService
3. **PageResolver** — разбор pageId
4. **FieldDescriptorMapper** — маппинг DocumentAttribute → FieldDescriptor
5. **LayoutAdapter** — FormConfig → UiNode (+ fallback)
6. **FormConfigClient** — HTTP-клиент к form-configs сервису
7. **SearchKeyRegistry** — реестр searchKey → domain/typeCode
8. **UiResponseBuilder** — сборка финального ответа
9. **UiService** — оркестрация всего вышеперечисленного
10. **Стандартизация formConfig** в BaseDocumentFormHandler
11. **Миграция одного хендлера** для проверки (например PrihodniyKassoviyOrderFormHandler)
