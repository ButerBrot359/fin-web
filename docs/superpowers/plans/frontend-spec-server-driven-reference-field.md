# SDUI: спека фронт-работ (fin-web) — Server-driven ссылочное поле и сайдбар выбора (Phase 1)

Документ для фронт-команды (`fin-web`). Реализует **Phase 1** переноса ссылочного поля на бэк: дропдаун-опции, кнопка «Показать все» и **сам сайдбар-список** (drawer с записями справочника, поиск, скролл, выбор) теперь **описываются и наполняются бэком**. Фронт перестаёт знать `domain→path`, формат эндпоинтов/фильтра, колонки и набор кнопок.

Архитектурное решение — [ADR-0009](../adr/ADR-0009-sdui-server-driven-reference-field.md). Phase 2 (кнопка «Добавить» с вложенной формой создания и «проваливание») — **отдельная спека позже**; здесь её нет.

> **Принцип миграции — на уровне ПОЛЯ, не экрана.** Поле, пришедшее с новым контрактом (есть `props.optionsSource` и `ref.*`-actions), идёт по новому пути (этот документ). Поле без них — продолжает работать как сейчас (`DOMAIN_PATH_MAP` + `dict-sidebar`). Старый `dict-sidebar` НЕ удаляем в Phase 1 — он остаётся для немигрированных полей и для Phase 2-фич. Эталон миграции — поля `dogovorKontragenta` и `schetKontragenta` документа «Заявка на регистрацию ГП-сделки».

---

## Контекст контракта (что присылает бэк)

Единый эндпоинт `POST /api/view`, действия `OPEN/EVENT/COMMAND/CLOSE` (без изменений). Новое:

1. **`REFERENCE_FIELD` получает новые props:**
   - `optionsSource: { url: string, params: Record<string, string> }` — **готовый** эндпоинт опций дропдауна и базовые query-параметры (фильтр уже включён и сериализован бэком в нужном формате). Фронт берёт их **дословно**, ничего не достраивая.
   - `allowShowAll: boolean`, `allowCreate: boolean`, `allowOpen: boolean` — какие аффордансы показывать (бэк решает по состоянию поля).
   - `domain` / `targetTypeCode` остаются (для legacy-пути), но в новом пути фронт их **не использует** для построения URL.

2. **`REFERENCE_FIELD` получает новые actions** (кнопки становятся серверными командами):
   ```jsonc
   "actions": [
     { "trigger": "change",  "actionId": "fieldEvent" },          // как сейчас
     { "trigger": "showAll", "actionId": "command", "command": "ref.showAll:field.dogovorKontragenta" },
     { "trigger": "open",    "actionId": "command", "command": "ref.open:field.dogovorKontragenta" }   // Phase 2
   ]
   ```
   `command` несёт суффикс с id поля — бэк по нему знает, какое поле инициировало команду.

3. **Новый тип узла `LIST`** — серверно-описанный paged-грид (тело drawer-списка). См. §2.

4. **`OPEN_DIALOG` получает презентацию drawer.** Корневой узел поддерева, прилетающего в `openDialog`-эффекте, несёт `props.presentation: 'drawer' | 'modal'` (по умолчанию `modal` — обратная совместимость с ДтКт-диалогом). При `'drawer'` фронт рисует правый Drawer, а не центральную модалку. См. §3.

5. **COMMAND несёт `value`.** Для выбора строки в списке фронт шлёт `COMMAND { command: 'ref.select:field.dogovorKontragenta', value: { id, presentation } }`. Транспорт уже прокидывает `action` целиком — нужно лишь не терять `value` на уровне типов/вызова (см. §4).

---

## Задача 1 — `ReferenceFieldNode`: опции и кнопки через бэк

**Файл:** `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`

### 1.1 Дропдаун-опции — из `optionsSource`

Сейчас (строки 13-17, 67-90) фронт сам мапит домен в путь и строит URL:
```ts
const DOMAIN_PATH_MAP = { DICTIONARY: 'dictionary-entries', DOCUMENT: 'document-entries', ACCOUNT_PLAN: 'account-plan' }
const domainPath = DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'
// ...
url: `/api/${domainPath}/${targetTypeCode}/entries`,
params: { search, page: 0, size: 20, ...filter },
```

