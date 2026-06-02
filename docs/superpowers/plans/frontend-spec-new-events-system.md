# Server-Driven UI — детальная спецификация для фронта

**Статус:** v3 (stateful, patch-first)
**Источник правды (целевой дизайн):** `webbuh/docs/project/sdui/sdui-architecture.md` (с поправкой по §1 инварианту: см. ADR-0006).
**ADR:** `webbuh/docs/project/adr/ADR-0006-sdui-stateful-form-session.md` (ratified) — supersedes ADR-0005 (stateless), которая была отозвана до выкатки.
**Superseded:** `docs/superpowers/specs/2026-05-12-server-driven-ui-*.md` (старые черновики, не используются).

> **Изменение архитектуры с v2 (важно):** ранее была выбрана stateless-модель (state в каждом запросе целиком). Решение пересмотрено в пользу **stateful с form-session, revision и patch-first**. Что это значит для фронта см. §2 и §3. Контракт DTO (`ViewRequestDto/ViewResponseDto`, `ActionType`) обновлён, остальное — без изменений.

---

## 0. Как читать этот документ

Документ — рабочий справочник для фронтенд-разработчика. Каждое понятие даётся в формате **«что это → зачем нужно → как реализуется на фронте»** с примерами кода и JSON-ами, как они реально летят по сети.

Если читаешь впервые — иди по порядку (§1 → §11). Если возвращаешься за конкретикой — оглавление сверху; §6 (типы узлов), §7 (патчи), §8 (эффекты) — это reference-разделы.

Все JSON-примеры — то, что **реально летит на проводе** (после Jackson-сериализации; enum-операции патчей и эффектов в camelCase, `ActionType` в UPPER). TypeScript-типы — то, как они выглядят в `fin-web` (рекомендуется генерация из OpenAPI спека; до этого — описать руками, см. §14.1).

---

## 0.1. API эндпоинты — быстрая справка (Phase 1)

Что **реально работает** на бэке сейчас. База URL: `http://localhost:8080` локально, либо `http://92.38.49.213:31880` для стенда. OpenAPI/Swagger на `/swagger-ui.html`.

### Основной SDUI-эндпоинт

| Метод и путь | Назначение | Когда фронт зовёт |
|---|---|---|
| `POST /api/view` | Универсальный эндпоинт SDUI. Тип обращения задаёт `request.action.type`: `OPEN` / `EVENT` / `COMMAND` / `CLOSE` (§4–§9). | На монтировании `SduiScreen` (OPEN); на change/blur поля-триггера (EVENT); на клик кнопки/пункта меню (COMMAND); на размонтировании (CLOSE, либо DELETE ниже). |
| `DELETE /api/view/{formSessionId}` | Синоним `action.type=CLOSE`. Удобен в `beforeunload` через `navigator.sendBeacon(url, '')` (`POST` в beforeunload часто не успевает). | На `beforeunload` страницы. |

### Layout-метаданные (CRUD; пригодится для будущего визуального конструктора)

| Метод и путь | Назначение |
|---|---|
| `GET /api/layouts` | Список всех `LayoutDefinition` (paginated). |
| `GET /api/layouts/{code}` | Один layout по `code` (например, `ZayavkaNaRegistratsiyuGPSdelki.ФормаОбъекта`) с полным деревом узлов. |
| `POST /api/layouts` | Создать layout. |
| `PUT /api/layouts/{id}` | Обновить. |
| `DELETE /api/layouts/{id}` | Soft delete (`deletedAt`). |

> На рендеринге форм фронт **не лезет** в `/api/layouts` напрямую — layout приходит в `tree` ответа `OPEN`. Эндпоинты нужны только для будущего UI-конструктора форм.

### Dev-only (только при `spring.profiles.active=dev`)

| Метод и путь | Назначение |
|---|---|
| `GET /api/view/debug/sessions` | Список всех живых form-session: `formSessionId`, `userId`, `targetTypeCode`, `revision`, `ageSec`, `idleSec`, `expiresInSec`. Помогает понять, что в памяти сервера. |
| `GET /api/view/debug/sessions/{formSessionId}` | Детали одной сессии, включая `scratch` — накопленные не-сохранённые мутации (RAW значения по `attribute_code`). Поможет проверить, что state реально живёт между запросами. |

### Существующие эндпоинты, к которым фронт обращается косвенно

| Метод и путь | Когда вызывается |
|---|---|
| `GET /api/document-entries/{typeCode}/{id}/print?form=<formCode>&language=<Kz>` | Когда сервер вернул `effect.download(url)` для команды `print:<formCode>` — клиент открывает URL через `window.open` или `fetch+blob` и получает PDF. URL формирует бэк, фронту не нужно его собирать вручную. |
| `GET /api/{domain}/{typeCode}/entries`, `GET /api/enums/{typeCode}/values` | Для подгрузки опций `REFERENCE_FIELD` / `ENUM_FIELD` (на этапе 1 — старый путь). На этапе 2 это унифицируется через тот же `/api/view` (форма выбора как `CHOICE_FORM`). |

### Метрики (Actuator) — для мониторинга, не для UI

| Метод и путь | Что |
|---|---|
| `GET /actuator/metrics/sdui.session.active` | Gauge числа активных form-session. |
| `GET /actuator/metrics/sdui.session.evictions` | Counter эвикций по TTL. |

### Обработка 409 Conflict — формат body

Тело ответа на `STALE_REVISION` / `SESSION_NOT_FOUND` (см. §3.5 и §4.5):

```jsonc
HTTP 409
{
  "error": "STALE_REVISION" | "SESSION_NOT_FOUND",
  "formSessionId": "f3c1a0e2-...",
  "currentRevision": 13,    // только для STALE_REVISION
  "reason": "..."           // опционально, читабельная причина
}
```

Фронт перехватывает (§10.7 `ConflictHandler`): `STALE_REVISION` → ресинхрон без переоткрытия; `SESSION_NOT_FOUND` → новый `OPEN`.

---

## 1. Идея и мотивация

### 1.1. Что сейчас не так

Бизнес-логика размазана между фронтом и бэком:

- На бэке — тяжёлая логика документов (handler trio: `ObjectHandler` / `ManagerHandler` / `FormHandler`), проводки, регистры, печатные формы.
- На фронте — описание форм (JSON в отдельном Node-сервисе `form-configs-server`), статичный роутинг, per-page React-страницы (`pages/documents/*`), бизнес-логика в виджетах (`document-form-toolbar`, `document-list-toolbar`), zustand-сторы оркестрации (`useFormCacheStore`, `useTableFilterStore`, …), zod-схемы валидации.

Любое изменение формы документа = синхронные правки в трёх местах: метаданные `CoreType/Attribute` на бэке, layout-JSON в `form-configs-server`, иногда — кастомный per-page компонент. Добавить документ — на день работы.

### 1.2. Куда движемся

**Server-Driven UI (SDUI):** бэк описывает страницу целиком — из каких узлов она состоит, как разложены, что делать при действиях пользователя, — и присылает это описание. Фронт — **чистый рендерер**: умеет нарисовать узел заданного типа, собрать введённые значения и выстрелить действие. Своей бизнес-логики у фронта нет вовсе.

Преимущества:

- Новая форма / правка раскладки = правка метаданных на бэке. **Без пересборки фронта.**
- Один способ описать поведение (server events) — конец «фронт знает, когда вызывать API, а когда нет».
- Удаление дублирующей валидации (zod на фронте + `handler.onCheckFilling` на бэке) — валидация одна, на бэке, ошибки приходят как патчи.
- Один маршрут на всё (`<Route path="*">`), один транспорт (`POST /view`), один компонент-контейнер.

### 1.3. Что меняется для тебя как фронтенд-разработчика

| До | После |
|---|---|
| Пишешь страницу под каждый документ | Не пишешь страницы вообще — только тупые компоненты узлов |
| Решаешь, когда дёргать API | Не решаешь — бэк говорит, какие триггеры узла серверные |
| Валидируешь zod-схемой | Не валидируешь — бэк присылает `setProp(error)` |
| Держишь бизнес-zustand-сторы | Не держишь — есть кэш значений (`ViewStateStore`) и иммутабельное дерево |
| Используешь `react-hook-form` | Не используешь — значения управляются сверху через `value` + `onChange` |
| Резолвишь виджет по типу данных | Не резолвишь — бэк присылает конкретный `NodeType` |
| Импортируешь конфиги из `form-configs-server` | Не импортируешь — `form-configs-server` выводится из эксплуатации |
| Считаешь себя авторитетом по состоянию формы | **Не считаешь — авторитет на сервере.** У клиента кэш для рендера. |

Что **остаётся**:

- MUI как UI-библиотека.
- `axios`-клиент в `shared/api/`.
- Существующий `form-renderer` — он уже наполовину работает по модели SDUI (`NodeRenderer` со switch по типу). Эволюционируем, не сносим.

---

## 2. Инварианты архитектуры

Три правила, без которых вся модель разваливается. Запомни их и сверяйся.

### 2.1. Сервер — авторитет по состоянию формы (stateful)

> **Это ключевое решение архитектуры** (см. ADR-0006). Оно отличает SDUI WebbUh от наивной stateless-модели.

Формально: открытие формы на сервере создаёт **form-session** — объект, хранящий авторитетный `DocumentEntry` редактируемого документа. У сессии есть:

- `formSessionId` — UUID, идентифицирует сессию.
- `revision` — монотонный счётчик версий; растёт при каждой обработке `EVENT`/`COMMAND`.

Что это значит на практике:

- Сервер **помнит** состояние формы между запросами клиента. После `EVENT` поле «Контрагент» поменялось — это изменение остаётся на сервере, не нужно слать всю запись повторно.
- Клиент посылает **только дельту** в каждом запросе: какое поле/действие сработало и что пользователь ввёл локально. Никакого «весь буфер в каждом запросе».
- Клиент сверяет `revision` — присылает последний известный ему номер; при рассинхроне сервер вернёт `HTTP 409 Conflict` с указанием на потерю/устаревание сессии.

Преимущества:

- **Маленький трафик.** Даже на документе с сотнями строк таблицы клиент шлёт несколько байт — id поля + значение.
- **Защита от потерянных обновлений.** Две вкладки = две независимые сессии; на сохранении DB-уровневая оптимистическая блокировка ловит конфликт.
- **Естественные dirty/recall операции.** Хочешь отменить изменения — сервер просто закрывает сессию без сохранения.

Цена: на бэке нужен `FormSessionStore` (in-memory `ConcurrentHashMap` за интерфейсом → потом Redis для k8s). Сессии имеют TTL по idle (по умолчанию — 30 мин неактивности).

### 2.2. Клиент — рендерер и кэш состояния

Фронт делает только три вещи:

1. **Рендерит дерево.** `ViewNode` → React. Через рекурсивный `NodeRenderer` + реестр компонентов по типу.
2. **Хранит локальный кэш значений** (`ViewStateStore`). По смыслу это «как сейчас выглядят поля для пользователя». **Авторитет — на сервере**, кэш — для мгновенного рендера и оптимистических локальных обновлений между точками синхронизации.
3. **Дёргает сервер в точках синхронизации.** Триггер узла (см. §5.7) → `POST /view` с `formSessionId+revision+дельтой` → применить пришедшие патчи к дереву + актуализировать кэш + проиграть эффекты.

