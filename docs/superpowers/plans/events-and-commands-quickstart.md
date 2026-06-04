# SDUI — Quickstart: ивенты и команды на `/api/view`

**Аудитория:** фронтенд-разработчик, реализующий движок SDUI в `fin-web`.
**Цель документа:** за 10 минут понять круговорот «открыть форму → реагировать на действия пользователя → сохранить» через `POST /api/view`, с конкретными примерами запросов и ответов.
**Полная теория:** см. [frontend-spec.md](frontend-spec.md). Тут — только практика.

---

## 1. О чём вообще речь

SDUI: бэк описывает форму целиком (структуру дерева + поведение), фронт — тонкий рендерер, который слушает действия пользователя и шлёт их обратно бэку. Один эндпоинт `POST /api/view` принимает четыре типа действия:

- `OPEN` — открыть форму документа.
- `EVENT` — пользователь изменил поле-триггер (`change`/`blur`).
- `COMMAND` — пользователь нажал кнопку.
- `CLOSE` — пользователь закрыл форму.

Сервер хранит «открытую форму» в form-session между запросами, идентифицируемую `formSessionId`. Счётчик `revision` защищает от рассинхрона.

База URL: `http://localhost:8080` локально или `http://92.38.49.213:31880` на стенде.

---

## 2. Главное правило: revision

После **каждого успешного** EVENT/COMMAND сервер инкрементирует `revision` и возвращает новый. Каждый следующий запрос **обязан** прислать последнее увиденное значение.

```
OPEN     → revision: 0
EVENT_1  → revision: 1   (клиент шлёт 0, получает 1)
EVENT_2  → revision: 2   (клиент шлёт 1, получает 2)
COMMAND  → revision: 3   (клиент шлёт 2, получает 3)
CLOSE    → revision: -1  (сессия удалена)
```

Прислал устаревший — `HTTP 409 STALE_REVISION` (см. §6). Прислал несуществующий `formSessionId` — `409 SESSION_NOT_FOUND`.

**OPEN-патчи не инкрементируют revision.** OPEN-ответ может содержать `patches` (дефолты от handler), но это не «мутация» — `revision` остаётся 0, и первый EVENT шлёт именно 0.

---

## 3. Анатомия запроса

```ts
interface ViewRequest {
  formSessionId?: string              // null на OPEN; обязателен на EVENT/COMMAND/CLOSE
  revision?:      number              // null на OPEN/CLOSE; обязателен на EVENT/COMMAND
  layoutCode?:    string              // обязателен на OPEN
  route?:         string              // на OPEN: путь — backend парсит ТОЛЬКО последний сегмент (id или "new")
  action: {
    type:          'OPEN' | 'EVENT' | 'COMMAND' | 'CLOSE'
    sourceNodeId?: string             // для EVENT — id узла-источника
    trigger?:      string             // для EVENT — "change" | "blur" | ...
    value?:        unknown            // для EVENT — новое значение поля
    command?:      string             // для COMMAND — id команды
  }
  state?: Record<string, unknown>     // ТОЛЬКО на OPEN нового документа (предустановки)
}
```

Главный URL: `POST http://localhost:8080/api/view`.
Альтернатива CLOSE: `DELETE http://localhost:8080/api/view/{formSessionId}` (для `beforeunload` + `navigator.sendBeacon`).

---

## 4. OPEN — открыть форму

### Запрос

```jsonc
POST /api/view
{
  "layoutCode": "ZayavkaNaRegistratsiyuGPSdelki.ФормаОбъекта",
  "route":      "/documents/ZayavkaNaRegistratsiyuGPSdelki/1",
  "action":     { "type": "OPEN" },
  "state":      {}
}
```

- `layoutCode` — обязательное. Берётся из конвенции `<TypeCode>.<FormName>`. Для других форм может быть `ФормаСписка`, `ФормаВыбора` и т.д. Это **opaque-ключ**, фронт его не парсит.
- `route` — нужен только последний сегмент: число (id существующего документа) либо что-то нечисловое (`new`, пустая строка) — это новый документ. Префикс `/documents/...` бэк игнорирует, но рекомендуем оставить для логов.
- `state` — оставь пустым `{}`. Для нового документа можно подать предустановки (например, `{"VidOperatsii": "OformlenieZayavki"}` для конкретного режима).