**Стало:** если пришёл `node.props.optionsSource` — использовать его дословно, добавляя только `search/page/size`:
```ts
const optionsSource = node.props?.optionsSource as { url: string; params?: Record<string, string> } | undefined

const fetchOptions = async (search?: string) => {
  if (optionsSource) {
    setLoading(true)
    try {
      const res = await apiService.get<{ content?: EntryItem[]; items?: EntryItem[] }>({
        url: optionsSource.url,
        params: { ...optionsSource.params, search, page: 0, size: 20 },
      })
      const items = res.data.content ?? res.data.items ?? []
      setOptions(items.map((item) => ({
        id: item.id,
        code: String(item.id),
        label: (item.presentation ?? item.name ?? String(item.id)) as string,
      })))
    } catch { /* silently fail */ } finally { setLoading(false) }
    return
  }
  // ─── legacy-путь (поле без optionsSource) — оставить как есть ───
  if (!targetTypeCode) return
  // ... текущий код с DOMAIN_PATH_MAP ...
}
```
Формат ответа не меняется: `{ content: [{ id, presentation }], ... }`. Бэк гарантирует, что в `optionsSource.params` фильтр уже в формате эндпоинта — **фронт ничего не конвертирует**.

### 1.2 Кнопка «Показать все» — серверная команда вместо `dict-sidebar`

Сейчас (строки 108-116, 153) «Показать все» дёргает фронтовый стор:
```ts
const openDictList = () => { useDictSidebarStore.getState().push({ mode: 'list', ... }) }
// ...
onShowAll={canBrowse ? openDictList : undefined}
```

**Стало:** если у узла есть `ref.showAll`-action — слать команду на бэк; бэк ответит `openDialog`-эффектом с drawer-списком (§3):
```ts
const showAllAction = node.actions?.find((a) => a.trigger === 'showAll' && a.actionId === 'command')

const onShowAll = showAllAction
  ? () => void dispatch({ type: 'COMMAND', command: showAllAction.command, sourceNodeId: node.id })
  : (canBrowse ? openDictList /* legacy */ : undefined)
```
Видимость кнопки — по `node.props.allowShowAll` (новый путь) либо `canBrowse` (legacy). Кнопку «Добавить» (`onAdd`) и «проваливание» (`endAction`) в Phase 1 **оставить на legacy-`dict-sidebar`** — они мигрируют в Phase 2. То есть: только «Показать все» переключается на сервер; «Добавить»/«проваливание» пока по-старому.

### 1.3 `applySelected` — без изменений

Выбор из дропдауна работает как сейчас (`setValue` + `fireServerEvent('change')`). Это тот же контракт, что и выбор из списка (§2.3) — бэк маршрутизирует оба одинаково.

---

## Задача 2 — новый узел `LIST` (paged-грид, pull-модель)

**Новый файл:** `src/features/sdui/ui/nodes/composite/list-node.tsx` + регистрация в `src/features/sdui/lib/component-registry.ts`. Добавить `'LIST'` в union `NodeType` (`src/features/sdui/types/node-types.ts`).

`LIST` — это **сам список записей в drawer'е**: то, что сейчас делает `DictSidebarListView`, но источник данных и колонки теперь диктует бэк. Модель — **pull**: узел сам ходит за страницами в `props.source.url`.

### Контракт узла `LIST`
```jsonc
{
  "id": "choice.dogovorKontragenta.list",
  "type": "LIST",
  "props": {
    "source": {
      "url": "/api/universaldomain-entries/DICTIONARY/DogovoryKontragentov/paged",
      "params": { "af": "Vladelets:30267", "skipDependsOn": "true", "sortAttr": "...", "sortDir": "ASC" }
    },
    "searchable": true,
    "selectionMode": "SINGLE"
  },
  "children": [
    { "id": "...col.nomer",  "type": "TABLE_COLUMN", "props": { "header": "Номер",      "width": 160, "binding": "Nomer" } },
    { "id": "...col.data",   "type": "TABLE_COLUMN", "props": { "header": "Дата",       "width": 120, "binding": "Data"  } },
    { "id": "...col.name",   "type": "TABLE_COLUMN", "props": { "header": "Наименование","width": 320, "binding": "nameRu" } }
  ],
  "actions": [
    { "trigger": "select",   "actionId": "command", "command": "ref.select:field.dogovorKontragenta" },
    { "trigger": "activate", "actionId": "command", "command": "ref.select:field.dogovorKontragenta" }
  ]
}
```