**Чего фронт НЕ делает:**

- Не валидирует поля (бэк присылает `setProp(error)`).
- Не вычисляет значения зависимых полей (бэк присылает `setValue`).
- Не решает, видим ли узел или readonly (бэк присылает `setProp(visible|readonly|enabled|required)`).
- Не резолвит виджет по типу данных (бэк присылает уже конкретный `NodeType`, например `REFERENCE_FIELD`).
- **Не считает себя авторитетом по значениям полей.** Если у клиента в кэше одно, а сервер прислал `setValue` с другим — побеждает сервер.
- Не хранит «бизнес-кэши» (`useFormCacheStore` и компания — на удаление).

### 2.3. Layout — это метаданные

Описание формы лежит в БД на бэке в трёх таблицах (`layout_definitions`, `layout_nodes`, `layout_node_props`). Фронт никогда не лезет к ним напрямую. Layout приходит уже собранным в виде `tree` в ответе на `OPEN`.

Следствия:

- Новый документ или правка формы → миграция/правка метаданных на бэке. Без релиза фронта.
- Конкретные layout'ы документов на фронте **не описаны вообще**. Никаких больше `ZayavkaNaRegistratsiyuGPSdelki.json` в репозитории фронта.

---

## 3. Модель состояния — детально

### 3.1. Три уровня состояния

После разворота на stateful есть **три** разных «состояния», и важно их не путать.

| Уровень | Где живёт | Авторитет | Назначение |
|---|---|---|---|
| **Persisted state** | БД (`*_entries/*_values`) | DB + handler | Сохранённый документ |
| **Session state** | Сервер, form-session в памяти | Сервер | Текущее редактирование между OPEN и save |
| **Client cache** | Фронт, `ViewStateStore` | **Сервер**, фронт лишь зеркалит | Быстрый рендер, локальная отзывчивость |

Поток данных в обычном жизненном цикле:

```
Persisted (DB)  ──OPEN──▶  Session (server)  ◀──events──▶  Client cache (frontend)
                              │                                     │
                              └──── COMMAND save ─── записывает в DB ┘
```

### 3.2. Что лежит в клиентском кэше

`ViewStateStore` — плоская мапа `binding → value`. По смыслу — что показывать в полях прямо сейчас.

```ts
{
  nomer: "ААС00-00001",
  data: "2026-04-30T07:22:00",
  organizatsiya: { id: 4021, presentation: "КГУ ..." },
  ispolzovatGrafikPlatezhey: false,
  zayavkaUtverzhdena: false,
  summaGod1: 1200000.00,
  summaGod2: 0,
  summaGod3: 0,
  summaDokumenta: 1200000.00,
  kontragent: null,
  // ...

  tablichnayaChast: [
    { rowId: 1, naimenovanie: "Услуга №1", summa: 100000 },
    { rowId: 2, naimenovanie: "Услуга №2", summa: 200000 }
  ]
}
```

**Ключи кэша = `binding`-ы узлов формы.** Когда `field.organizatsiya` приходит с `binding: "organizatsiya"`, его значение лежит в `cache.organizatsiya`. Связь — по строковому совпадению.

> Это **не источник правды**. Это зеркало серверной сессии, доступное мгновенно для рендера и оптимистических обновлений.

### 3.3. Жизненный цикл сессии

```
Браузер монтирует SduiScreen
  │
  ▼
POST /view {action:{type:'OPEN'}, layoutCode, route}
  │
  ▼
Сервер создаёт form-session, грузит DocumentEntry из БД (или новую пустую)
  │
  ▼
Ответ: {formSessionId: UUID, revision: 0, tree, state}
  │
  ▼
Клиент сохраняет formSessionId + revision, заливает state в кэш, рендерит tree
  │
  │  пользователь редактирует, фронт пишет в кэш локально
  ▼
POST /view {formSessionId, revision: 0, action:{type:'EVENT', sourceNodeId, trigger}, value}
  │
  ▼
Сервер: lookup session by id, проверяет revision == 0, применяет дельту,
        зовёт handler, формирует patches, повышает revision до 1
  │
  ▼
Ответ: {formSessionId, revision: 1, patches, statePatch?, effects}
  │
  ▼
Клиент применяет patches к дереву, мёрджит statePatch в кэш, проигрывает effects,
сохраняет revision: 1
  │
  ... повторяется ...
  │
  ▼
Пользователь нажимает «Записать»
  │
  ▼
POST /view {formSessionId, revision: N, action:{type:'COMMAND', command:'save'}}
  │
  ▼
Сервер: handler.save → persisted в БД; session остаётся жива
  │
  ▼
Ответ: {formSessionId, revision: N+1, patches, effects}
  │
  ▼
... пользователь закрывает форму / переходит на другую ...
  │
  ▼
POST /view {formSessionId, action:{type:'CLOSE'}}  (или DELETE /api/view/{formSessionId})
  │
  ▼
Сервер удаляет form-session
```

### 3.4. Локальная мутация vs точки синхронизации

Когда пользователь нажимает клавишу в поле — **записываем в кэш локально, без сети**. Это критично для отзывчивости.

```ts
// в компоненте поля
const onChange = (newValue: unknown) => {
  viewStateStore.set(node.binding, newValue)  // мгновенно, локально
}
```

Сетевой запрос идёт **только в точках синхронизации** (полный список — §9.4):

- триггер `change`/`blur` поля, **которое указано в `actions` узла как серверное**;
- клик по `BUTTON` (`COMMAND`);
- смена вкладки, если у `TAB` есть server-event.

Узел сам говорит, какие триггеры серверные, через массив `actions` в `ViewNode`. Если массив пуст — событие в сеть не идёт; локальные правки в кэше синхронизируются с сервером только при следующей серверной операции (`save`/`post`) — в этот момент **сервер сам подтянет недостающее**, потому что клиент шлёт значения изменённых полей в каждом серверном событии.

> Подсказка: если поле без server-event пользователь правил, и юзер нажал «save» — в `command` запрос можно подложить дамп изменённых полей в `state` запроса. См. §4.2 — поле `state` опциональное и допускается для этого.

### 3.5. Конфликты, потеря сессии, реконнект

В stateful-модели появляются ситуации, которых не было в stateless. Их немного, и они обрабатываются единообразно.

#### 3.5.1. Stale revision (клиент отстал)

Сервер ожидает `revision = N`, клиент прислал `revision = N-1`. Это значит, что:
- либо у клиента где-то проглочен ответ (поэтому он не повысил revision);
- либо два каких-то параллельных in-flight запроса разошлись.

Ответ сервера:

```jsonc
HTTP 409 Conflict
{
  "error": "STALE_REVISION",
  "formSessionId": "f3c1a0e2-...",
  "currentRevision": 13,
  "snapshot": {                     // снимок состояния, чтобы клиент пересинхронился
    "state": { /* ... */ },
    "patchesSinceClient": []        // или пусто, если проще переоткрыть
  }
}
```

Что делает клиент: показывает тост «Соединение потеряно, синхронизируюсь» (или silent), обновляет revision до `currentRevision`, перерисовывает поля по `snapshot.state`. Без переоткрытия дерева.

#### 3.5.2. Session not found (сессия истекла / pod рестартанул)

Клиент прислал `formSessionId`, сервер его не знает.

Ответ:

```jsonc
HTTP 409 Conflict
{
  "error": "SESSION_NOT_FOUND",
  "reason": "TTL_EXPIRED" | "SERVER_RESTART"
}
```

Что делает клиент: показывает тост «Сессия истекла, переоткрываю», шлёт новый `OPEN`. Локальный dirty-state по-возможности сохраняется и применяется после переоткрытия (это «best effort», не критично для корректности).

#### 3.5.3. Потеря соединения

- Локальные мутации продолжают работать (кэш на клиенте).
- В точке синхронизации — сетевой ошибка → тост «Нет связи», ничего не делаем (никаких автоматических ретраев — два `COMMAND save` могут испортить документ).
- Когда соединение вернулось, следующее действие пользователя автоматически синхронизирует через стандартный flow. Если сессия успела протухнуть — отработает §3.5.2.

#### 3.5.4. Параллельное редактирование (две вкладки)

Каждая вкладка — своя `form-session` с собственным `formSessionId`. На сервере две независимые копии `DocumentEntry`.

На `COMMAND save` стартует **DB-уровневая оптимистическая блокировка** (через `BaseEntity.updatedAt` или явный `version` — зависит от текущей реализации save в проекте). Конфликт сохранения возвращается из бэка как обычный патч/эффект:

```jsonc
{
  "patches": [],
  "effects": [
    { "type": "notify", "level": "error",
      "message": "Документ был изменён другим пользователем. Откройте форму заново." }
  ]
}
```

Поведение «откройте форму заново» — на этапе 2 эволюционирует в auto-reload или merge UI.

#### 3.5.5. TTL сессии и пересоздание

По умолчанию: idle 30 минут (нет запросов от клиента → сессия удаляется). Hard cap — 4 часа (даже при активности).

В **Phase 1 (in-memory, single-pod)** к этим двум причинам потери сессии добавляется третья — **рестарт пода**. Любой rolling update в k8s, autoscaling или перепланирование выбрасывает все активные сессии этого пода (ответ `SESSION_NOT_FOUND` с `reason: SERVER_RESTART`). Это случается чаще, чем интуитивно ожидается — каждый деплой бэка. Для бухгалтерского документа, который заполняется минуты, это терпимо, но фронт обязан корректно обрабатывать `SESSION_NOT_FOUND` (см. §3.5.2): тост + автоматическое переоткрытие через `OPEN`. Phase 1 и Phase 2 — что это и когда переходить, см. §17.1.

В **Phase 2 (Redis-backed)** рестарты пода перестают быть фактором — сессия переживает деплой.

Чтобы не терять долго заполняемую форму, фронту рекомендуется отправлять **heartbeat** каждые ~5 минут — `POST /view` с `action.type=EVENT` без `sourceNodeId` (или дополнительный action — уточним при дизайне `view/`-пакета на бэке). На MVP можно жить без heartbeat — пользователь видит «сессия истекла» и переоткрывает.

---

## 4. Контракт обмена POST /view

### 4.1. Эндпоинт

```
POST /view
Content-Type: application/json
Accept: application/json
```

Один эндпоинт на всё. Любая страница — это `/view`. Тип взаимодействия задаётся полем `action.type`.

Альтернативный: `DELETE /api/view/{formSessionId}` — явное закрытие сессии (то же, что `action.type=CLOSE`). Оба варианта должны работать; фронт может использовать `DELETE` через `beforeunload` (где `POST` уже не успеет).

### 4.2. ViewRequest