### Ответ

```jsonc
{
  "formSessionId": "207dc091-f589-468e-8dd3-c8182416485f",
  "revision":      0,
  "tree":          { /* полное дерево формы */ },
  "state":         { /* плоский snapshot значений: binding → value */ },
  "patches":       [ /* дополнительные патчи от handler.handleOpen */ ],
  "effects":       []
}
```

### Что фронт делает на OPEN

1. Сохраняет `formSessionId` и `revision` в `TreeStore`.
2. Запоминает `tree` (для рендера) и `state` (для кэша значений — `ViewStateStore`).
3. **Применяет начальные `patches`** к дереву и кэшу — это handler.handleOpen уже отдал дефолты (например, поле `field.dataZakaza` стало `required:true`, потому что `ZayavkaUtverzhdena=true` уже стояло). Без применения этих патчей форма стартует в «дефолтном» виде из метаданных и не соответствует реальному состоянию документа.
4. Воспроизводит `effects` (обычно пусто на OPEN).

Дальше — рендер по `tree`, и слушаем взаимодействия пользователя.

---

## 5. EVENT — поле-триггер изменилось

### Как понять, что поле триггерное

В дереве у `FIELD`-узла есть массив `actions`:

```jsonc
{
  "id": "field.zayavkaUtverzhdena",
  "type": "CHECKBOX_FIELD",
  "binding": "ZayavkaUtverzhdena",
  "actions": [{ "trigger": "change", "actionId": "fieldEvent" }],
  ...
}
```

Если `actions` есть и содержит триггер `"change"` (или `"blur"`) — на этом событии **обязательно слать EVENT**.

Если `actions` пуст или отсутствует — поле «локальное», просто пишем в кэш, в сеть не ходим до сохранения.

### Запрос

```jsonc
POST /api/view
{
  "formSessionId": "207dc091-f589-468e-8dd3-c8182416485f",
  "revision":      0,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.zayavkaUtverzhdena",
    "trigger":      "change",
    "value":        false
  }
}
```

### Формат `action.value` — критично для каждого типа поля

| Тип поля (`NodeType`) | Формат `value` | Пример |
|---|---|---|
| `TEXT_FIELD`, `TEXT_AREA` | string | `"мой текст"` |
| `NUMBER_FIELD` | number | `1200000` (без кавычек) |
| `CHECKBOX_FIELD` | boolean | `true` |
| `DATE_FIELD` | ISO date string | `"2026-05-26"` |
| `DATETIME_FIELD` | ISO datetime string | `"2026-05-26T12:22:45"` |
| `REFERENCE_FIELD` | объект `{id, presentation}` | `{"id": 29635, "presentation": "ТОО Альфа"}` |
| `ENUM_FIELD` | объект `{id, code, presentation}` или просто `{id}` | `{"id": 41, "code": "OformlenieZayavki"}` |

`presentation` бэк не использует — кладёт во избежание UI-ререндеров на стороне клиента. `id` — главное.

### Ответ

```jsonc
{
  "formSessionId": "207dc091-f589-468e-8dd3-c8182416485f",
  "revision":      1,
  "patches": [
    { "op": "setProp", "nodeId": "field.nomerZakaza", "key": "enabled",  "value": false },
    { "op": "setProp", "nodeId": "field.dataZakaza",  "key": "enabled",  "value": false },
    { "op": "setProp", "nodeId": "field.nomerZakaza", "key": "required", "value": false },
    { "op": "setProp", "nodeId": "field.dataZakaza",  "key": "required", "value": false }
  ],
  "statePatch": null,
  "effects":    []
}
```

Обработка на клиенте:

1. Обновить `revision` в `TreeStore` (теперь 1).
2. Применить `patches` к дереву (для каждого `setProp` — обновить `node.props[key]` иммутабельно; для `setValue` — обновить `cache[binding]`).
3. Мёрджить `statePatch` в кэш (если есть).
4. Воспроизвести `effects` (если есть).