### Поведение (переиспользуй логику `DictSidebarListView`, но обобщённо)
- **Источник данных — `props.source` дословно.** Запрос: `GET source.url?{...source.params, page, size, q?}`. Фронт **не строит URL, не знает формат фильтра** — всё в `source.params`. Это снимает баг 3 (раньше «Показать все» и дропдаун расходились фильтром): теперь обе ветки берут параметры с бэка.
- **Пагинация/infinite-scroll** — как в `DictSidebarListView` (PAGE_SIZE, IntersectionObserver/виртуализация). Меняется только то, что `url`/`params` приходят из узла, а не вычисляются фронтом.
- **Поиск** (`props.searchable`) — локальный input, добавляет `q`/`search` к запросу к тому же `source.url`. (Параметр поиска — согласуй с бэком: `/paged` принимает `search`-подобный; если нужен отдельный `/search`-эндпоинт — бэк положит его в `source` или добавит флаг. **Уточнить у бэка перед стартом.**)
- **Колонки** — из дочерних `TABLE_COLUMN` (`props.header/width/binding`). `binding` — ключ в строке ответа (`row[binding]` или `row.attributes[binding]` — **согласуй структуру строки `/paged` с бэком**; вероятно нужно читать и top-level поля `nameRu/code`, и `attributes[...]`). Фронт больше не выводит колонки из метаданных типа сам.
- **Выбор строки:**
  - одиночный клик/выделение → `select`-action;
  - двойной клик/Enter → `activate`-action.
  - Действие: `dispatch({ type: 'COMMAND', command: action.command, value: { id: row.id } })`.
  - **Presentation НЕ вычисляется на фронте.** Шлём только `{ id: row.id }`. Бэк сам резолвит каноничное presentation по `id` (решение ADR-0009 §2.3.2 — бэк не доверяет строке `/paged`, где поля `presentation` нет) и вернёт его `setValue`-патчем поля. Можно приложить `row` как необязательную нагрузку для оптимистичного отображения, но источник истины — ответный `setValue`.
- После `ref.select` бэк сам пришлёт `closeDialog`-эффект (закрыть drawer) + `setValue` поля (с каноничным presentation) + патчи зависимых полей. Фронту закрывать drawer и подставлять presentation руками не нужно.

> `LIST` — это **не** `TABLE`. `TABLE` — редактируемая табличная часть документа со строками-binding в составе формы. `LIST` — read-only грид данных по URL с серверной пагинацией и select/activate. Это разные типы, общий у них только рендер ячеек.

---

## Задача 3 — `PanelHost`: drawer-презентация поверх `DialogHost`

**Файл:** `src/features/sdui/ui/dialog-host.tsx` (расширить или вынести в `panel-host.tsx`).

Сейчас (строки 12-29) каждый `openDialog`-эффект рисуется как центральная MUI `Dialog`. Нужно ветвление по `eff.node.props.presentation`:

```tsx
{stack.map((eff, i) => {
  if (!eff.node) return null
  const presentation = (eff.node.props?.presentation as string | undefined) ?? 'modal'

  if (presentation === 'drawer') {
    return (
      <Drawer
        key={eff.node.id ?? i}
        anchor="right"
        open
        onClose={popDialog}
        slotProps={{ paper: { sx: { width: (eff.node.props?.width as number) ?? 900,
                                    borderTopLeftRadius: 40, borderBottomLeftRadius: 40,
                                    backgroundColor: '#F2F6FD', overflow: 'hidden' } },
                     backdrop: { sx: { backgroundColor: 'rgba(34,33,36,0.6)' } } }}
      >
        <div className="flex h-full flex-col p-7">
          <NodeRenderer node={eff.node} />
        </div>
      </Drawer>
    )
  }

  return ( /* существующая ветка Dialog — без изменений */ )
})}
```

