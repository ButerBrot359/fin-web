# SCRUM-268 (+SCRUM-218 хвост) — фронт-спека для fin-web

> **Кому:** разработчику `fin-web` (React 19 + TS 5.9 + Vite 7, SDUI-клиент) или фронт-Claude-сессии.
> **Статус кода:** соответствующие правки во `fin-web` **будут откачены к `origin/main`** — эта
> спека заменяет код. Реализуй по контракту НАЧИСТО (clean code), не подглядывая в откаченный diff.
> **Бэкенд готов** (ветка `talgat/SCRUM-268`, будет запушен отдельно): сервер собирает дерево сам,
> фронт — чистый рендерер SDUI. Новых типов узлов вводить НЕ нужно; всё едет в `props`/`effects`/`patches`
> существующего контракта `POST /api/view`.
> **Связанная спека:** командная панель — `READMEs/webbuh/SCRUM-218-frontend-spec.md` и
> `docs/project/sdui/frontend-spec-command-bar.md`. Здесь — только то, что она НЕ покрывает.

> ### ⚠️ ОБНОВЛЕНИЕ 03.07 — сценарий «Банковский счёт» стал backend-only (фронт НЕ нужен)
> После сверки с реальным 1С (docs/tmp/SCRUM-268/img_10,img_12): у владельца
> подчинённого справочника `БанковскиеСчета.Владелец` **нет Тип-селектора** — тип
> фиксируется контекстом создания. Бэкенд теперь эмитит Владельца в drawer'е счёта как
> **обычный `REFERENCE_FIELD` фиксированного типа** (readonly, предзаполнен), а «Организация»
> скрывается/показывается **статически на build-time** (`visible` в исходном дереве, без
> event-time патчей). Проверено вживую на `origin/main`-фронте — **сценарий счёта работает
> БЕЗ единой фронт-правки.**
> Следствия для этой спеки:
> - **§3.2 (составной OBJECT-виджет) нужен ТОЛЬКО для составного реквизита ДОКУМЕНТА**
>   (`ЭСФ.Грузоотправитель/Грузополучатель` — там пользователь реально выбирает тип). Для
>   счёта он НЕ требуется.
> - **§3.4 (dialog-host — рендер из живого дерева) нужен ТОЛЬКО для ДИНАМИЧЕСКИХ event-time
>   visible-патчей** (если появятся drawer-поля, меняющие видимость по ходу). Для статического
>   build-time скрытия (как у счёта) origin/main-фронт уже работает — правка не нужна.
> - §3.3 (reference-field: `visible`, readonly, prefill, аффордансы), §3.5 (download), §3.6
>   (/documents), §3.7 (i18n) — **остаются в силе** (SCRUM-218 + общий SDUI).
> Итог приоритетов для фронта: сначала §3.3/§3.5/§3.6 (командная панель 218 + базовый SDUI);
> §3.2/§3.4 — только когда дойдёт до полноценного составного реквизита на ДОКУМЕНТЕ (ЭСФ).

---

## Оглавление