```ts
interface ViewRequest {
  formSessionId?: string                  // null на OPEN; обязателен на EVENT/COMMAND/CLOSE
  revision?:      number                  // null на OPEN; обязателен на EVENT/COMMAND
  layoutCode?:    string                  // обязателен на OPEN; на EVENT/COMMAND — игнорируется
  route?:         string                  // используется бэком на OPEN
  action:         ViewAction
  state?:         Record<string, unknown> // ТОЛЬКО для OPEN нового документа — предустановки
}

interface ViewAction {
  type:          'OPEN' | 'EVENT' | 'COMMAND' | 'CLOSE'
  sourceNodeId?: string                   // для EVENT — id узла-источника
  trigger?:      string                   // для EVENT — "change" | "blur" | "click" | ...
  command?:      string                   // для COMMAND — "save" | "post" | "print:..." | ...
  value?:        unknown                  // для EVENT — новое значение изменённого поля
}
```

| Поле | Зачем |
|---|---|
| `formSessionId` | Идентифицирует серверную сессию. На `OPEN` — `null` (сервер создаст новую и вернёт id). На остальных — обязателен. |
| `revision` | Защита от рассинхрона. На `OPEN` — `null`. На остальных — последний известный клиенту номер ревизии. Если расходится с серверным — HTTP 409 (см. §3.5). |
| `layoutCode` | Уникальный код layout'а. Бэк по нему резолвит описание формы из БД. На `OPEN` фронт берёт его из роута либо оставляет пустым (`null`/`""`) — бэк выведет по `route`. |
| `route` | Текущий URL экрана. Нужен бэку на `OPEN` для распарса контекста (id записи, режим создания). |
| `action` | Тип взаимодействия — см. §4.3. |
| `state` | **Опционально, только на OPEN.** Предустановленные значения для нового документа (например, `VidOperatsii` из query-параметра). Во всех остальных случаях не нужно — авторитет на сервере. |

### 4.3. ViewAction — четыре типа

#### OPEN — открытие экрана

```jsonc
{ "type": "OPEN" }
```

Что фронт шлёт целиком:

```jsonc
{
  "layoutCode": null,                              // или код, если фронт уже знает
  "route":      "/documents/ZayavkaNaRegistratsiyuGPSdelki/1",
  "action":     { "type": "OPEN" },
  "state":      {}                                  // или {"VidOperatsii": "OformlenieZayavki"} для нового
}
```

Поля `formSessionId` и `revision` отсутствуют (сервер создаст сессию).

#### EVENT — сработало поле-триггер

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      12,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.kontragent",
    "trigger":      "change",
    "value":        { "id": 5012, "presentation": "ТОО Альфа" }
  }
}
```

`value` — то самое новое значение, которое пользователь ввёл локально. Сервер применит его в свою сессию.

> Почему `value` в `action`, а не в `state`? Концептуально это «единичное изменение, инициировавшее событие». Если ты редактируешь несколько полей подряд без server-events, локальные значения накопятся в кэше — и попадут на сервер лишь тогда, когда сработает следующее серверное событие. Если хочешь, чтобы они применились вместе с событием, шли их в `state` отдельным мёрджем (опционально). Точный шаблон утвердим при реализации `view/`-пакета — пока на MVP используй `action.value`.

#### COMMAND — нажата кнопка / команда

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      12,
  "action": {
    "type":    "COMMAND",
    "command": "save"
  }
}
```

Стандартные команды (поставляются `CommandRegistry` бэка): `save`, `saveAndClose`, `post`, `unpost`, `postAndClose`, `print:<formCode>`, `delete`, `copy`. Дополнительные — задаются `ManagerHandler`-ом конкретного типа.

#### CLOSE — клиент закрывает форму

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "action":        { "type": "CLOSE" }
}
```

Сервер удаляет сессию. Ответ может быть пустым (`200 OK { formSessionId, revision: -1 }`) или вообще без тела (`204 No Content`).

Альтернатива: `DELETE /api/view/{formSessionId}` — короче, годится для `beforeunload`-хука (`navigator.sendBeacon`).

### 4.4. ViewResponse

```ts
interface ViewResponse {
  formSessionId: string                    // всегда; на OPEN — новый id, на остальных — тот же, что прислал клиент
  revision:      number                    // всегда; новая ревизия после обработки

  // приходит на OPEN
  tree?:         ViewNode
  state?:        Record<string, unknown>