- Переиспользуй стили drawer'а из `dict-sidebar-drawer.tsx` (900px, скругления, бэкдроп) — чтобы UX совпал с текущим сайдбаром.
- Заголовок drawer'а бэк инжектит **LABEL-узлом внутри поддерева** (инвариант рендеринга: видимый заголовок ≠ `props.title`). Header с крестиком/Back собирается из узлов поддерева (`PAGE`/`HSTACK`/`BUTTON`), либо нарисуй его в `PanelHost` поверх `NodeRenderer` — согласуй с бэком, кто рисует крестик (рекомендуется: крестик/Back — в `PanelHost`, тело — поддерево).
- Закрытие: `onClose` → `popDialog()` (как сейчас). Бэк также может прислать `closeDialog(id)` — существующая ветка `effect-handler` уже это умеет (фильтр по `node.id`).
- В Phase 1 в стеке максимум **один** drawer (список выбора). Стек панелей с несколькими drawer'ами и Back-навигацией — Phase 2 (форма создания поверх списка). Но реализуй рендер как `.map` по стеку сразу (он уже такой), чтобы Phase 2 не переписывать.

`DialogHost`/`PanelHost` монтируется там же, где сейчас (`SduiScreen`, рядом с `NodeRenderer`).

---

## Задача 4 — `dispatch`/типы: `value` на COMMAND

**Файл:** `src/features/sdui/lib/dispatch.ts` + типы `src/features/sdui/types/view.ts`.

Транспорт уже прокидывает `action` целиком (dispatch.ts:89 `action,`), и `value` на EVENT уже используется. Нужно лишь:
1. Убедиться, что тип `ViewAction` допускает `value` (и `command`) совместно для `COMMAND` — добавить, если типизация это режет.
2. Места вызова (§1.2 «Показать все», §2 выбор строки) передают `command` (+ `value` для `ref.select`). `sourceNodeId` для `ref.showAll` — id поля.
3. Бэк начнёт читать `value`/суффикс команды на COMMAND — фронту достаточно его слать.

Никаких изменений в порядке применения патчей/эффектов (строки 103-114) не требуется — `ref.select` ответит обычными `setValue`+патчами+`closeDialog`, которые текущий конвейер уже обрабатывает.

---

## Что НЕ делаем в Phase 1

- **Кнопка «Добавить» (создание записи справочника) и «проваливание»** — остаются на legacy-`dict-sidebar`. Это Phase 2 (вложенная form-session, форма создания в drawer'е, кросс-сессионный возврат выбора) — отдельная спека.
- **Удаление `dict-sidebar/`** — нет. Подсистема нужна для немигрированных полей и Phase 2-фич. Ретайр — после полной миграции.
- **Сессия-на-панель / стек нескольких drawer'ов** — не нужно (один drawer-список). Заложи рендер стеком, но мульти-сессионную адресацию не делай.

---

## Сводка

| Задача | Файл | Объём | Зависимость от бэка |
|---|---|---|---|
| 1.1 Опции из `optionsSource` | `reference-field-node.tsx` | ~15 строк | бэк шлёт `props.optionsSource` |
| 1.2 «Показать все» → команда `ref.showAll` | `reference-field-node.tsx` | ~10 строк | бэк отвечает `openDialog`(drawer) |
| 2 Узел `LIST` (pull-грид) | новый `list-node.tsx` + registry + node-types | ~150 строк (переиспользует логику `DictSidebarListView`) | бэк шлёт `LIST` с `source`/колонками; presentation резолвит бэк по `id` в ответ на `ref.select` |
| 3 Drawer-презентация | `dialog-host.tsx` → `PanelHost` | ~40 строк | бэк шлёт `props.presentation='drawer'` |
| 4 `value` на COMMAND | `dispatch.ts` / `view.ts` | ~5 строк | бэк читает `value`/суффикс команды |

**Контрольный критерий Phase 1 (regression-гейт на баг 3):** на полях `dogovorKontragenta`/`schetKontragenta` заявки ГП — «Показать все» открывает серверный drawer-список, и его набор записей **совпадает** с набором дропдауна при том же состоянии формы (тот же фильтр контрагента/организации). Выбор строки заполняет поле и пересчитывает зависимости идентично выбору из дропдауна.

**Открытые вопросы к согласованию с бэком до старта:**
1. Параметр поиска для `LIST` (`search` на `/paged` vs отдельный `/search` в `source`).
2. Структура строки `/paged` (где лежат значения колонок для `TABLE_COLUMN.binding`: top-level поля типа `nameRu`/`code` vs `attributes[...]`). Presentation в строке НЕ требуется — его резолвит бэк по `id`.
3. Кто рисует крестик/Back в drawer'е — `PanelHost` или узлы поддерева.