### Конкретные кейсы пилота — ЗаявкаГПСделки

**Изменить «СуммаГод1» (number):**

```jsonc
{
  "formSessionId": "<sid>",
  "revision":      <r>,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.summaGod1",
    "trigger":      "change",
    "value":        500000
  }
}
```

→ В ответе придёт `setValue(SummaDokumenta, <новая сумма>)` — вычисленное сервером `SummaGod1+SummaGod2+SummaGod3`.

**Изменить «Контрагент» (reference):**

```jsonc
{
  "formSessionId": "<sid>",
  "revision":      <r>,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.kontragent",
    "trigger":      "change",
    "value":        { "id": 29635, "presentation": "Новый контрагент" }
  }
}
```

→ В ответе несколько патчей:
- `setOptions(field.schetKontragenta, {filter: {Vladelets: 29635}})` — обновить фильтр выбора банковского счёта;
- `setProp(field.dogovorKontragenta, "enabled", true)` если организация тоже выбрана;
- `setOptions(field.dogovorKontragenta, {filter: {Vladelets, Organizatsiya}})`;
- Возможно `setValue(BankovskiySchetKontragenta, null)` — обнуление старого счёта, если он не подходит новому контрагенту.

**Изменить «Организацию»:**

```jsonc
{
  "formSessionId": "<sid>",
  "revision":      <r>,
  "action": {
    "type":         "EVENT",
    "sourceNodeId": "field.organizatsiya",
    "trigger":      "change",
    "value":        { "id": 30268, "presentation": "Другая организация" }
  }
}
```

→ Сервер автоматически подставит её основной банковский счёт через `setValue(BankovskiySchetOrganizatsii, ...)` и обновит фильтр договора.

---

## 6. COMMAND — нажата кнопка

### Как понять, что это кнопка

В дереве у `BUTTON`-узла:

```jsonc
{
  "id": "btn.save",
  "type": "BUTTON",
  "props": { "label": "Записать", "command": "save" },
  "actions": [{ "trigger": "click", "actionId": "command" }]
}
```

На `click` нужно слать `COMMAND` с `command = node.props.command`.

Для `BUTTON` с `variant: "dropdown"` — клик не отправляется на сервер, открывается локальное меню; запрос шлётся при клике на `MENU_ITEM` (у того тоже `actions: [{click, command}]`).

### Запрос

```jsonc
POST /api/view
{
  "formSessionId": "207dc091-f589-468e-8dd3-c8182416485f",
  "revision":      1,
  "action": {
    "type":    "COMMAND",
    "command": "save"
  }
}
```

### Стандартные команды пилота

| Команда | Что делает | Что в ответе |
|---|---|---|
| `save` | Сохранить документ (без проведения) | `notify(success, "Документ записан")` |
| `saveAndClose` | Сохранить + закрыть форму | `notify(success)` + `navigate("/documents/<TypeCode>")` |
| `post` | Сохранить и провести (handler.onPost запустит проводки в регистрах) | `notify(success, "Документ проведён")` ИЛИ при ошибке валидации — `notify(error)` + `setProp(field.X, "error", "...")` на каждое проблемное поле |
| `postAndClose` | `post` + `navigate` | то же что `post`, плюс `navigate` |
| `unpost` | Отменить проведение | `notify(success, "Проведение отменено")` |
| `print:<formCode>` | Получить PDF печатной формы | `effect.download(url)` — клиент открывает URL отдельно (`window.open` или `fetch+blob`) |

Имена `formCode` для `print:*` приходят в `tree`-узлах `MENU_ITEM` под `btn.print` (`command: "print:ZayavkaGpSdelki"`, `print:Forma77` и т.д.). Не парси сам — бери из `node.props.command`.

### Ответ на успешный save

```jsonc
{
  "formSessionId": "207dc091-...",
  "revision":      2,
  "patches": [],
  "effects": [
    { "type": "notify", "level": "success", "message": "Документ записан" }
  ]
}
```

### Ответ на ошибку валидации при `post`