  // приходит на EVENT / COMMAND
  patches?:      ViewPatch[]
  statePatch?:   Record<string, unknown>   // опциональное зеркало значений из patches.setValue
  effects?:      ViewEffect[]
}
```

| Поле | Когда |
|---|---|
| `formSessionId` | Всегда. На `OPEN` — новый id. На `EVENT`/`COMMAND`/`CLOSE` — id, прислан клиентом. |
| `revision` | Всегда. После обработки увеличена. Клиент обязан сохранить и слать в следующем запросе. |
| `tree` + `state` | Только на `OPEN`. Полное дерево + снимок состояния для рендера. |
| `patches`, `statePatch`, `effects` | Только на `EVENT`/`COMMAND`. |

Простое правило: какой `action.type` ушёл — какой набор полей придёт. `formSessionId` и `revision` приходят всегда.

### 4.5. Обработка ошибок

| Случай | Что фронт делает |
|---|---|
| HTTP 200 с патчами `setProp(error)` | Применить — поля покажут ошибки валидации |
| HTTP 409 `STALE_REVISION` | Тост «Синхронизирую»; обновить `revision` и `state` из `snapshot` |
| HTTP 409 `SESSION_NOT_FOUND` | Тост «Сессия истекла»; отправить новый `OPEN`, восстановить dirty по возможности |
| HTTP 4xx с другим телом | Тост «Ошибка запроса» |
| HTTP 5xx | Тост «Сервер недоступен». Не реплеить. |
| Тайм-аут | Тост «Истёк тайм-аут». Не реплеить. |
| Бэк прислал `NodeType`, которого нет в реестре | Рендерить плейсхолдер (см. §16). Не падать. |

---

## 5. ViewNode — структура и семантика

```ts
interface ViewNode {
  id:        string
  type:      NodeType
  props?:    Record<string, unknown>
  binding?:  string
  value?:    unknown
  children?: ViewNode[]
  actions?:  { trigger: string; actionId: string }[]
}
```

### 5.1. `id` — стабильный код узла

Адрес узла для всех патчей. Обязан быть **стабильным** между запросами: если в `OPEN`-ответе пришёл узел с `id: "field.org"`, то в любом будущем `EVENT`/`COMMAND`-ответе патч с `nodeId: "field.org"` должен находить этот же узел.

**Формат:** ASCII, можно с точками (`field.dogovor`, `tab.main`, `btn.post`). Для **строк таблицы** id составной: `"<tableId>/row-<rowId>"`, например `"table.tch/row-12"`. Это позволяет адресовать конкретную строку.

**Что НЕ делать:**

- Не регенерируй `id` на клиенте (например, на основе индекса). Он приходит от бэка и хранится как есть.
- Используй `id` как React `key`.

### 5.2. `type`

Один из 31 значения каталога `NodeType` (см. §6). Закрытый enum, общий между бэком и фронтом. Фронт регистрирует ровно один React-компонент на каждый `type` в реестре.

Если бэк прислал `type`, которого нет в реестре (рассинхрон выкаток) — рендерим плейсхолдер, см. §16.

### 5.3. `props`

Плоский объект ключ-значение. Набор зависит от `type` (§6). Это «статика» узла на момент его прихода. Бэк меняет props динамически патчем `setProp(nodeId, key, value)`.

### 5.4. `binding`

`string | undefined`. Заполнен у полей (`TEXT_FIELD`, `NUMBER_FIELD`, `REFERENCE_FIELD`, …), пуст у не-полей (`VSTACK`, `LABEL`, `TOOLBAR`, …).

Значение `binding` — ключ в локальном кэше. Если у узла `binding: "organizatsiya"`, его значение лежит в `cache.organizatsiya`.

**Контракт:**

- При рендере поле читает значение из `cache[node.binding]`, а **не** из `node.value` (см. ниже).
- При изменении пишет `viewStateStore.set(node.binding, newValue)` и (если есть server-event) шлёт `EVENT` с этим значением в `action.value`.

### 5.5. `value` — начальное значение

Поле приходит с `value` только в `OPEN`-ответе и означает «вот текущее значение в момент открытия». Фактически дублирует то, что лежит в `response.state[binding]`. После `OPEN` фронт работает только с кэшем, а `value` на узле может игнорировать.

Изменения значений приходят через `patches: [{op:"setValue", binding, value}]` (и/или дублируются в `statePatch`).

### 5.6. `children`

Массив вложенных `ViewNode`. У `VSTACK`/`HSTACK`/`GRID`/`GROUP` — содержимое контейнера. У `TABS` — массив `TAB`-узлов. У `TABLE` — массив `TABLE_COLUMN` (колонки), а **строки** живут в `cache[binding]` как массив объектов (не в `children`).

### 5.7. `actions` — серверные триггеры узла

Массив `{ trigger: string; actionId: string }`. Описывает, на какие пользовательские события узел должен дёргать сервер.

| `actionId` | Что | В каком `action.type` |
|---|---|---|
| `"fieldEvent"` | Изменение/blur поля обрабатывает бэк | `EVENT` |
| `"command"` | Кнопка/пункт меню — выполнить команду | `COMMAND` |
| `"navigate"` | Ссылка-навигация — через бэк (для проверки прав и т.п.) | `EVENT` или `COMMAND` |

`trigger` — `"change"`, `"blur"`, `"click"` и т.п.

Пустой массив или отсутствующее поле = узел НЕ ходит на сервер. Локальные изменения копятся в кэше до следующей точки синхронизации.

---

## 6. Каталог NodeType — детально

Закрытый enum из 31 значения. Источник правды — `webbuh-contract/.../enums/NodeType.java` (там `@Schema` на каждом значении).

> Подсказка про «storage vs wire»: в БД (`layout_nodes.node_type`) хранится **обобщённый** `LayoutNodeType` (24 значения), у которого 9 типов полей схлопнуты в один `FIELD`. Конкретный виджет (`TEXT_FIELD`/`REFERENCE_FIELD`/…) резолвится бэковым `WidgetResolver`-ом из `CoreAttribute.dataType` при сборке `ViewTree`. **Фронт работает только с `NodeType` (wire)** — `LayoutNodeType` его не касается.

### 6.1. Оболочка (4 типа)

#### `APP_SHELL`
**Что:** корневой узел оболочки приложения.
**Зачем:** одна большая «рамка» для всего, что не относится к конкретному экрану.
**Props:** —
**Children:** `TOP_BAR`, `SIDEBAR`, `WORKSPACE` + слот «контент».
**Как рендерить:** контейнер с сеткой (top + side + main + workspace).

#### `TOP_BAR`
**Что:** верхняя панель.
**Props:** —
**Children:** обычно `ICON`-логотип, `TEXT`-поиск, `BADGE`, `ICON`-кнопки (`MENU_ITEM` для выпадашек).
**Как рендерить:** MUI `AppBar`.

#### `SIDEBAR`
**Что:** боковое меню.
**Props:** `collapsed: boolean`.
**Children:** `LINK`/`MENU_ITEM` пункты.
**Как рендерить:** MUI `Drawer` или собственный.

#### `WORKSPACE`
**Что:** панель вкладок рабочих столов.
**Children:** `TAB`-подобные узлы.
**Как рендерить:** горизонтальная панель табов под `TOP_BAR`.

> На этапе 1 живём со старым `widgets/sidebar`, `widgets/top-bar`, `widgets/workspace-tab-bar`. Оболочка мигрирует позже.

### 6.2. Компоновка (10 типов)

#### `PAGE`
**Props:** `title`, `kind` (`OBJECT_FORM` | `LIST_FORM` | …).
**Как рендерить:** `<div>` с padding'ом; может проставлять `document.title`.

#### `VSTACK`
**Props:** `gap`, `padding`, `align`, `flex?`.
**Как рендерить:** flexbox column.

#### `HSTACK`
**Props:** `gap`, `justify`, `align`, `flex?`.
**Как рендерить:** flexbox row.

#### `GRID`
**Props:** `columns: number`, `gap: number`.
**Как рендерить:** CSS Grid с `grid-template-columns: repeat(columns, 1fr)`.

#### `GROUP`
**Props:** `title`, `collapsible?`, `collapsed?`.
**Как рендерить:** MUI `Paper` с легендой.

#### `TABS`
**Props:** —
**Children:** массив `TAB`.
**Как рендерить:** MUI `Tabs` + `TabPanel`. Активную вкладку держи локальным React-стейтом — это **презентационное** состояние, если у `TAB` нет `actions`.

#### `TAB`
**Props:** `title`, `icon?`, `badge?`.

#### `TOOLBAR`
**Props:** —
**Children:** `BUTTON`, `MENU_ITEM`, `SEPARATOR`.

> Содержимое `TOOLBAR` собирается на бэке `CommandComposer`-ом из `CommandRegistry` + флагов-возможностей типа + кастомных команд `ManagerHandler`. Тебе достаточно отрендерить пришедших детей.

#### `SEPARATOR`
**Props:** `orientation: 'horizontal'|'vertical'`.
**Как рендерить:** MUI `Divider`.

#### `SPACER`
**Props:** —
**Как рендерить:** `<div style={{flex:1}}/>`.

### 6.3. Отображение (4 типа)

#### `LABEL`
**Props:** `text`, `variant: 'default'|'link'|'heading'`.
**Actions:** для variant=link может иметь `{trigger:"click", actionId:"fieldEvent"}`.
**Как рендерить:** `Typography`.

#### `TEXT`
**Props:** `text`.
**Как рендерить:** `Typography`.

#### `BADGE`
**Props:** `text`, `color: 'default'|'success'|'warning'|'error'|'info'`.
**Как рендерить:** MUI `Chip`.

#### `ICON`
**Props:** `name`.
**Как рендерить:** MUI `Icon` или `@mui/icons-material/<Name>`.

### 6.4. Поля ввода (8 типов)

Общий контракт:

- **Обязательно** `binding`.
- **Общие props:** `label`, `required`, `readonly`, `visible`, `enabled`, `error?`.
- **Общие actions:** для серверных триггеров — `{trigger:"change"|"blur", actionId:"fieldEvent"}`.

Шаблон компонента (стейтфул-вариант, обрати внимание на dispatch с `value`):

```tsx
const TextField: FC<NodeProps> = ({ node }) => {
  const value = useViewState(node.binding) as string ?? ''
  const setValue = useViewStateSetter(node.binding)
  const dispatch = useSduiDispatch()
  const visible = node.props?.visible ?? true
  const readonly = node.props?.readonly ?? false
  const required = node.props?.required ?? false
  const error = node.props?.error as string | undefined

  if (!visible) return null

  const fireServerEvent = (trigger: 'change' | 'blur', newValue: unknown) => {
    if (node.actions?.some(a => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      dispatch({
        type: 'EVENT',
        sourceNodeId: node.id,
        trigger,
        value: newValue,
      })
    }
  }

  return (
    <MuiTextField
      label={node.props?.label}
      value={value}
      required={required}
      disabled={readonly}
      error={!!error}
      helperText={error}
      onChange={e => setValue(e.target.value)}
      onBlur={e => fireServerEvent('blur', e.target.value)}
    />
  )
}
```

#### `TEXT_FIELD`
**Props (доп):** `placeholder?`, `maxLength?`, `mask?`.

#### `TEXT_AREA`
**Props (доп):** `rows?: number`.
**Как рендерить:** MUI `TextField multiline rows={rows}`.

#### `NUMBER_FIELD`
**Props (доп):** `precision?`, `min?`, `max?`, `positiveOnly?`.

#### `DATE_FIELD`
**Props:** `min?`, `max?` (ISO).
**Значение в кэше:** ISO date `"2026-04-30"`.
**Как рендерить:** MUI `DatePicker`.

#### `DATETIME_FIELD`
**Props:** `min?`, `max?` (ISO).
**Значение в кэше:** ISO datetime `"2026-04-30T07:22:00"`.
**Как рендерить:** MUI `DateTimePicker`.

#### `CHECKBOX_FIELD`
**Props:** `label`.
**Значение в кэше:** `boolean`.
**Как рендерить:** MUI `Checkbox` + `FormControlLabel`.

#### `ENUM_FIELD`
**Props:** `options: { value: string; label: string }[]`.
**Значение в кэше:** строковый код.
**Как рендерить:** MUI `Select`.

`options` может прийти изначально в `props.options` или динамически — патчем `setOptions(nodeId, options)`.

#### `REFERENCE_FIELD`
**Props:**
- `domain: 'DICTIONARY' | 'DOCUMENT' | 'ACCOUNT_PLAN' | …`
- `targetTypeCode: string`
- `selectionMode?: 'single' | 'multiple'`
- `allowCreate?: boolean`
- `filter?: Record<string, unknown>`
**Значение в кэше:** `{ id: number; presentation: string } | null`.
**Как рендерить:** MUI `Autocomplete` с серверным поиском (см. §6.7).

### 6.5. Составные (3 типа)

#### `TABLE`
**Props:** `label?`, `allowAdd`, `allowDelete`, `allowReorder`.
**Binding:** обязательно. Значение в кэше — массив объектов-строк.
**Children:** `TABLE_COLUMN`.
**Как рендерить:** MUI `DataGrid` или существующий `widgets/eav-entity-table` после очистки.

**Адресация строк:** строки — узлы дерева с `id` вида `"<tableId>/row-<rowId>"`. Изменение строки бэк присылает как `setValue` с binding-ом вида `"<tableBinding>/<rowId>/<columnAttribute>"`. Точный формат утвердим при первом use case (документ ЗаявкаГПСделки — без таблицы).

#### `TABLE_COLUMN`
**Props:** `header`, `width?`, `attributeCode`, `readonly?`.
**Как рендерить:** декларация колонки для родительского `TABLE`.

#### `OBJECT_FIELD`
**Props:** `allowedTypes: NodeType[]`.
**Как рендерить:** селектор типа + рендер вложенного псевдо-поля. На MVP — placeholder.

### 6.6. Действия (3 типа)

#### `BUTTON`
**Props:** `label`, `icon?`, `variant?` (`primary`|`secondary`|`dropdown`|`icon`), `command`, `enabled?`.
**Actions:** `[{trigger:"click", actionId:"command"}]`.
**Children:** для `variant:"dropdown"` — массив `MENU_ITEM`.
**Как рендерить:**

```tsx
const ButtonNode: FC<NodeProps> = ({ node }) => {
  const dispatch = useSduiDispatch()
  const enabled = node.props?.enabled ?? true
  return (
    <Button
      variant={node.props?.variant}
      disabled={!enabled}
      onClick={() => dispatch({
        type: 'COMMAND',
        command: node.props.command as string,
        sourceNodeId: node.id,
      })}
    >
      {node.props.label}
    </Button>
  )
}
```

#### `MENU_ITEM`
**Props:** `label`, `icon?`, `command`.
**Actions:** аналогично `BUTTON`.

#### `LINK`
**Props:** `text`, `route` (внутренний URL), `external?`.
**Actions:** `[{trigger:"click", actionId:"navigate"}]`.
**Как рендерить:** `<a>`/`<RouterLink>`. Если в `actions` есть navigate — клик идёт через сервер (даёт бэку шанс проверить права или закрыть форму).

### 6.7. Источник данных для REFERENCE_FIELD / ENUM_FIELD

На этапе 1 — продолжаем использовать существующие эндпоинты `/api/{domain}/{typeCode}/entries`. На этапе 2 — унифицируется через тот же `/view` (форма выбора как `CHOICE_FORM`).

---

## 7. Патчи — ViewPatch детально

```ts
type PatchOp =
  | 'setProp' | 'setValue'
  | 'replaceNode' | 'insertNode' | 'removeNode' | 'moveNode'
  | 'setOptions'

interface ViewPatch {
  op:        PatchOp
  nodeId?:   string
  binding?:  string
  key?:      string
  value?:    unknown
  parentId?: string
  index?:    number
  node?:     ViewNode
  options?:  unknown
}
```

### 7.1. `setProp`
**Поля:** `nodeId`, `key`, `value`.
**Что значит:** «у узла `nodeId` поменяй `props[key]` на `value`».

```jsonc
{ "op": "setProp", "nodeId": "field.dogovor", "key": "enabled",  "value": true }
{ "op": "setProp", "nodeId": "field.summa",   "key": "error",    "value": "Сумма обязательна" }
{ "op": "setProp", "nodeId": "group.bank",    "key": "visible",  "value": false }
```

### 7.2. `setValue`
**Поля:** `binding`, `value`.
**Что значит:** «значение поля `binding` поменяй на `value` в кэше».

```jsonc
{ "op": "setValue", "binding": "summaDokumenta", "value": 1850000 }
```

Сервер авторитетен — `setValue` перетирает локальное значение в кэше. Не пытайся «не перетирать, потому что я только что вводил» — сервер прав.

### 7.3. `replaceNode`
**Поля:** `nodeId`, `node`.
**Что значит:** «замени узел `nodeId` целиком на `node`».

### 7.4. `insertNode`
**Поля:** `parentId`, `index`, `node`.
**Что значит:** «в `children` родителя `parentId` на позицию `index` вставь `node`».

```jsonc
{ "op": "insertNode", "parentId": "table.tch", "index": 2,
  "node": { "id": "table.tch/row-99", "type": "TABLE_COLUMN", /* ... */ } }
```

### 7.5. `removeNode`
**Поля:** `nodeId`.

### 7.6. `moveNode`
**Поля:** `nodeId`, `parentId`, `index`.

### 7.7. `setOptions`
**Поля:** `nodeId`, `options`.

```jsonc
{ "op": "setOptions", "nodeId": "field.dogovor",
  "options": [ { "id": 88, "presentation": "Договор №12" } ] }
```

Или для серверного поиска — обновление фильтра:

```jsonc
{ "op": "setOptions", "nodeId": "field.dogovor",
  "options": { "filter": { "Organizatsiya": 1001, "Vladelets": 5012 } } }
```

### 7.8. PatchApplier — алгоритм

```ts
function applyPatches(root: ViewNode, patches: ViewPatch[]): ViewNode {
  return patches.reduce((tree, patch) => applyOne(tree, patch), root)
}

function applyOne(root: ViewNode, patch: ViewPatch): ViewNode {
  switch (patch.op) {
    case 'setProp':
      return updateNode(root, patch.nodeId!, n => ({
        ...n, props: { ...n.props, [patch.key!]: patch.value }
      }))
    case 'setValue':
      // дерево не меняется — обработай отдельно в ViewStateStore
      return root
    case 'replaceNode':
      return updateNode(root, patch.nodeId!, () => patch.node!)
    case 'insertNode':
      return updateNode(root, patch.parentId!, parent => ({
        ...parent,
        children: insertAt(parent.children ?? [], patch.index!, patch.node!)
      }))
    case 'removeNode':
      return removeNode(root, patch.nodeId!)
    case 'moveNode':
      const removed = findNode(root, patch.nodeId!)!
      const without = removeNode(root, patch.nodeId!)
      return updateNode(without, patch.parentId!, parent => ({
        ...parent,
        children: insertAt(parent.children ?? [], patch.index!, removed)
      }))
    case 'setOptions':
      return updateNode(root, patch.nodeId!, n => ({
        ...n, props: { ...n.props, options: patch.options }
      }))
  }
}

function updateNode(root: ViewNode, id: string, mutate: (n: ViewNode) => ViewNode): ViewNode {
  if (root.id === id) return mutate(root)
  if (!root.children) return root
  let changed = false
  const newChildren = root.children.map(c => {
    const u = updateNode(c, id, mutate)
    if (u !== c) changed = true
    return u
  })
  return changed ? { ...root, children: newChildren } : root
}
```

Иммутабельность важна, чтобы React увидел изменение и перерендерил поддерево.

**Применение `setValue`** идёт отдельным циклом по `patches` в `ViewStateStore`:

```ts
function applyValuePatchesToCache(patches: ViewPatch[]) {
  patches
    .filter(p => p.op === 'setValue')
    .forEach(p => viewStateStore.set(p.binding!, p.value))
}
```

---

## 8. Эффекты — ViewEffect детально

```ts
type EffectType = 'navigate' | 'openDialog' | 'closeDialog' | 'notify' | 'download'

interface ViewEffect {
  type:     EffectType
  route?:   string
  node?:    ViewNode
  id?:      string
  level?:   string
  message?: string
  url?:     string
}
```

### 8.1. `navigate`
**Поля:** `route`.

```ts
case 'navigate':
  // ВАЖНО: перед navigate отправь CLOSE текущей сессии, иначе она протухнет по TTL
  void dispatch({ type: 'CLOSE' })
  router.navigate(effect.route!)
  break
```

### 8.2. `openDialog`
**Поля:** `node` (поддерево модалки).

Модалка — это **отдельная form-session** на бэке, со своим `formSessionId`/`revision`. Когда бэк присылает `openDialog`, в `node.props` приходят `formSessionId`/`revision` для модалки.

```ts
case 'openDialog':
  dialogStack.push({
    node: effect.node!,
    formSessionId: effect.node!.props!.formSessionId as string,
    revision: effect.node!.props!.revision as number,
  })
  break
```

### 8.3. `closeDialog`
**Поля:** `id` (id корневого узла модалки).

Закрывает модалку и шлёт `CLOSE` её session.

### 8.4. `notify`
**Поля:** `level` (`'info'|'success'|'warning'|'error'`), `message`.

```ts
case 'notify':
  toast[effect.level!](effect.message!)
  break
```

### 8.5. `download`
**Поля:** `url`.

```ts
case 'download':
  window.open(effect.url!, '_blank')
  break
```

### 8.6. EffectHandler

```ts
class EffectHandler {
  play(effect: ViewEffect): void {
    switch (effect.type) {
      case 'navigate':    /* + закрыть текущую сессию */; this.deps.router.navigate(effect.route!); break
      case 'openDialog':  this.deps.dialogStack.push(effect.node!); break
      case 'closeDialog': this.deps.dialogStack.close(effect.id!); break
      case 'notify':      this.deps.toast(effect.level!, effect.message!); break
      case 'download':    window.open(effect.url!, '_blank'); break
    }
  }
  playAll(effects: ViewEffect[]) { effects.forEach(e => this.play(e)) }
}
```

---

## 9. Жизненный цикл сцены

### 9.1. OPEN детально

Фронт делает `OPEN`:

- Маршрут открылся впервые.
- Маршрут поменялся внутри `SduiScreen`.
- После `effect.navigate`.
- После «обновить» / restore из ошибки `SESSION_NOT_FOUND`.

Запрос:

```jsonc
{
  "action": { "type": "OPEN" },
  "route":  "/documents/ZayavkaNaRegistratsiyuGPSdelki/1",
  "state":  {}    // или предустановки для нового документа
}
```

Ответ: `{ formSessionId, revision, tree, state }`. Фронт:

1. Сохраняет `formSessionId` и `revision` в `SduiScreen`-стейте.
2. `treeStore.setRoot(tree)`.
3. `viewStateStore.replaceAll(state ?? {})`.
4. Рендерит `<NodeRenderer node={tree} />`.

### 9.2. EVENT детально

Триггерит компонент поля, у которого в `actions` есть `{trigger:"change"|"blur", actionId:"fieldEvent"}`.

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      12,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.kontragent",
    "trigger":      "change",
    "value":        { "id": 5012, "presentation": "ТОО Альфа" }
  }
}
```

Ответ: `{ formSessionId, revision: 13, patches, statePatch?, effects }`. Фронт:

1. Обновляет `revision` до пришедшего.
2. `treeStore.applyPatches(patches ?? [])`.
3. Применяет `setValue`-патчи к кэшу + мёрджит `statePatch ?? {}`.
4. `effectHandler.playAll(effects ?? [])`.

Порядок важен: revision → patches к дереву → значения в кэш → эффекты.

### 9.3. COMMAND детально

Триггерит `BUTTON` или `MENU_ITEM`.

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      13,
  "action":        { "type": "COMMAND", "command": "post" }
}
```

Типичные сценарии:

- `command: "save"` → запись в БД. `effects: [{type:"notify", level:"success", message:"Записано"}]`, `patches: [setProp(page, title, "...")]`. Сессия остаётся живой.
- `command: "post"` → проводка. `patches: [setProp(btn.post, label, "Отменить проведение"), setProp(btn.post, command, "unpost")]`.
- `command: "postAndClose"` → проводка + `effects: [{type:"navigate", route:"/documents/.../list"}]` (фронт перед navigate отправит CLOSE).
- `command: "print:ZayavkaForm"` → `effects: [{type:"download", url:"..."}]`.
- Ошибки валидации → `patches: [setProp(field.x, error, "...")]` + `notify(error)`.

### 9.4. Точки синхронизации

Полный список, когда фронт идёт в сеть:

1. **Монтирование `SduiScreen`** → `OPEN`.
2. **Change/blur поля-триггера** → `EVENT`.
3. **Click `BUTTON`/`MENU_ITEM`** → `COMMAND` (`save`/`saveAndClose`/`post`/`postAndClose`/`unpost`/`print:<formCode>`/custom).
4. **Click `LINK` или `LABEL`-link** с `actions[].actionId:"navigate"` → `EVENT` или `COMMAND`.
5. **Смена `TAB`** с server-event → `EVENT`.
6. **Демонтирование `SduiScreen`** → `CLOSE` (через `beforeunload` / `useEffect cleanup`).
7. **(Опционально) heartbeat** каждые ~5 мин для активной формы → `EVENT` с пустым action или специальный `HEARTBEAT` (введём при необходимости).

---

## 10. Архитектура движка на фронте

### 10.1. Карта новых модулей

```
src/features/sdui/
├── api/
│   └── view-transport.ts          # axios-обёртка над POST /view + DELETE /api/view/{id}
├── lib/
│   ├── view-state-store.ts        # кэш (zustand)
│   ├── tree-store.ts              # текущее дерево + formSessionId + revision
│   ├── patch-applier.ts           # применение ViewPatch[] к дереву
│   ├── effect-handler.ts          # проигрывание эффектов
│   ├── dispatch.ts                # единая точка вызова POST /view
│   ├── conflict-handler.ts        # обработка 409 (stale revision / session not found)
│   ├── session-cleanup.ts         # CLOSE на unmount + sendBeacon в beforeunload
│   └── component-registry.ts      # Record<NodeType, FC>
├── ui/
│   ├── node-renderer.tsx
│   ├── sdui-screen.tsx
│   ├── nodes/
│   │   ├── shell/                 # APP_SHELL, TOP_BAR, SIDEBAR, WORKSPACE
│   │   ├── layout/                # PAGE, VSTACK, HSTACK, GRID, GROUP, TABS, TAB, TOOLBAR, SEPARATOR, SPACER
│   │   ├── display/               # LABEL, TEXT, BADGE, ICON
│   │   ├── fields/                # TEXT_FIELD, TEXT_AREA, NUMBER_FIELD, DATE_FIELD, DATETIME_FIELD, CHECKBOX_FIELD, ENUM_FIELD, REFERENCE_FIELD
│   │   ├── composite/             # TABLE, TABLE_COLUMN, OBJECT_FIELD
│   │   └── action/                # BUTTON, MENU_ITEM, LINK
│   └── unknown-node.tsx
├── types/
│   ├── view.ts                    # ViewRequest/Response/Node/Patch/Effect/Action
│   └── node-types.ts              # NodeType, PatchOp, EffectType, ActionType
└── index.ts
```

### 10.2. TreeStore — теперь хранит и сессию

```ts
interface TreeStore {
  root:          ViewNode | null
  layoutCode:    string | null
  formSessionId: string | null
  revision:      number | null
  setRoot:       (n: ViewNode) => void
  setSession:    (id: string, rev: number) => void
  bumpRevision:  (rev: number) => void
  applyPatches:  (p: ViewPatch[]) => void
  reset:         () => void
}