1. [Зачем эти изменения](#1-зачем-эти-изменения)
2. [Изменённые/новые backend-контракты](#2-изменённыеновые-backend-контракты)
3. [Что реализовать в fin-web](#3-что-реализовать-в-fin-web)
   - 3.1 [Хелперы загрузки опций (переиспользуемый seam)](#31-хелперы-загрузки-опций-переиспользуемый-seam)
   - 3.2 [Составной OBJECT-виджет](#32-составной-object-виджет)
   - 3.3 [Ссылочное поле — аффордансы и visible](#33-ссылочное-поле--аффордансы-и-visible)
   - 3.4 [dialog-host — рендер из живого дерева](#34-dialog-host--рендер-из-живого-дерева)
   - 3.5 [download-эффект — attachment vs inline](#35-download-эффект--attachment-vs-inline)
   - 3.6 [Роутинг /documents/*](#36-роутинг-documents)
   - 3.7 [i18n](#37-i18n)
4. [Приёмка](#4-приёмка)

---

## 1. Зачем эти изменения

Две волны в одной ветке `talgat/SCRUM-268`:

**SCRUM-218 (командная панель, хвост).** Бэкенд-командбар (`showInList`, `copy`, «Выгрузить в
казначейство») эмитит два новых типа побочных эффектов, которые фронт пока обрабатывает неполно:

- **`navigate` на «плоский» роут** `/documents/:typeCode[/new]`. Команды `showInList`/`copy`
  возвращают `navigate`-эффект, но бэкенд НЕ знает раздел (`pageCode`) сайдбара, в котором
  живёт тип документа. Фронт обязан дорезолвить раздел и сделать `replace` на реальный роут
  `/modules/:pageCode/document/:typeCode`, сохранив `?copyFrom=…`.
- **`download` файла как `attachment`** (XML-выгрузка в казначейство). Текущий download-эффект
  всегда делает `window.open(blob)` — это открывает файл во вкладке, а не сохраняет на диск.
  Для `Content-Disposition: attachment` нужен реальный download с именем файла.

**SCRUM-268 (составной тип, «пилот ЭСФ» + «Владелец БанковскихСчетов»).** В 1С есть реквизиты
*составного типа* — одно поле, значение которого может быть ссылкой на один из нескольких типов
(например `ЭСФ.Грузоотправитель = Организации | Контрагенты`, `БанковскиеСчета.Владелец =
Организации | Контрагенты`). Фронту нужен новый виджет:

- **Составной OBJECT-виджет** (`OBJECT_FIELD`): селектор члена (какой из допустимых типов) +
  пикер значения выбранного члена; смена члена очищает значение (семантика 1С).
- **Живой drawer + server-driven `visible`-патчи.** Пилот «Владелец»: при `Владелец=Контрагент`
  на форме справочника БанковскиеСчета должно **появляться** поле «Организация», при
  `Владелец=Организация` — **скрываться**. Бэкенд шлёт `setProp(nodeId,"visible",…)`-патч в ответ
  на изменение поля в drawer'е. Сейчас drawer рендерится из статического снимка `panel.node` —
  патчи к нему не долетают. Нужно рендерить из живого session-tree.

---

## 2. Изменённые/новые backend-контракты

Единственный эндпоинт SDUI — **`POST /api/view`**. Ниже — только то, что относится к этим двум волнам.

### 2.1 Envelope запроса/ответа (напоминание, не меняется)

**Запрос** `ViewRequest`:
```jsonc
{
  "formSessionId": "f3c1…",   // null только на action.type=OPEN
  "revision": 12,             // null только на OPEN; иначе последний известный клиенту
  "layoutCode": "…",          // обязателен на OPEN
  "route": "/documents/…/1",  // на OPEN — бэк резолвит id/режим
  "action": {
    "type": "OPEN" | "EVENT" | "COMMAND" | "CLOSE",
    "sourceNodeId": "field.gruzootpravitel", // EVENT: == ViewNode.id узла-источника
    "trigger": "change",                     // EVENT
    "value": { … },                          // EVENT: новое значение поля; COMMAND: payload
    "command": "showInList"                  // COMMAND
  },
  "state": { … }              // ТОЛЬКО на OPEN нового документа (preset из query)
}
```

**Ответ** `ViewResponse` — три независимых канала:
- `tree` — полное дерево (на OPEN и при открытии дочерней сессии);
- `patches: ViewPatch[]` — точечные мутации уже отрисованного дерева;
- `effects: ViewEffect[]` — императивные команды клиенту.

### 2.2 `ViewPatch` (setProp — ключевой для visible)

```jsonc
{ "op": "setProp",  "nodeId": "dict.field.Organizatsiya", "key": "visible", "value": false }
{ "op": "setValue", "binding": "gruzootpravitel", "value": { … } }
```

**КРИТИЧНО:** `nodeId` в `setProp` — это строка, равная **build-time `id` узла** (`ViewNode.id`).
Патч применяется поиском узла по строгому равенству `node.id === patch.nodeId` в **живом** дереве
сессии. Если поле в drawer'е отрендерено из статического снимка, а не из живого дерева — патч
«потеряется». Отсюда требование §3.4.

### 2.3 `ViewEffect` — `openDialog` с дочерней сессией (drawer)

Эффект `openDialog` (тип `OPEN_DIALOG`) несёт `node` (поддерево диалога) и — для drawer'ов с
собственной form-сессией — транспорт дочерней сессии:

```jsonc
{
  "type": "openDialog",
  "node": { … },              // поддерево панели; props.presentation="drawer", props.title, props.width?
  "sessionId": "child-abc",   // id дочерней form-сессии — адрес для EVENT/COMMAND внутри панели
  "childRevision": 0,         // стартовый revision дочерней сессии
  "childState": {             // начальный snapshot значений полей панели
    "Vladelets": { "id": 5, "presentation": "ТОО Ромашка", "domain": "DICTIONARY", "targetTypeCode": "Kontragenty" },
    "Organizatsiya": null
  }
}
```

- `childState` — **начальное состояние** значений полей drawer'а; фронт инициализирует локальный
  кэш из него, не дожидаясь первого EVENT-ответа.
- Для составного поля значение в `childState` приходит в формате `RefOption` (см. §2.5): ключ
  `domain` (не `type`!) несёт DomainKind, `targetTypeCode` — конкретный тип. **Виджет читает из
  входящего значения только `targetTypeCode`** (см. §3.2, edge-case A).

### 2.4 `ViewEffect` — `navigate` и `download`

**`navigate`** (тип `NAVIGATE`):
```jsonc
{ "type": "navigate", "route": "/documents/SchetFakturaVydannyy/new?copyFrom=42" }
```
Бэкенд эмитит «плоский» роут `/documents/:typeCode[/new]` — БЕЗ раздела (`pageCode`). Фронт
дорезолвит раздел (§3.6). `route` может нести `?copyFrom=…` (копирование) — **сохранить query
целиком**.

**`download`** (тип `DOWNLOAD`):
```jsonc
{ "type": "download", "url": "/api/treasury-export/ZayavkaGPS/42" }
```
Фронт качает blob по `url` и **ветвится по заголовку `Content-Disposition` ответа**:
- `attachment` (напр. XML в казначейство, `TreasuryExportController` ставит
  `Content-Disposition: attachment; filename="ZayavkaGPS…​.xml"`) → реальное **скачивание на диск**;
- `inline` / без заголовка (напр. печатная форма PDF) → **превью** во встроенном просмотрщике.

### 2.5 `RefOption` — формат составного значения (⚠️ главный подвох)

DTO `RefOptionDto` — элемент списка опций пикера И формат значения ссылочного/составного поля:

```jsonc
{
  "id": 42,
  "presentation": "ТОО Ромашка",
  "domain": "DICTIONARY",       // ← DomainKind, ТОЛЬКО для составных OBJECT-полей; у обычных ссылок null
  "targetTypeCode": "Organizatsii" // ← код КОНКРЕТНОГО типа, ТОЛЬКО для составных; у обычных ссылок null
}
```

**Развилка имён, которую нельзя перепутать:**

| Направление | ключ DomainKind | ключ конкретного типа |
|---|---|---|
| **Сервер → фронт** (`RefOption` во входящем значении / childState) | **`domain`** | `targetTypeCode` |
| **Фронт → сервер** (значение, которое виджет ШЛЁТ в EVENT) | **`type`** | `targetTypeCode` |

То есть DomainKind во **входящем** значении лежит под `domain`, а в **исходящем** (что эмитит
виджет) — под `type`. Единственное поле, стабильно присутствующее в ОБЕ стороны и однозначно
идентифицирующее выбранный член, — **`targetTypeCode`**. Поэтому:

> **Виджет читает из входящего значения ТОЛЬКО `targetTypeCode`.** Ни `domain`, ни `type` из
> входящего значения не читаются (они там либо под разными ключами, либо отсутствуют). `type`
> виджет только ПИШЕТ при эмите выбора.

**Почему `targetTypeCode` load-bearing (P0-урок same-domain):** у `Владелец` оба члена —
`Организации` и `Контрагенты` — домена `DICTIONARY`. Одного `domain` недостаточно, чтобы понять,
какой член выбран. Различает только `targetTypeCode`. Он обязан round-trip'иться: пришёл в
значении → тем же значением ушёл при следующем изменении.

### 2.6 Props узлов (читать из `node.props`)

**`OBJECT_FIELD`** (`NodeType.OBJECT_FIELD`, составной тип):
| prop | тип | смысл |
|---|---|---|
| `allowedTypes` | `AllowedType[]` | список допустимых членов (см. ниже); отсортирован по `position` |
| `label` | string? | подпись пикера значения |
| `required` / `readonly` / `enabled` / `visible` | boolean? | стандартные; `visible` default `true`, `enabled` default `true` |
| `error` | string? | текст ошибки поля |
| `flex` | number/string? | flex-раскладка |

Элемент `allowedTypes[i]` (собирается бэком в `CompositeFieldPropsResolver`):
```jsonc
{
  "position": 1,                       // порядок члена (= порядок «|» в типе 1С)
  "domainKind": "DICTIONARY",          // DomainKind члена
  "targetTypeCode": "Organizatsii",    // код конкретного типа члена
  "presentation": "Организации",       // подпись члена в селекторе
  "optionsSource": { "url": "/api/dictionary-entries/Organizatsii/entries", "params": { … } }
  //                    ↑ ЕСТЬ только у ссылочных членов; у примитивов/ENUMS отсутствует
}
```

**`REFERENCE_FIELD`** (`NodeType.REFERENCE_FIELD`, обычная ссылка):
| prop | тип | смысл |
|---|---|---|
| `domain` | string? | домен цели (`DICTIONARY`/`DOCUMENT`/`ACCOUNT_PLAN`), default `DICTIONARY` |
| `targetTypeCode` | string? | код целевого типа |
| `optionsSource` | `{url, params?}`? | резолвнутый эндпоинт опций (приоритетнее legacy-пути) |
| `filter` | object? | доп. фильтр для legacy-пути |
| `allowCreate` | boolean? | показывать аффорданс «Создать» |
| `allowShowAll` | boolean? | показывать «Показать все» |
| `allowOpen` | boolean? | показывать «Открыть» (проваливание) |
| `label`/`required`/`readonly`/`enabled`/`visible`/`error` | | стандартные |

**`node.actions[]`** (для полей — server-driven триггеры/команды):
- `{ trigger: "change", actionId: "fieldEvent" }` — поле должно слать серверный EVENT `change`;
- `{ trigger: "create"|"open", actionId: "command", command: "<cmd>" }` — командные аффордансы;
- `{ trigger: "showAll", … }` — «Показать все» через команду.

### 2.7 optionsSource — эндпоинты пикера

`optionsSource.url` — готовый REST-путь листинга записей. Фронт добавляет к `params` поисковую
строку и пагинацию: `{ ...optionsSource.params, search, page: 0, size: 20 }`. Ответ — Spring `Page`
(`{ content: RefOption[] }`) ИЛИ `{ items: RefOption[] }`. Legacy-путь (поле без `optionsSource`)
собирается фронтом сам: `/api/{domainPath}/{targetTypeCode}/entries`, где
`domainPath ∈ { DICTIONARY→dictionary-entries, DOCUMENT→document-entries, ACCOUNT_PLAN→account-plan }`.

---

## 3. Что реализовать в fin-web

Общий принцип: **фронт — тонкий рендерер**. Никакого хардкода типов/эндпоинтов/бизнес-логики —
всё из `node.props` / `effects` / `patches`. Реюзай существующие SDUI-хуки (`useSduiSession`,
`useSduiDispatch`, `AutocompleteInput`, `patch-applier`). Ниже — контракт и поведение, НЕ калька кода.

### 3.1 Хелперы загрузки опций (переиспользуемый seam)

Составное и ссылочное поле грузят опции одинаково — вынеси общий seam, чтобы не дублировать fetch
и логику сброса кэша. Предлагаемая структура (`src/features/sdui/lib/`):

**`reference-options.ts`** — чистые функции без React:
- тип `OptionsSource = { url: string; params?: Record<string,string> }`;
- тип `ReferenceValue = { id: number; presentation: string }`;
- `fetchEntryOptions({ url, params })` → `Promise<SelectOption[]>`: дёргает `apiService.get`,
  маппит `data.content ?? data.items ?? []` в `SelectOption` (`{ id, code:String(id),
  label: presentation ?? name ?? String(id) }`). `params` передаётся как есть — **вызывающий сам
  решает порядок/состав** (search/page/size/фильтры), чтобы не менять семантику существующих полей;
- `referenceValueToOption(ref)` / `optionToReferenceValue(opt)` — конверсия туда-обратно.

**`use-reference-options.ts`** — хук состояния опций:
```ts
useReferenceOptions(
  fetcher: (search?: string) => Promise<SelectOption[]>,
  resetKey: string
): { options: SelectOption[]; loading: boolean; load: (search?) => Promise<void> }
```
- `options`/`loading` — стейт; `load(search)` — грузит через `fetcher`, тихо глотает ошибку
  (транспорт логирует сам, UI покажет пустой список);
- `resetKey` — **сериализованный ключ источника**: как только он меняется (другая организация в
  `params`, другой тип члена) — `options` сбрасывается в `[]` (через `useEffect([resetKey])`).

> **Зачем seam:** один хук обслуживает и ссылочное поле (с legacy-веткой), и члена составного типа.
> Fetcher задаёт вызывающий — так хук не знает про домены и эндпоинты.

### 3.2 Составной OBJECT-виджет

**Файлы:** `src/features/sdui/ui/nodes/composite/object-field-node.tsx` (+ вынести чистую логику в
`object-field-logic.ts`). Тип узла — `OBJECT_FIELD`.

**Модель.** Значение поля во view-state:
```ts
interface ObjectValue {
  id: number
  presentation: string
  type?: string          // DomainKind — ПИШЕМ при эмите; во входящем НЕ читаем (см. §2.5)
  targetTypeCode: string // единственное поле, читаемое из входящего значения
}
```
Член: `AllowedType = { position, domainKind, targetTypeCode, presentation, optionsSource? }`.

**Разметка (аналог поля составного типа в 1С):** горизонтально — компактный **селектор члена**
(MUI `Select`, `minWidth ~160`, label из i18n `objectField.type`, пункты по `allowedTypes`,
подпись пункта = `presentation`, `value` пункта = `targetTypeCode`) + **пикер значения**
выбранного члена.

**Выбор члена (чистая производная функция, БЕЗ стейта-в-эффекте):**
```
selectedTypeCode = resolveSelectedTypeCode(allowedTypes, value, userTypeCode)
  приоритет: value.targetTypeCode (если задан и ∈ allowedTypes)
           → userTypeCode (ручной выбор, когда значение пусто)
           → allowedTypes[0].targetTypeCode (первый член)
```
`userTypeCode` — единственный локальный `useState` (ручной выбор члена, когда значение пусто).
Тип из значения ВСЕГДА приоритетнее ручного — поэтому селектор полностью производный.

**Пикер значения члена** — по сути ссылочный автокомплит, ограниченный `optionsSource` выбранного
члена. Реюзай `AutocompleteInput` + `useReferenceOptions` (§3.1):
- `resetKey = JSON.stringify(optionsSource ?? null)` — при смене члена опции сбрасываются;
- fetcher: `optionsSource ? fetchEntryOptions({ url, params:{...params, search, page:0, size:20} }) :
  Promise.resolve([])`;
- `onOpen` грузит опции если список пуст; `onInputChange(reason==='input')` грузит по вводу;
- selectedOption показывать **только если** `value?.targetTypeCode === выбранный allowedType.targetTypeCode`
  (иначе `null` — значение относится к другому члену);
- `key={selectedType.targetTypeCode}` на пикере — форсируй перемонтаж при смене члена (чистый сброс
  inputValue/опций).

**Члены-примитивы** (`optionsSource` отсутствует — примитив или ENUMS) — **вне scope пилота**:
рендерь disabled-`TextField`-заглушку с placeholder из i18n `objectField.unsupportedMember`. НЕ падай.

**Эмит серверу.** Реюзай `useSduiSession().setValue(binding, …)` + `useSduiDispatch`:
- смена члена (`handleTypeChange`): если новый `targetTypeCode !== текущий` → `setUserTypeCode(next)`,
  и **если значение было — очистить** (`emitChange(null)`). Семантика 1С: смена члена ВСЕГДА чистит
  значение (без кэша «по типу»);
- выбор записи (`handleValueChange`): `emitChange(buildObjectValue(selectedType, option))`, где
  `buildObjectValue = { id:Number(option.id), presentation:option.label, type:member.domainKind,
  targetTypeCode:member.targetTypeCode }` — **`type` = DomainKind члена** (исходящий формат, §2.5);
- `emitChange(v)`: `if (binding) setValue(binding, v)` + серверный EVENT `change` — но **только если**
  у узла есть `action { trigger:'change', actionId:'fieldEvent' }` (гейт, как у reference-field).

**Edge-cases:**
- **A. Preselect типа из childState.** При открытии drawer'а значение `Владелец` приходит в
  `childState` как `RefOption` с `domain`+`targetTypeCode`. Виджет должен предвыбрать член по
  `value.targetTypeCode` — и это уже покрыто `resolveSelectedTypeCode` (читает `targetTypeCode`).
  Ключ: НЕ пытайся читать `domain`/`type` из входящего значения.
- **B. `allowedTypes` пуст** → рендерь `null` (нечего показывать).
- **C. `visible===false`** → рендерь `null` (см. §3.4 — критично для drawer).
- **D. `enabled===false` / `readonly`** → селектор и пикер disabled/readOnly соответственно.

**Чистый паттерн:** вся логика выбора члена и сборки значения — чистые функции в
`object-field-logic.ts` (`sortAllowedTypes`, `resolveSelectedTypeCode`, `findAllowedType`,
`buildObjectValue`), покрываются unit-тестами без React. Компонент — только рендер + проводка.

### 3.3 Ссылочное поле — аффордансы и visible

**Файл:** `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` (`REFERENCE_FIELD`).

**Рефактор загрузки опций:** замени локальный `useState<options>`/`useEffect`/inline-`fetchOptions`
на общий `useReferenceOptions` (§3.1). `resetKey = optionsSource?.params ? JSON.stringify(params) :
JSON.stringify(filter ?? null)`. Fetcher — двухветочный:
- `optionsSource` есть → `fetchEntryOptions({ url:optionsSource.url, params:{...params, search,
  page:0, size:20} })`;
- иначе legacy → `targetTypeCode ? fetchEntryOptions({ url:`/api/${domainPath}/${targetTypeCode}/entries`,
  params:{ search, page:0, size:20, ...filter } }) : Promise.resolve([])`.

**Аффордансы (командные vs авто):**
- **«Показать все»** (`onShowAll`): если есть `action{trigger:'showAll'}` → диспатч
  `COMMAND` с его `command`; иначе если `allowShowAll ?? canBrowse` → открыть локальный dict-список
  (`useDictSidebarStore`). `canBrowse = !!targetTypeCode && !readonly && enabled`.
- **«Создать»** (`onAdd`): если есть `action{trigger:'create',actionId:'command'}` → диспатч
  `COMMAND createAction.command`; иначе если `allowCreate ?? canBrowse` → локальное создание в
  dict-sidebar.
- **«Открыть»** (endAction, проваливание): показывать только если есть `selectedOption` И
  `action{trigger:'open',actionId:'command'}`; клик (`onMouseDown` с `preventDefault`, `tabIndex=-1`)
  → диспатч `COMMAND openAction.command`.
- Выбор записи (`onChange`): `optionToReferenceValue(opt)` → `setValue(binding, …)` + серверный
  EVENT `change` (гейт по `action{change,fieldEvent}`).

**`visible`:** `const visible = node.props?.visible ?? true; if (!visible) return null`. Узел с
`visible===false` НЕ рендерится (не просто прячется CSS) — иначе server-driven visible-патчи
(§3.4) бессмысленны.

**Чистый паттерн:** никакого `apiService` прямо в компоненте — только через `reference-options.ts`.
`DOMAIN_PATH_MAP` (маппинг домена в путь) — единственное «знание» о доменах, вынеси константой.

### 3.4 dialog-host — рендер из живого дерева

**Файл:** `src/features/sdui/ui/dialog-host.tsx`. **Это корень бага «Организация не скрывается».**

**Проблема.** Drawer с собственной сессией рендерился из статического снимка `panel.node`.
Server-driven `setProp(nodeId,"visible",…)`-патчи (ответ на child-EVENT) применяются к **живому**
дереву сессии (`tree`-стейт провайдера), а не к снимку — поэтому до полей drawer'а не долетали.

**Требование.** `PanelFormProvider` держит живой `tree`-стейт (init из `panel.node`) и
**рендерит `<NodeRenderer node={tree} />` из этого живого стейта**, а не из статического
`panel.node`. Патчи из ответов на EVENT/COMMAND внутри дочерней сессии применяются к `tree` штатным
`patch-applier` (как в `SduiScreen` для основной формы). Это зеркалит основную форму — просто
дочерняя сессия должна вести себя так же.

Конкретно:
- вынеси рендер `<NodeRenderer>` ВНУТРЬ `PanelFormProvider` (провайдер сам рендерит `tree`), убери
  внешний `children`-снимок в `DialogHost.map`;
- `session`-контекст провайдера должен экспонировать `tree` + `setRoot`, чтобы `patch-applier` мог
  мутировать дерево;
- для панелей БЕЗ собственной сессии (`panel.session == null`) — прежний путь: рендер
  `panel.node` напрямую (статики достаточно, патчей нет).
- Заголовок панели: читать `panel.node.props?.title` только если это строка (`typeof === 'string'`).

**Почему build-time + event-time вместе.** На открытии drawer'а видимость уже «запечена» в props
узлов (поле рождается скрытым/видимым — без гонки «openDialog + патч в том же ответе»). При
изменении `Владелец` бэкенд шлёт event-time `setProp visible`-патч — он применяется к уже
смонтированному живому дереву. Оба пути — один источник истины на бэке; фронту нужно лишь
корректно применять патч к живому дереву.

### 3.5 download-эффект — attachment vs inline

**Файл:** `src/features/sdui/lib/effect-handler.ts`, ветка `case 'download'`.

Скачай blob (`apiService.getFileBlob({ url })`), создай `objectUrl = URL.createObjectURL(blob)`,
затем ветвись по заголовку ответа `content-disposition`:
- содержит `attachment` (регэксп `/attachment/i`) → создай `<a download href=objectUrl>`,
  `download`-имя = распарсенное из `Content-Disposition` имя файла (или `'download'`), `click()`,
  `remove()` — **реальное сохранение на диск**;
- иначе → `window.open(objectUrl, '_blank')` — **inline-превью** (PDF печатной формы);
- в обоих случаях `setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)`;
- на ошибку — тост `error` («Не удалось сформировать файл»).

**Парсинг имени файла** (отдельная чистая функция) из `Content-Disposition`:
- сперва RFC 5987 `filename*=UTF-8''<pct-encoded>` (приоритет, `decodeURIComponent`, обрезать
  кавычки; на кривой percent-encoding — упасть на plain ниже);
- затем `filename="…"`;
- пусто, если ничего не нашлось (вызывающий подставит `'download'`).

> **Почему нельзя всегда `window.open(blob)`:** для рендерящихся браузером типов (XML тоже) это
> открыло бы файл во вкладке, а не сохранило. Казначейская выгрузка ДОЛЖНА сохраниться файлом —
> бэкенд для этого ставит `Content-Disposition: attachment`, фронт обязан это уважать.

### 3.6 Роутинг /documents/*

**Файлы:** `src/app/App.tsx` (+ новый модуль `src/pages/documents/document-redirect/`).

Бэкенд-командбар эмитит «плоские» `navigate`-роуты `/documents/:typeCode[/new]` (команды
`showInList`/`copy`), НЕ зная раздел (`pageCode`). Реальные роуты приложения —
`/modules/:pageCode/document/:typeCode[/new]`. Нужен редирект-резолвер.

**Роуты** (App.tsx):
```
/documents/:typeCode       → <DocumentRedirect mode="list" />
/documents/:typeCode/new   → <DocumentRedirect mode="new" />
```

**`DocumentRedirect`** (`ui/document-redirect.tsx`):
- берёт `typeCode` из params, резолвит `pageCode` хуком (ниже);
- пока резолвится → `<PageSkeleton />`;
- не нашёлся раздел → `console.warn` + `<Navigate to="/" replace />`;
- нашёлся → `<Navigate to={target} replace />`, где
  `listPath = /modules/${pageCode}/document/${typeCode}`,
  `target = mode==='new' ? listPath + '/new' + location.search : listPath`.
  **`location.search` (`?copyFrom=…`) сохраняется** — его читают и форма документа, и SDUI OPEN
  (route = pathname + search).

**Резолв раздела** (`lib/resolve-document-page-code.ts` + `use-resolve-document-page-code.ts`):
- `moduleContainsType(items, typeCode)` — чистая: тип встречается в дереве модуля
  (колонки → секции → `element.code === typeCode`);
- `resolveDocumentPageCode(moduleCodes, itemsByModuleCode, typeCode)` — перебор в порядке
  `moduleCodes` (= порядок в сайдбаре); первый модуль, содержащий тип; `undefined` если нигде;
- хук `useResolveDocumentPageCode(typeCode)`:
  - `useQuery(['settings','modules'])` → список кодов модулей (`GET /api/settings/modules`);
  - `useQueries` по каждому коду (`['settings','modules', code]`, `getModule(code)`, `select` →
    `items`) — **делит кэш с `useModule`** (те же queryKey), уже открытые разделы не
    перезапрашиваются; `staleTime ~5 мин`;
  - `isResolving = modulesQuery.isLoading || any moduleQuery.isLoading`;
  - `pageCode` — мемо: собрать `itemsByModuleCode` и вызвать чистый `resolveDocumentPageCode`.

**Чистый паттерн:** резолв-логика — чистые функции (тестируются без сети/React); хук — только
data-fetching и мемоизация; компонент — только `<Navigate>`/скелет. Никакого хардкода
соответствия тип→раздел.

### 3.7 i18n

Добавь ключи в `src/app/config/i18n/locales/{ru,kz}/common.json`:
```jsonc
// ru
"objectField": { "type": "Тип", "unsupportedMember": "Тип не поддерживается (в разработке)" }
// kz
"objectField": { "type": "Түрі", "unsupportedMember": "Түрі қолданылмайды (әзірленуде)" }
```

---

## 4. Приёмка

Проверяется на dev-стенде (бэкенд `talgat/SCRUM-268` + БД). E2E-сценарии:

**A. Составное поле «Владелец» + живой drawer (SCRUM-268, ядро).**
1. Открыть документ, где есть ссылочное поле на БанковскиеСчета (напр. счёт поставщика), нажать
   «Создать» у поля → открывается drawer формы БанковскиеСчета.
2. В drawer'е поле **«Владелец»** — составное: селектор `Организации | Контрагенты` + пикер.
3. Выбрать член **«Организации»**, выбрать организацию → поле **«Организация» СКРЫТО**.
4. Сменить член на **«Контрагенты»**, выбрать контрагента → значение сбросилось при смене члена;
   поле **«Организация» ПОЯВИЛОСЬ** (server-driven `setProp visible=true` долетел до живого дерева
   drawer'а — проверка §3.4).
5. Сменить обратно на «Организации» → «Организация» снова скрылась.
   ✅ Критерий: динамическая видимость работает ВНУТРИ drawer'а (не только в основной форме).

**B. Preselect составного значения (open существующей записи).**
1. Открыть drawer существующего БанковскогоСчёта с `Владелец=Контрагент`.
2. Селектор члена предвыбран на «Контрагенты», пикер показывает текущего контрагента, «Организация»
   видима. ✅ Критерий: `targetTypeCode` из `childState` корректно предвыбирает член.

**C. Копирование документа с составным полем (SCRUM-218 copy + SCRUM-268 round-trip).**
1. В списке документов с составным реквизитом (напр. ЭСФ с `Грузоотправитель`) выбрать документ →
   команда «Скопировать».
2. Фронт получает `navigate /documents/<typeCode>/new?copyFrom=<id>`, дорезолвивает раздел,
   переходит на форму нового документа с сохранённым `?copyFrom`.
3. Составное поле `Грузоотправитель` в копии сохранило и член (тип), и значение.
   ✅ Критерий: `targetTypeCode` round-trip'нулся (не потерялся при copy).

**D. Командная панель — навигация и выгрузка (SCRUM-218 хвост).**
1. На форме документа «Показать в списке» → фронт по `navigate /documents/<typeCode>` дорезолвит
   раздел и откроет `/modules/<pageCode>/document/<typeCode>` (список).
2. На «Заявка ГП» команда **«Выгрузить в казначейство»** → `download`-эффект → XML **скачивается
   файлом на диск** (`ZayavkaGPS…​.xml`), НЕ открывается во вкладке.
3. Печать (PDF) → `download`-эффект с `inline` → **превью** во вкладке.
   ✅ Критерий: attachment сохраняется, inline превьюится (различаются по `Content-Disposition`).

**E. Регресс командбара (SCRUM-218):** кнопки/меню рендерятся по `img_*`-макетам; disabled-заглушки
показываются с tooltip (см. `SCRUM-218-frontend-spec.md` §1.5 — инвариант `enabled===false`).

**Unit (обязательно, чистые функции без React/сети):**
- `object-field-logic`: `resolveSelectedTypeCode` (приоритет value→user→first), `buildObjectValue`
  (пишет `type=domainKind`, `targetTypeCode`), `sortAllowedTypes`;
- `resolve-document-page-code`: `moduleContainsType`, `resolveDocumentPageCode` (первый модуль, порядок);
- `parseContentDispositionFilename`: `filename*=UTF-8''…`, `filename="…"`, пусто.