```jsonc
{
  "formSessionId": "207dc091-...",
  "revision":      2,
  "patches": [
    { "op": "setProp", "nodeId": "field.organizatsiya", "key": "error", "value": "Поле обязательно для заполнения" },
    { "op": "setProp", "nodeId": "field.kontragent",    "key": "error", "value": "Не выбран контрагент" }
  ],
  "effects": [
    { "type": "notify", "level": "error", "message": "Документ не сохранён: Ошибки заполнения документа" }
  ]
}
```

Клиент применяет `setProp(error)` патчи — это подсвечивает конкретные поля с ошибками. После исправления и повторного `post` — патчи приходят с `value: null`, чтобы убрать подсветку (TODO: пока сервер сам не очищает, фронт может очищать предыдущие ошибки локально перед применением новых).

### Ответ на `print:ZayavkaGpSdelki`

```jsonc
{
  "formSessionId": "207dc091-...",
  "revision":      3,
  "patches": [],
  "effects": [
    {
      "type": "download",
      "url":  "/api/document-entries/ZayavkaNaRegistratsiyuGPSdelki/1/print?form=ZayavkaGpSdelki"
    }
  ]
}
```

Клиент: `window.open(effect.url, '_blank')` или `fetch(effect.url) → blob → iframe`. PDF лежит по этому URL.

---

## 7. CLOSE — закрыть форму

### Через POST

```jsonc
POST /api/view
{
  "formSessionId": "207dc091-...",
  "action":        { "type": "CLOSE" }
}
```

### Через DELETE (для `beforeunload`)

```ts
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon(`/api/view/${formSessionId}`, '')
})
```

`sendBeacon` работает в moment закрытия вкладки, обычный POST не успеет.

### Ответ

```jsonc
{
  "formSessionId": "207dc091-...",
  "revision":      -1
}
```

После CLOSE `formSessionId` инвалиден — любой EVENT даст 409 SESSION_NOT_FOUND.

---

## 8. HTTP 409 — обработка конфликтов

Два случая ошибки 409:

### `STALE_REVISION`

Клиент прислал `revision`, который меньше текущего серверного.

```jsonc
HTTP 409
{
  "error":           "STALE_REVISION",
  "formSessionId":   "207dc091-...",
  "currentRevision": 13,
  "reason":          "clientRevision=10 < currentRevision=13"
}
```

**Что делать клиенту:** обновить локальный `revision` до `currentRevision`, тост «Синхронизирую...», возможно перезапросить полное состояние через новый `OPEN`. На MVP — просто новый `OPEN`.

### `SESSION_NOT_FOUND`

Сессии нет на сервере — либо истекла по TTL, либо рестартанул под (Phase 1 in-memory), либо клиент сослался на неверный `formSessionId`.

```jsonc
HTTP 409
{
  "error":         "SESSION_NOT_FOUND",
  "formSessionId": "no-such-session"
}
```

**Что делать клиенту:** тост «Сессия истекла, переоткрываю», новый `OPEN`. По возможности применить накопленный локальный dirty-state поверх — но это best-effort, не критично.

---

## 9. Структура ответа — что применять

Любой ответ на `EVENT`/`COMMAND`/`CLOSE` имеет одинаковый skeleton:

```jsonc
{
  "formSessionId": "string",
  "revision":      number,
  "patches":       [ /* ViewPatch[] — мутации дерева/значений */ ],
  "statePatch":    { /* binding → value, для кэша */ },
  "effects":       [ /* ViewEffect[] — императивные команды клиенту */ ]
}
```

### `patches[].op` — мутации (всё применяется иммутабельно)

| `op` | Назначение | Поля |
|---|---|---|
| `setProp` | Изменить `props[key]` узла | `nodeId`, `key`, `value` |
| `setValue` | Изменить значение поля в кэше | `binding`, `value` |
| `replaceNode` | Заменить узел целиком | `nodeId`, `node` |
| `insertNode` | Вставить узел в `children` родителя | `parentId`, `index`, `node` |
| `removeNode` | Удалить узел | `nodeId` |
| `moveNode` | Переместить | `nodeId`, `parentId`, `index` |
| `setOptions` | Обновить выпадашку/фильтр выбора | `nodeId`, `options` |