export const useTreeStore = create<TreeStore>(/* ... */)
```

`formSessionId` и `revision` живут здесь, а не в локальном стейте `SduiScreen`-а. Это даёт легко прокидывать их в любой компонент (например, для модалок).

### 10.3. SduiScreen

```tsx
export const SduiScreen: FC = () => {
  const location = useLocation()
  const tree     = useTreeStore(s => s.root)
  const reset    = useTreeStore(s => s.reset)
  const dispatch = useSduiDispatch()

  useEffect(() => {
    // OPEN при монтировании и смене route
    void dispatch({ type: 'OPEN' })

    // cleanup: CLOSE при размонтировании / смене route
    return () => {
      void dispatch({ type: 'CLOSE' })  // best-effort fire-and-forget
      reset()
    }
  }, [location.pathname])

  // beforeunload: попытаться послать CLOSE через sendBeacon
  useEffect(() => {
    const handler = () => {
      const sid = useTreeStore.getState().formSessionId
      if (sid) navigator.sendBeacon(`/api/view/${sid}`, '')  // DELETE через sendBeacon
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!tree) return <Skeleton />
  return <NodeRenderer node={tree} />
}
```

### 10.4. NodeRenderer

```tsx
export const NodeRenderer: FC<{ node: ViewNode }> = ({ node }) => {
  const Component = useComponentRegistry()[node.type] ?? UnknownNode
  return <Component node={node} />
}
```

### 10.5. ViewStateStore — кэш значений

```ts
interface ViewStateStore {
  state: Record<string, unknown>
  get(binding: string): unknown
  set(binding: string, value: unknown): void
  merge(patch: Record<string, unknown>): void
  replaceAll(s: Record<string, unknown>): void
  getAll(): Record<string, unknown>
}

export const useViewStateStore = create<ViewStateStore>((set, get) => ({
  state: {},
  get: b => get().state[b],
  set: (b, v) => set(s => ({ state: { ...s.state, [b]: v } })),
  merge: p => set(s => ({ state: { ...s.state, ...p } })),
  replaceAll: s => set({ state: s }),
  getAll: () => get().state,
}))

export const useViewState = (binding: string | undefined) =>
  useViewStateStore(s => binding ? s.state[binding] : undefined)
```

### 10.6. Dispatch — единая точка

```ts
export const useSduiDispatch = () => {
  const tree     = useTreeStore.getState
  const setRoot  = useTreeStore(s => s.setRoot)
  const setSess  = useTreeStore(s => s.setSession)
  const bumpRev  = useTreeStore(s => s.bumpRevision)
  const apply    = useTreeStore(s => s.applyPatches)
  const replace  = useViewStateStore(s => s.replaceAll)
  const merge    = useViewStateStore(s => s.merge)
  const effects  = useEffectHandler()
  const conflict = useConflictHandler()
  const location = useLocation()

  return async (action: ViewAction) => {
    const { formSessionId, revision } = tree()

    try {
      const res = await viewTransport.post({
        formSessionId: action.type === 'OPEN' ? null : formSessionId,
        revision:      action.type === 'OPEN' ? null : revision,
        layoutCode:    action.type === 'OPEN' ? deriveLayoutCode(location) : null,
        route:         location.pathname,
        action,
        state:         action.type === 'OPEN' ? deriveInitialState() : undefined,
      })

      if (action.type === 'OPEN') {
        setSess(res.formSessionId, res.revision)
        setRoot(res.tree!)
        replace(res.state ?? {})
      } else if (action.type === 'CLOSE') {
        // ничего — TreeStore.reset() сделает SduiScreen
      } else {
        bumpRev(res.revision)
        apply(res.patches ?? [])
        applyValuePatchesToCache(res.patches ?? [])
        merge(res.statePatch ?? {})
        effects.playAll(res.effects ?? [])
      }
    } catch (e) {
      if (isConflict(e)) {
        conflict.handle(e, action)
      } else {
        toast.error(extractMessage(e))
      }
    }
  }
}
```

### 10.7. ConflictHandler — обработка 409

```ts
export const useConflictHandler = () => {
  const setSess = useTreeStore(s => s.setSession)
  const replace = useViewStateStore(s => s.replaceAll)
  const dispatch = useSduiDispatch()

  return {
    handle(err: ConflictError, originalAction: ViewAction) {
      if (err.code === 'STALE_REVISION') {
        // Сервер прислал snapshot — рекосмиливаемся без переоткрытия
        toast.info('Синхронизирую...')
        setSess(err.formSessionId, err.currentRevision)
        replace(err.snapshot.state)
        // НЕ повторяем originalAction — пользователь увидит обновлённую форму и решит сам
      } else if (err.code === 'SESSION_NOT_FOUND') {
        toast.warning('Сессия истекла, переоткрываю...')
        void dispatch({ type: 'OPEN' })
      }
    }
  }
}
```

### 10.8. ViewTransport

```ts
import { http } from '@/shared/api'

export const viewTransport = {
  post: (req: ViewRequest) => http.post<ViewResponse>('/api/view', req).then(r => r.data),
  closeBeacon: (sessionId: string) =>
    navigator.sendBeacon(`/api/view/${sessionId}`, ''),
}
```

### 10.9. Catch-all маршрут

```tsx
<Routes>
  <Route path="/legacy/*" element={<LegacyRoutes/>} />
  <Route path="*" element={<SduiScreen/>} />
</Routes>
```

### 10.10. Unknown node — graceful degradation

```tsx
export const UnknownNode: FC<NodeProps> = ({ node }) => (
  <div style={{ padding: 8, border: '1px dashed #f0a000', background: '#fff8e1' }}>
    <Typography variant="caption">
      Тип «{node.type}» не поддерживается этой версией клиента (id: {node.id}).
    </Typography>
  </div>
)
```

---

## 11. Полный пример: ЗаявкаНаРегистрациюГПСделки

Документ уже засеян в БД бэка. Пройдём шаг за шагом, как фронт работает с ним в stateful-модели.

### 11.1. Открытие документа

Пользователь перешёл на `/documents/ZayavkaNaRegistratsiyuGPSdelki/1`. `SduiScreen` шлёт:

```jsonc
{
  "layoutCode": null,
  "route":      "/documents/ZayavkaNaRegistratsiyuGPSdelki/1",
  "action":     { "type": "OPEN" },
  "state":      {}
}
```

Бэк создаёт form-session, грузит документ, собирает дерево. Ответ:

```jsonc
{
  "formSessionId": "f3c1a0e2-9b7d-4a11-8e2f-001",
  "revision":      0,
  "tree": {
    "id": "page", "type": "PAGE",
    "props": {
      "title": "Заявка на регистрацию ГП-сделки ААС00-00001 от 30.04.2026",
      "kind":  "OBJECT_FORM"
    },
    "children": [
      {
        "id": "commandBar", "type": "TOOLBAR",
        "children": [
          { "id": "btn.postClose", "type": "BUTTON",
            "props": { "label": "Провести и закрыть", "variant": "primary", "command": "postAndClose", "enabled": true },
            "actions": [{ "trigger": "click", "actionId": "command" }] },
          { "id": "btn.save", "type": "BUTTON",
            "props": { "label": "Записать", "command": "save", "enabled": true },
            "actions": [{ "trigger": "click", "actionId": "command" }] }
          /* ... остальные кнопки */
        ]
      },
      {
        "id": "body", "type": "VSTACK", "props": { "gap": 8 },
        "children": [
          { "id": "row.header", "type": "HSTACK", "props": { "gap": 3 },
            "children": [
              { "id": "field.nomer", "type": "TEXT_FIELD",
                "props": { "label": "Номер", "readonly": true, "flex": 1 },
                "binding": "nomer", "value": "ААС00-00001",
                "actions": [] },
              { "id": "field.data", "type": "DATETIME_FIELD",
                "props": { "label": "Дата", "required": true, "flex": 1 },
                "binding": "data", "value": "2026-04-30T07:22:00",
                "actions": [{ "trigger": "change", "actionId": "fieldEvent" }] }
            ]
          }
          /* ... остальное дерево, см. seed-layout */
        ]
      }
    ]
  },
  "state": {
    "nomer": "ААС00-00001",
    "data": "2026-04-30T07:22:00",
    "ispolzovatGrafikPlatezhey": false,
    "zayavkaUtverzhdena": false,
    "organizatsiya": { "id": 4021, "presentation": "КГУ \"Кабинет ...\"" }
    /* ... 16 остальных полей */
  }
}
```

Фронт:

1. Сохраняет `formSessionId = "f3c1a0e2-..."`, `revision = 0`.
2. `treeStore.setRoot(tree)`.
3. `viewStateStore.replaceAll(state)`.
4. Рендерит.

### 11.2. Пользователь поставил «Использовать график платежей»

`CHECKBOX_FIELD field.ispolzovatGrafik` имеет `actions: [{trigger:"change", actionId:"fieldEvent"}]`. На клик компонент:

```ts
const handleChange = (checked: boolean) => {
  setValue(node.binding, checked)                       // локальный кэш
  if (hasServerEvent(node, 'change')) {
    dispatch({
      type: 'EVENT',
      sourceNodeId: node.id,
      trigger: 'change',
      value: checked,
    })
  }
}
```

Запрос:

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      0,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.ispolzovatGrafik",
    "trigger":      "change",
    "value":        true
  }
}
```

Сервер применяет, прогоняет handler, отвечает:

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      1,
  "patches": [
    { "op": "setProp", "nodeId": "field.dataZakaza", "key": "required", "value": true }
  ],
  "statePatch": {},
  "effects": []
}
```

Фронт: revision → 1; у `dataZakaza` теперь `required:true`.

### 11.3. Смена «Контрагент»

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      1,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.kontragent",
    "trigger":      "change",
    "value":        { "id": 5012, "presentation": "ТОО Альфа" }
  }
}
```

Ответ:

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      2,
  "patches": [
    { "op": "setProp",  "nodeId": "field.dogovorKontragenta", "key": "enabled", "value": true },
    { "op": "setOptions", "nodeId": "field.dogovorKontragenta",
      "options": { "filter": { "Vladelets": 5012, "Organizatsiya": 1001 } } },
    { "op": "setOptions", "nodeId": "field.schetKontragenta",
      "options": { "filter": { "Vladelets": 5012 } } },
    { "op": "setValue", "binding": "dogovorKontragenta", "value": null },
    { "op": "setValue", "binding": "schetKontragenta",   "value": null }
  ],
  "statePatch": {
    "dogovorKontragenta": null,
    "schetKontragenta":   null
  }
}
```

Фронт: revision → 2; обновил props и обнулил два связанных значения в кэше.

### 11.4. Сохранение и проведение

Клик «Провести и закрыть» (`btn.postClose`):

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      2,
  "action":        { "type": "COMMAND", "command": "postAndClose" }
}
```