### `effects[].type` — императивные команды

| `type` | Поля | Что делать |
|---|---|---|
| `notify` | `level`, `message` | Показать тост (`info`/`success`/`warning`/`error`) |
| `navigate` | `route` | Закрыть текущую сессию (POST CLOSE), потом router.push(route) |
| `openDialog` | `node` | Открыть модальное окно с поддеревом |
| `closeDialog` | `id` | Закрыть модалку |
| `download` | `url` | `window.open(url, '_blank')` |

---

## 10. Справочник по ЗаявкаГПСделки (пилот)

### Триггерные поля (шлют EVENT)

| `sourceNodeId` | `binding` | Тип `value` |
|---|---|---|
| `field.zayavkaUtverzhdena` | `ZayavkaUtverzhdena` | boolean |
| `field.organizatsiya` | `Organizatsiya` | `{id, presentation}` (Organizatsii) |
| `field.kontragent` | `Kontragent` | `{id, presentation}` (Kontragenty) |
| `field.summaGod1` | `SummaGod1` | number |
| `field.summaGod2` | `SummaGod2` | number |
| `field.summaGod3` | `SummaGod3` | number |

Остальные ~14 полей формы — локальные, EVENT не шлют. Их значения накапливаются в клиентском кэше и попадают на сервер при следующем `COMMAND save`.

### Кнопки тулбара

| `nodeId` | `command` | UX |
|---|---|---|
| `btn.postClose` | `postAndClose` | Primary, save + проведение + navigate |
| `btn.save` | `save` | Просто сохранить |
| `btn.post` | `post` (при `isPosted=false`) ИЛИ `unpost` (после toggle) | Сохранить + провести / отменить проведение |
| `btn.print` | `dropdown`, не отправляется | Открыть локальное меню |
| `mi.print.zayavkaGp` | `print:ZayavkaGpSdelki` | PDF — Прил. 79 |
| `mi.print.zayavkaGpKaz` | `print:ZayavkaGpSdelkiKaz` | PDF — Прил. 79 (каз.) |
| `mi.print.forma77` | `print:Forma77` | PDF — Форма 77 |
| `mi.print.forma77Kaz` | `print:Forma77Kaz` | PDF — Форма 77 (каз.) |

Если документ уже проведён, `handler.handleOpen` пришлёт патчи в `OPEN`-ответе:
- `setProp(btn.post, "label", "Отменить проведение")`
- `setProp(btn.post, "command", "unpost")`
- `setProp(btn.postClose, "enabled", false)`

Применяй их к дереву на инициализации — кнопка автоматически переключится.

---

## 11. Ловушки

| Ошибка | Симптом | Что сделать |
|---|---|---|
| Не обновил `revision` после EVENT | 409 STALE_REVISION на следующем запросе | Брать `revision` из последнего ответа |
| Прислал `state` в EVENT/COMMAND | Игнорируется, но логически странно | Не присылай — только OPEN использует это поле |
| Отправил EVENT для поля без `actions` | 200 OK с пустыми patches/effects | Не отправляй, поле локальное; если думаешь что сервер должен реагировать — это баг бэка или нужен новый триггер |
| `action.value` неправильного типа | 200 OK, но `setValue`-патч не приходит | Сверь с таблицей в §5: number ≠ "1200000", boolean ≠ "true" |
| Reference как просто id (без объекта) | 200 OK, но handler не находит сущность | Заворачивай в `{id, presentation}` |
| `print:*` ожидаешь PDF в теле ответа | Получаешь `effect.download` | PDF на отдельном URL, открой его в новой вкладке |
| Не применил OPEN-патчи к tree | Форма открылась «как в seed», без динамики | Применяй и `tree`, и `patches`, и `state` из OPEN-ответа |
| Сессия истекла после долгого простоя | 409 SESSION_NOT_FOUND | Новый OPEN |
| Под рестартанул | 409 SESSION_NOT_FOUND у всех активных сессий | Новый OPEN (это известное поведение Phase 1, см. ADR-0006 §2.4) |