Ответ (успех):

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      3,
  "patches": [
    { "op": "setProp", "nodeId": "page", "key": "title",
      "value": "Заявка на регистрацию ГП-сделки ААС00-00001 (проведён)" }
  ],
  "effects": [
    { "type": "notify",   "level": "success", "message": "Документ проведён" },
    { "type": "navigate", "route": "/documents/ZayavkaNaRegistratsiyuGPSdelki" }
  ]
}
```

Фронт: тост, перед `navigate` — отправляет `CLOSE` для сессии `f3c1a0e2-...`, потом меняет route. На списке — новый `SduiScreen`, новая сессия, всё с начала.

Ответ (ошибка валидации):

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      3,
  "patches": [
    { "op": "setProp", "nodeId": "field.organizatsiya", "key": "error",
      "value": "Поле обязательно для заполнения" }
  ],
  "effects": [
    { "type": "notify", "level": "error", "message": "Заполните обязательные поля" }
  ]
}
```

Сессия жива, пользователь правит, шлёт `save` ещё раз.

### 11.5. Конфликт сессии

В какой-то момент сервер рестартанул. Пользователь меняет поле:

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      3,
  "action": { "type": "EVENT", "sourceNodeId": "field.data", "trigger": "change", "value": "2026-05-01T10:00:00" }
}
```

Ответ:

```jsonc
HTTP 409
{ "error": "SESSION_NOT_FOUND", "reason": "SERVER_RESTART" }
```

`ConflictHandler`: тост «Сессия истекла, переоткрываю» → `dispatch({type:'OPEN'})`. Получаем новую сессию, перерисовываем форму. Локальный dirty-кэш можно постараться применить (best-effort, на MVP — игнорируем).

### 11.6. Печать

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      4,
  "action":        { "type": "COMMAND", "command": "print:ZayavkaForm" }
}
```

Ответ:

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "revision":      5,
  "effects": [
    { "type": "download", "url": "https://api.example/files/tmp/zayavka-1.pdf" }
  ]
}
```

Фронт: `window.open(url, '_blank')`. PDF откроется в новой вкладке. Сессия жива.

### 11.7. Закрытие формы

Пользователь перешёл на другой документ или закрыл вкладку:

```jsonc
{
  "formSessionId": "f3c1a0e2-...",
  "action":        { "type": "CLOSE" }
}
```

Сервер удаляет сессию. Ответ может быть пустым.

---

## 12. Что переиспользуется из текущего fin-web

### 12.1. `src/features/form-renderer/`

Уже близкая модель. Текущий `NodeRenderer` со switch'ем по типу, компоненты `VStack/HStack/Field/Separator/Label/Tabs` (6 типов). Что надо:

- Расширить алфавит до полного `NodeType` (31 тип). Основной объём работы.
- Сменить источник дерева — теперь не `form-config` из `form-configs-server`, а `tree` из `POST /view`.
- Удалить логику резолва виджета по типу данных в `field-node.tsx` — теперь конкретный `type` приходит от сервера.
- Удалить `useFieldOptions`, `useFormEvents`, `useTableColumns`, `useTypeDependencies`, `useFormRendererContext` — это всё кочует на сервер.

Существующие `VStackNode/HStackNode/...` — стартовые скелеты для `VSTACK/HSTACK/...`.

### 12.2. `src/shared/ui/inputs/`

Отвязать от `react-hook-form` и от самостоятельных fetch'ей за справочниками. Каждый input — controlled (`value`/`onChange` сверху).

### 12.3. `src/shared/api/`

Оставить как есть — базовый axios. `viewTransport.post('/api/view', ...)` использует существующий `http`.

### 12.4. `src/widgets/sidebar`, `widgets/top-bar`, `widgets/workspace-tab-bar`

На этапе 1 — без изменений. Оболочка мигрирует на SDUI позже.

---

## 13. Что удаляется

После того как первый документ (ЗаявкаНаРегистрациюГПСделки) проедет полностью server-driven на отдельном маршруте, **постепенно** выводится из эксплуатации:

```
src/pages/documents/                   ← per-page страницы документов
src/pages/dictionaries/
src/pages/accumulation-register/
src/pages/information-register/
src/pages/module/

src/widgets/document-form-toolbar/     ← заменяется TOOLBAR-узлом + CommandComposer
src/widgets/document-list-toolbar/
src/widgets/module-toolbar/
src/widgets/dictionary-list-toolbar/
src/widgets/eav-entity-table/          ← заменяется TABLE-узлом

src/features/dict-sidebar/             ← перейдёт в SIDEBAR-узел
src/features/table-filter/             ← либо в TABLE props, либо отдельный TOOLBAR
src/features/generate-form-config/     ← form-configs-server выводится
src/features/form-renderer/            ← переезжает в features/sdui/

src/entities/form-config/              ← устаревшая модель FormConfig

form-configs-server/                   ← весь сервис целиком

src/app/navigation-items.ts            ← статичный сайдбар
```

zustand-сторы под удаление: `useFormCacheStore`, `useTableFilterStore`, `useDictSidebarStore`, `useWorkspaceTabsStore` (частично — что-то перейдёт в `WORKSPACE`-узел).

zod-схемы валидации форм — все на удаление.

---

## 14. План работ для фронта

> **Статус бэка:** Phase 1 готова — `POST /api/view` принимает OPEN/EVENT/COMMAND/CLOSE, пилотный документ ЗаявкаГПСделки прогоняется end-to-end. Можно работать **сразу против реального бэка**; моки (§15) — опциональный приём для скорости итерации UI-компонентов, не обязательное звено.

Подход: движок сначала, отдельные документы потом. Достаточно поднять `SduiScreen` + минимальный реестр компонентов — и пилот «загорается» в браузере. Моки нужны только если хочется писать тесты движка без бэка либо ускорить разработку компонентов на этапе, когда бэк ещё не доступен в локальном дев-окружении.

### Шаг 0. Типы

- Сгенерировать TS-типы из OpenAPI спека бэка (Swagger UI у бэка на `/swagger-ui.html`), либо описать руками по §4–§8 этого документа.
- Положить в `src/features/sdui/types/`.

### Шаг 1. Реестр и NodeRenderer на моках

- Создать `src/features/sdui/`.
- Реализовать `NodeRenderer` (§10.4).
- Реализовать компоненты для §6.2 (компоновка) и §6.4 (базовые поля) + `BUTTON` — достаточно для первого документа.
- Вход — мок `ViewTree` из §11.1.

Критерий: форма ЗаявкаГПСделки рисуется на моке.

### Шаг 2. Кэш и PatchApplier

- `ViewStateStore` (§10.5).
- `PatchApplier` (§7.8) + применение `setValue` к кэшу.
- Подключение к полям.

Критерий: мок-патч `{op:"setProp", nodeId:"field.dataZakaza", key:"required", value:true}` применяется, поле становится required. `{op:"setValue", binding:"summaDokumenta", value:1850000}` — обновляет значение в кэше и в DOM.

### Шаг 3. TreeStore + сессия + revision

- `TreeStore` с `formSessionId`/`revision` (§10.2).
- Логика `dispatch` (§10.6) — собирать `formSessionId+revision` в запросе.
- `ConflictHandler` (§10.7) для 409 STALE_REVISION / SESSION_NOT_FOUND.

Критерий: при мок-ответе с новым `revision` фронт хранит его и шлёт обратно в следующем запросе.

### Шаг 4. EffectHandler

- Все пять эффектов (§8.6).
- Особо: `navigate` отправляет `CLOSE` перед сменой роута.

Критерий: мок `{type:"notify"}` показывает тост; `{type:"navigate"}` сначала шлёт `CLOSE`, потом переходит.

### Шаг 5. Транспорт + SduiScreen + session cleanup

- `viewTransport` (§10.8) + `closeBeacon`.
- `SduiScreen` (§10.3) — `OPEN` на mount, `CLOSE` на unmount, `sendBeacon` в `beforeunload`.

Критерий: при `npm run dev` с мок-бэком форма открывается, изменения шлют `EVENT`, при уходе со страницы летит `CLOSE`.

### Шаг 6. Подключение к реальному бэку

Бэк готов с самого начала разработки — этот шаг можно делать одновременно с предыдущими (или сразу после Шага 5). Что проверить:

- `POST /api/view` отвечает 200 на OPEN с реальным document id из БД (например, `/documents/ZayavkaNaRegistratsiyuGPSdelki/1`).
- EVENT/COMMAND работают, возвращают `revision++` и патчи.
- В dev-профиле бэка доступен `GET /api/view/debug/sessions` (список активных) и `GET /api/view/debug/sessions/{id}` (детали + scratch) — удобно отлаживать, если что-то «не сходится».
- Команды: `save`/`saveAndClose` (сохранение через продакшен-путь), `post`/`postAndClose` (с проводкой), `unpost`, `print:<formCode>` (отдаёт `effect.download` на существующий PDF-эндпоинт).
- 409 STALE_REVISION / SESSION_NOT_FOUND — действительно прилетают, `ConflictHandler` (§10.7) их перехватывает.

Критерий: ЗаявкаГПСделки полностью server-driven на маршруте `/sdui/documents/ZayavkaNaRegistratsiyuGPSdelki/1`.

### Шаг 7. Остальные `NodeType` и составные

- NUMBER_FIELD, DATE_FIELD, ENUM_FIELD, TABLE/TABLE_COLUMN, BUTTON/MENU_ITEM/LINK, BADGE, ICON, GRID, SPACER.
- APP_SHELL/TOP_BAR/SIDEBAR/WORKSPACE — на этапе миграции оболочки.

### Шаг 8. Миграция остальных доменов

По одному типу документа, пока бэк публикует layout в БД. Параллельно — справочники, регистры. План «вертикальный срез» из ADR.

### Шаг 9. Удаление легаси

После того как все домены работают через `/view`.

---

## 15. Моки для разработки (опционально)

> **Бэк уже работает** — этот раздел нужен только если хочется иметь in-process реализацию `viewTransport` для unit-тестов компонентов и быстрого офлайн-разработческого цикла. Для прогона пилота моки не обязательны — `viewTransport.post('/api/view', ...)` сразу даст рабочий round-trip.

В `src/features/sdui/__mocks__/`:

```ts
let mockSessionCounter = 0
const sessions = new Map<string, { revision: number; state: Record<string, unknown> }>()