---

## 12. Минимальный цикл клиента — псевдокод

```ts
const { formSessionId, revision: r0, tree, state, patches: openPatches } = await viewTransport.post({
  layoutCode: 'ZayavkaNaRegistratsiyuGPSdelki.ФормаОбъекта',
  route:      location.pathname,
  action:     { type: 'OPEN' },
  state:      {},
})

let revision = r0
treeStore.setRoot(tree)
viewStateStore.replaceAll(state)
applyPatches(openPatches ?? [])      // ← важно: применить OPEN-патчи к tree+cache
// форма готова к взаимодействию

// Юзер изменил поле
async function onFieldChange(node: ViewNode, newValue: unknown) {
  viewStateStore.set(node.binding, newValue)             // локально, мгновенно
  const fieldEvent = node.actions?.find(a =>
    a.trigger === 'change' && a.actionId === 'fieldEvent'
  )
  if (!fieldEvent) return                                // локальное поле

  const res = await viewTransport.post({
    formSessionId,
    revision,
    action: { type: 'EVENT', sourceNodeId: node.id, trigger: 'change', value: newValue },
  })
  revision = res.revision
  applyPatches(res.patches ?? [])
  mergeStatePatch(res.statePatch)
  effectHandler.playAll(res.effects ?? [])
}

// Юзер нажал кнопку
async function onButtonClick(node: ViewNode) {
  const res = await viewTransport.post({
    formSessionId,
    revision,
    action: { type: 'COMMAND', command: node.props.command as string },
  })
  revision = res.revision
  applyPatches(res.patches ?? [])
  mergeStatePatch(res.statePatch)
  effectHandler.playAll(res.effects ?? [])
}

// Юзер уходит со страницы
async function onUnmount() {
  await viewTransport.post({ formSessionId, action: { type: 'CLOSE' } })
}
```

---

## 13. Что протестировать перед интеграцией

В Postman или curl, чтобы убедиться, что бэк отвечает как ожидается:

1. **OPEN** существующего документа → проверить `tree`, `state`, `actions` на полях/кнопках.
2. **EVENT** для `field.summaGod1` со значением `500000` → проверить, что приходит `setValue(SummaDokumenta, <сумма>)`.
3. **EVENT** для `field.zayavkaUtverzhdena` со значением `true` → 4 `setProp` на `nomerZakaza`/`dataZakaza`.
4. **EVENT** для `field.kontragent` с реальным id из БД → `setOptions` фильтры + `setProp(dogovorKontragenta, enabled, true)`.
5. **COMMAND `save`** → `notify(success)`.
6. **COMMAND `post`** → проведение (handler.onPost запустит проводки) ИЛИ ошибки валидации.
7. **COMMAND `print:ZayavkaGpSdelki`** → `effect.download` с URL PDF.
8. **EVENT с устаревшим revision** → HTTP 409 STALE_REVISION.
9. **EVENT с фейковым formSessionId** → HTTP 409 SESSION_NOT_FOUND.
10. **CLOSE** → `revision: -1`.

Postman-коллекция с готовыми запросами и автоматической передачей `revision` между шагами лежит в `webbuh/docs/project/sdui/postman/sdui-pilot.postman_collection.json`. Импортируй её первым делом — и можно проверять без curl-ручного.

---

## 14. Что НЕ покрыто этим документом

- **Архитектура движка фронта** (NodeRenderer, PatchApplier, ViewStateStore, реестр компонентов) — см. [frontend-spec.md §10](frontend-spec.md).
- **Каталог всех типов узлов** и их props — см. [frontend-spec.md §6](frontend-spec.md).
- **Подробные форматы патчей и эффектов** — см. [frontend-spec.md §7 и §8](frontend-spec.md).
- **Серверная архитектура** (form-session, scratch-модель, Phase 1 vs Phase 2) — см. `webbuh/docs/project/adr/ADR-0006-sdui-stateful-form-session.md`.

Если что-то не сходится с этим квикстартом — главный — это код бэка и Postman-коллекция; квикстарт собран по реальному поведению пилотного документа.