export const mockView = (req: ViewRequest): ViewResponse => {
  if (req.action.type === 'OPEN') {
    const id = `mock-session-${++mockSessionCounter}`
    sessions.set(id, { revision: 0, state: mockZayavkaState })
    return {
      formSessionId: id,
      revision: 0,
      tree: mockZayavkaTree,
      state: mockZayavkaState,
    }
  }

  if (req.action.type === 'CLOSE') {
    sessions.delete(req.formSessionId!)
    return { formSessionId: req.formSessionId!, revision: -1 }
  }

  // EVENT / COMMAND
  const session = sessions.get(req.formSessionId!)
  if (!session) {
    throw { status: 409, code: 'SESSION_NOT_FOUND' }
  }
  if (session.revision !== req.revision) {
    throw { status: 409, code: 'STALE_REVISION',
            currentRevision: session.revision, snapshot: { state: session.state } }
  }
  session.revision++

  if (req.action.type === 'EVENT' && req.action.sourceNodeId === 'field.ispolzovatGrafik') {
    const value = req.action.value as boolean
    session.state.ispolzovatGrafikPlatezhey = value
    return {
      formSessionId: req.formSessionId!,
      revision: session.revision,
      patches: [
        { op: 'setProp', nodeId: 'field.dataZakaza', key: 'required', value: value === true }
      ],
    }
  }

  return { formSessionId: req.formSessionId!, revision: session.revision }
}
```

Включается env-флагом `VITE_SDUI_MOCK=true`.

---

## 16. FAQ и кромки

**В: Что если бэк прислал `NodeType`, которого нет в реестре?**
О: Рендерь `UnknownNode` (§10.10). Не падай.

**В: Что с локальной отзывчивостью при медленной сети?**
О: Локальный кэш мутируется мгновенно, в сеть идёт только в точках синхронизации. Между нажатием и приходом `setValue` пользователь видит то, что ввёл (оптимистично). Когда сервер ответит — кэш перетрётся серверным значением (обычно тем же, но если бэк подкорректировал — победит сервер).

**В: Можно ли держать на клиенте состояния, которые не уходят на сервер?**
О: Да — **презентационные**: открыт ли сайдбар, активная вкладка `TABS` (если у TAB нет server-events), позиция скролла. Эти состояния — локальные React-стейты компонентов.

**В: Производительность серверной памяти при многих открытых формах?**
О: Каждая сессия = одна копия `DocumentEntry` в `FormSessionStore`. Размер одной сессии ≈ размер документа (KB-десятки KB). В **Phase 1** хранилище — in-memory `ConcurrentHashMap` за интерфейсом `FormSessionStore` (см. §17.1). Очистка — обязательный `@Scheduled` тик каждые ~5 минут, выкидывающий idle > 30 мин, плюс жёсткий cap 4 ч. С первого дня — метрики «active sessions count» и «evictions/min» в Prometheus, они же служат ранним сигналом, что in-memory начинает хрустеть. В **Phase 2** — Redis (или другое distributed-хранилище) при срабатывании триггеров перехода, см. §17.1.

**В: Можно ли запускать бэкенд с `replicas > 1`?**
О: В **Phase 1 (in-memory FormSessionStore)** — нет. Если поставить `replicas: 2+` без sticky sessions, LB случайно гоняет запросы между подами: у одного в памяти сессия есть, у другого — `SESSION_NOT_FOUND`. Поведение становится не воспроизводимым. До перехода в Phase 2 — либо явный `replicas: 1` с комментарием в k8s-манифесте «in-memory FormSessionStore — горизонтально не масштабируется», либо включённый session affinity в Ingress. В **Phase 2 (Redis-backed)** масштабирование становится прозрачным — любой под может ответить на любой запрос.

**В: Параллельное редактирование двух вкладок?**
О: Каждая вкладка — своя form-session. Сохранения на DB-уровне разруливаются оптимистической блокировкой (`updatedAt`/`version`). Конфликт сохранения → `notify(error)`, пользователь переоткрывает форму.

**В: Версионирование контракта?**
О: Контракт зафиксирован. При несовместимых изменениях — добавляем поле `protocolVersion` в `ViewRequest`/`ViewResponse`. Пока — не нужно.

**В: Локализация?**
О: Тексты в `props.label`/`props.title`/`props.text` приходят локализованные с бэка. Фронт ничего не переводит. Свои тексты — через `react-i18next`.

**В: Тестирование?**
О: Юнит-тесты `PatchApplier` (чисто функциональный, легко тестировать). Компоненты узлов — на storybook + jest с разными `node` props. Интеграция — с мок-`viewTransport` (§15) с поддержкой sessions/revision.

**В: Типизация `props`?**
О: На уровне TS `props` = `Record<string, unknown>`. Внутри каждого компонента — приведение к ожидаемому типу с дефолтами.

**В: Heartbeat для длинной формы?**
О: На MVP — нет, пользователь увидит «сессия истекла» и переоткроет. На этапе 2 — таймер на 5 мин, фоновый `EVENT` без `sourceNodeId` (или специальный `HEARTBEAT`).

**В: Что с offline-режимом?**
О: Не поддерживается. Все сетевые операции через бэк; локальный кэш существует только для рендера между точками синхронизации.

---

## 17. Что готово на бэке, что в очереди

> **Статус пилота (актуальный): вертикальный срез на `ZayavkaNaRegistratsiyuGPSdelki` работает end-to-end через `POST /api/view`.** OPEN/EVENT/COMMAND/CLOSE, save/saveAndClose/post/postAndClose, unpost, print:* — всё прогоняется через Postman и сохраняется в БД через продакшен-путь `DocumentService.saveEntry`. Архитектура подтверждена.

| | Состояние |
|---|---|
| ADR-0005 (stateless) / ADR-0006 (stateful) | ✅ оформлены, ADR-0005 Superseded by ADR-0006 |
| `sdui-architecture.md` | ✅ переписан под stateful (v2) |
| Контракт DTO: `ViewRequest`/`Response`/`Action` с `formSessionId`/`revision`/`value`/`CLOSE` | ✅ |
| DTO `layout/`, enum'ы `NodeType`/`LayoutNodeType`/`PatchOp`/`EffectType`/`LayoutKind`/`ActionType` | ✅ |
| Миграция БД трёх таблиц layout | ✅ |
| Seed `ZayavkaNaRegistratsiyuGPSdelki` (34 узла) | ✅ |
| Домен `layout/` на бэке (entities, repos, mapper, service, controller) | ✅ |
| `FormSessionStore` + `InMemoryFormSessionStore` (Phase 1) + GC + Prometheus метрики | ✅ — см. §17.1 |
| `ViewController` + `POST /api/view` + `DELETE /api/view/{id}` + 409-эдвайс | ✅ — `@Transactional(readOnly=true)` под scratch-модель |
| `ViewComposer` + `NodeBuilder` + `WidgetResolver` | ✅ |
| `PatchBuilder` + `EffectBuilder` | ✅ |
| `ViewFormHandler` interface + `BaseViewFormHandler` + `ViewFormHandlerRegistry` | ✅ + методы `resolveAttributeCode` / `coerceValueForAttribute` / `resolveNodeIdByAttribute` |
| `ZayavkaNaRegistratsiyuGpSdelkiViewFormHandler` (пилотный) — параллельно старому | ✅ |
| Команда `save` / `saveAndClose` — через `SduiSaveService` → `DocumentService.saveEntry` | ✅ |
| Команда `post` / `postAndClose` — через тот же путь + handler.onPost | ✅ (валидация `onCheckFilling`-ошибок переводится в `setProp(error)` + `notify(error)`) |
| Команда `unpost` — через `DocumentService.unpostEntry` | ✅ |
| Команда `print:<formCode>` — `effect.download` на существующий PDF-эндпоинт `/api/document-entries/{typeCode}/{id}/print?form=…` | ✅ |
| EVENT для новых документов (`OPEN /new` без первого save) | ✅ — controller создаёт transient entity, scratch копится, на первом `save` запись материализуется |
| Dev-debug: `application-dev.yaml` (TTL 24h), `GET /api/view/debug/sessions/{id}` со scratch | ✅ |
| `CommandRegistry` / `CommandComposer` (автогенерация TOOLBAR-кнопок) | ⏸ не сделано на пилоте — кнопки в TOOLBAR сейчас приходят пустыми; clients hardcode'ят набор. Следующая итерация. |
| `FormConfigToPatchAdapter` (мост старых ~84 handler'ов) | ⏸ не вводился — пилот пошёл «новый рядом со старым», адаптер потребуется при массовой миграции |
| OPEN-патчи от `handler.handleOpen` применяются к итоговому tree | ⏸ TODO в `ViewController` (сейчас возвращаются в `response.patches` отдельно — для текущего pilot handler этого достаточно) |
| Heartbeat для длинных сессий | ⏸ не реализован, можно жить без него до 30m idle (24h в dev) |
| Phase 2 — Redis-backed `FormSessionStore` | ⏸ ждёт срабатывания триггеров §17.1 (replicas>1, регулярные жалобы и т.п.) |
| Frontend-движок (`fin-web/features/sdui/`) | ❌ не построен — главный недостающий слой |

**Что фронт может делать прямо сейчас (и должен):** реализовывать движок (§10) и реестр компонентов (§6) — теперь уже не на моках, а против **работающего** `POST /api/view`. Backend готов; первый документ полностью server-driven. После того как фронт нарисует ЗаявкаГПСделки на маршруте `/sdui/documents/ZayavkaNaRegistratsiyuGPSdelki/1` через `SduiScreen`, пилот закроется визуально.

### 17.1. FormSessionStore: фазовый план

Хранилище сессий вводится **двухфазно**, чтобы не тащить распределённую инфраструктуру до того, как она реально понадобится. Контракт DTO (`formSessionId`/`revision`) для обеих фаз идентичен — фронт не знает, какое хранилище под капотом.

**Phase 1 — In-memory single-pod.** Простая реализация: `ConcurrentHashMap<String, FormSession>` за интерфейсом.

```java
public interface FormSessionStore {
    FormSession create(String userId, String layoutCode, DocumentEntry entry);
    Optional<FormSession> find(String sessionId);
    void update(FormSession session);     // мутирует state, увеличивает revision
    void delete(String sessionId);
    void evictExpired();                  // вызывается @Scheduled-тиком
}

@Component
@ConditionalOnProperty(
    prefix = "sdui.session", name = "store",
    havingValue = "in-memory", matchIfMissing = true)
public class InMemoryFormSessionStore implements FormSessionStore { ... }
```

Жёсткие требования Phase 1:

- `@Scheduled` GC каждые ~5 минут — выкидывает idle > 30 мин; hard cap 4 часа даже при активности.
- Метрики «active sessions count» и «evictions/min» в Prometheus **с первого дня** — ранний сигнал, что in-memory начинает хрустеть.
- **k8s `replicas: 1`** с явным комментарием в манифесте (либо session affinity в Ingress).
- Документировано в release notes: рестарт пода = потеря всех активных сессий, клиент видит `SESSION_NOT_FOUND` и переоткрывает форму.

**Phase 2 — Redis-backed** (или другое distributed-хранилище). Тот же интерфейс, новая реализация `RedisFormSessionStore`, переключение через property `sdui.session.store=redis`. Никакие потребители интерфейса (`ViewController`, `ViewComposer`, handler'ы) не меняются.

**Триггеры перехода в Phase 2** (любого из четырёх достаточно):

- Появилось желание держать `replicas >= 2` (горизонтальное масштабирование, blue-green деплой без даунтайма).
- Жалобы пользователей на потерянные формы при деплоях стали регулярными (еженедельно, не пара раз в месяц).
- Среднее время сессии превысило MTBF пода (формы заполняются по часу, поды живут 12 ч из-за autoscaling/rolling).
- Появилась бизнес-фича «продолжить редактирование с другой машины» или «передать форму коллеге».

Решение и его обоснование зафиксируем в ADR-0006 при оформлении.

---

## 18. Связанные документы

- `webbuh/docs/project/sdui/sdui-architecture.md` — целевой дизайн (требует правки §1 после разворота).
- `webbuh/docs/project/sdui/layout-zayavka-gp-sdelki.json` — layout документа в виде, эквивалентном строкам трёх таблиц.
- `webbuh/docs/project/adr/ADR-0005-sdui-architecture.md` — **superseded** (stateless).
- `webbuh/docs/project/adr/ADR-0006-sdui-stateful-form-session.md` — **актуальный** ADR (stateful, projected).
- `webbuh/webbuh-contract/src/main/java/kz/asiaservis/view/` — DTO контракта.
- `webbuh/webbuh-contract/src/main/java/kz/asiaservis/layout/` — DTO layout-домена.
- `webbuh/webbuh-contract/src/main/java/kz/asiaservis/enums/` — enum'ы (`NodeType`, `LayoutNodeType`, `PatchOp`, `EffectType`, `ActionType`, `LayoutKind`).
- `webbuh/webbuh-api/src/main/resources/db/migration_2026-05-25_sdui_layout_tables.sql` — DDL.
- `webbuh/webbuh-api/src/main/resources/db/migration_2026-05-25_sdui_layout_seed_zayavka_gp_sdelki.sql` — seed.
- Существующий layout (для сверки переноса): `form-configs-server/configs/documents/ZayavkaNaRegistratsiyuGPSdelki.json`.
