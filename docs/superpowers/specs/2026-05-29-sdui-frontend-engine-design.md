# SDUI Frontend Engine — Design Spec

**Дата:** 2026-05-29
**Статус:** Draft
**Бэкенд-спецификация:** `docs/superpowers/plans/frontend-spec-new-events-system.md`

---

## 1. Цель

Построить SDUI-движок на фронте (`src/features/sdui/`), который:
- Рендерит дерево `ViewNode` от бэка через реестр компонентов (31 `NodeType`)
- Управляет состоянием через `ViewStateStore` (кэш значений) + `TreeStore` (дерево + сессия)
- Общается с бэком через единый `POST /api/view` (OPEN / EVENT / COMMAND / CLOSE)
- Применяет патчи к дереву, проигрывает эффекты, обрабатывает 409 конфликты

Пилот: документ `ЗаявкаНаРегистрациюГПСделки` работает end-to-end на маршруте `/sdui/documents/...`.

---

## 2. Ключевые решения

### 2.1. Сосуществование с текущим кодом

- **Текущую логику не трогаем и не удаляем.** Старый функционал (per-page страницы, `form-renderer`, `react-hook-form`, zustand-сторы, `form-configs-server`) продолжает работать.
- SDUI-маршруты живут под отдельным префиксом `/sdui/*`.
- Единственное изменение в существующих файлах — добавление `<Route>` в `App.tsx`.

### 2.2. Маршрутизация

`SduiScreen` рендерится внутри существующего `Layout` (сайдбар + хедер остаются старые):

```tsx
// В App.tsx, внутри Layout
<Route path="/sdui/*" element={<SduiScreen />} />
```

Shell-компоненты (`APP_SHELL`, `TOP_BAR`, `SIDEBAR`, `WORKSPACE`) реализуем как заглушки — оболочка мигрирует на SDUI позже.

### 2.3. Два стора, а не один

- `TreeStore` — дерево + `formSessionId` + `revision`. Обновляется редко (патчи от сервера).
- `ViewStateStore` — кэш значений `binding → value`. Обновляется часто (каждый keystroke).

Разделение предотвращает лишние ре-рендеры: изменение значения поля не перерисовывает всё дерево.

### 2.4. formSessionId/revision в TreeStore

Живут в zustand-сторе, а не в локальном стейте `SduiScreen`. Причина — доступность из любого компонента (модалки, вложенные кнопки и т.п.).

### 2.5. REFERENCE_FIELD переиспользует AutocompleteInput

Используем существующий `src/shared/ui/inputs/AutocompleteInput.tsx` (уже styled, controlled). Серверный поиск по `/api/{domain}/{typeCode}/entries` — параметры из `node.props`.

### 2.6. Работаем против реального бэка

Без моков. Бэк готов (`POST /api/view` работает end-to-end). Моки можно добавить позже для тестов.

### 2.7. Локализация

- Серверные тексты (`props.label`, `props.title`, `props.text`) рендерим as-is — бэк присылает уже локализованные.
- Собственные UI-тексты движка (тосты, плейсхолдеры) — через `i18next` с ключами в `common.json`.

### 2.8. Работа в отдельной ветке

Вся работа ведётся в отдельной git-ветке от `dev`.

---

## 3. Структура модуля

```
src/features/sdui/
├── api/
│   └── view-transport.ts            # POST /api/view + DELETE sendBeacon
├── lib/
│   ├── stores/
│   │   ├── tree-store.ts            # дерево + formSessionId + revision
│   │   └── view-state-store.ts      # кэш значений (binding → value)
│   ├── patch-applier.ts             # применение ViewPatch[] к дереву
│   ├── effect-handler.ts            # проигрывание 5 типов эффектов
│   ├── conflict-handler.ts          # обработка 409
│   ├── dispatch.ts                  # единая точка вызова POST /view
│   └── component-registry.ts        # Record<NodeType, FC<NodeProps>>
├── ui/
│   ├── sdui-screen.tsx              # контейнер: OPEN/CLOSE/рендер
│   ├── node-renderer.tsx            # рекурсивный рендер по type
│   ├── unknown-node.tsx             # fallback для неизвестных типов
│   └── nodes/
│       ├── shell/                   # APP_SHELL, TOP_BAR, SIDEBAR, WORKSPACE
│       ├── layout/                  # PAGE, VSTACK, HSTACK, GRID, GROUP, TABS, TAB, TOOLBAR, SEPARATOR, SPACER
│       ├── display/                 # LABEL, TEXT, BADGE, ICON
│       ├── fields/                  # TEXT_FIELD, TEXT_AREA, NUMBER_FIELD, DATE_FIELD, DATETIME_FIELD, CHECKBOX_FIELD, ENUM_FIELD, REFERENCE_FIELD
│       ├── composite/               # TABLE, TABLE_COLUMN, OBJECT_FIELD
│       └── action/                  # BUTTON, MENU_ITEM, LINK
├── types/
│   ├── view.ts                      # ViewRequest, ViewResponse, ViewNode, ViewPatch, ViewEffect, ViewAction
│   └── node-types.ts                # NodeType enum, PatchOp, EffectType, ActionType
└── index.ts                         # публичный API: SduiScreen + типы
```

---

## 4. Типы (`types/`)

### 4.1. node-types.ts

```ts
// 31 NodeType — закрытый enum
type NodeType =
  // Shell (4)
  | 'APP_SHELL' | 'TOP_BAR' | 'SIDEBAR' | 'WORKSPACE'
  // Layout (10)
  | 'PAGE' | 'VSTACK' | 'HSTACK' | 'GRID' | 'GROUP'
  | 'TABS' | 'TAB' | 'TOOLBAR' | 'SEPARATOR' | 'SPACER'
  // Display (4)
  | 'LABEL' | 'TEXT' | 'BADGE' | 'ICON'
  // Fields (8)
  | 'TEXT_FIELD' | 'TEXT_AREA' | 'NUMBER_FIELD' | 'DATE_FIELD'
  | 'DATETIME_FIELD' | 'CHECKBOX_FIELD' | 'ENUM_FIELD' | 'REFERENCE_FIELD'
  // Composite (3)
  | 'TABLE' | 'TABLE_COLUMN' | 'OBJECT_FIELD'
  // Action (3)
  | 'BUTTON' | 'MENU_ITEM' | 'LINK'

type PatchOp = 'setProp' | 'setValue' | 'replaceNode' | 'insertNode' | 'removeNode' | 'moveNode' | 'setOptions'

type EffectType = 'navigate' | 'openDialog' | 'closeDialog' | 'notify' | 'download'

type ActionType = 'OPEN' | 'EVENT' | 'COMMAND' | 'CLOSE'
```

### 4.2. view.ts

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

interface ViewAction {
  type:          ActionType
  sourceNodeId?: string
  trigger?:      string
  command?:      string
  value?:        unknown
}

interface ViewRequest {
  formSessionId?: string
  revision?:      number
  layoutCode?:    string
  route?:         string
  action:         ViewAction
  state?:         Record<string, unknown>
}

interface ViewResponse {
  formSessionId: string
  revision:      number
  tree?:         ViewNode
  state?:        Record<string, unknown>
  patches?:      ViewPatch[]
  statePatch?:   Record<string, unknown>
  effects?:      ViewEffect[]
}

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

interface ViewEffect {
  type:     EffectType
  route?:   string
  node?:    ViewNode
  id?:      string
  level?:   string
  message?: string
  url?:     string
}

interface NodeProps {
  node: ViewNode
}

interface ConflictError {
  code:             'STALE_REVISION' | 'SESSION_NOT_FOUND'
  formSessionId?:   string
  currentRevision?: number
  snapshot?:        { state: Record<string, unknown> }
  reason?:          string
}
```

---

## 5. TreeStore (`lib/stores/tree-store.ts`)

Zustand-стор:

```ts
interface TreeStore {
  root:          ViewNode | null
  formSessionId: string | null
  revision:      number | null

  setRoot(node: ViewNode): void
  setSession(id: string, rev: number): void
  bumpRevision(rev: number): void
  applyPatches(patches: ViewPatch[]): void
  reset(): void
}
```

- `applyPatches` вызывает иммутабельный `patchApplier` (фильтрует `setValue` — те идут в `ViewStateStore`).
- `reset()` обнуляет всё — вызывается на CLOSE / unmount.

---

## 6. ViewStateStore (`lib/stores/view-state-store.ts`)

Zustand-стор:

```ts
interface ViewStateStore {
  state: Record<string, unknown>
  get(binding: string): unknown
  set(binding: string, value: unknown): void
  merge(patch: Record<string, unknown>): void
  replaceAll(s: Record<string, unknown>): void
  getAll(): Record<string, unknown>
}
```

Хуки-селекторы:
- `useViewState(binding?: string)` — подписка на конкретный binding (returns `undefined` если binding не задан).
- `useViewStateSetter()` — возвращает функцию `set(binding, value)`.

---

## 7. PatchApplier (`lib/patch-applier.ts`)

Чистая функция без side-effects.

```ts
function applyPatches(root: ViewNode, patches: ViewPatch[]): ViewNode
```

7 операций:

| Op | Поля | Что делает |
|---|---|---|
| `setProp` | `nodeId`, `key`, `value` | `node.props[key] = value` |
| `setValue` | `binding`, `value` | **Не трогает дерево** — обрабатывается отдельно в ViewStateStore |
| `replaceNode` | `nodeId`, `node` | Заменяет узел целиком |
| `insertNode` | `parentId`, `index`, `node` | Вставляет в `children` родителя |
| `removeNode` | `nodeId` | Удаляет из дерева |
| `moveNode` | `nodeId`, `parentId`, `index` | remove + insert |
| `setOptions` | `nodeId`, `options` | `node.props.options = options` |

Вспомогательные:
- `updateNode(root, id, mutator)` — рекурсивный иммутабельный обход
- `findNode(root, id)` — поиск по id
- `removeNodeFromTree(root, id)` — рекурсивное удаление
- `insertAt(arr, index, item)` — вставка в массив по индексу

Отдельная функция для кэша:
```ts
function applyValuePatches(patches: ViewPatch[], store: ViewStateStore): void
// Фильтрует op === 'setValue' и пишет store.set(binding, value)
```

---

## 8. Dispatch (`lib/dispatch.ts`)

Хук `useSduiDispatch()` — возвращает `async (action: ViewAction) => Promise<void>`.

### Логика по типу action:

**OPEN:**
1. `viewTransport.post({ route: location.pathname, action: {type:'OPEN'}, state? })`
2. `treeStore.setSession(res.formSessionId, res.revision)`
3. `treeStore.setRoot(res.tree!)`
4. `viewStateStore.replaceAll(res.state ?? {})`

**EVENT / COMMAND:**
1. `viewTransport.post({ formSessionId, revision, action })`
2. `treeStore.bumpRevision(res.revision)` — сохраняем новую ревизию
3. `treeStore.applyPatches(res.patches ?? [])` — иммутабельно обновляем дерево
4. `applyValuePatches(res.patches ?? [], viewStateStore)` — setValue-патчи в кэш
5. `viewStateStore.merge(res.statePatch ?? {})` — дополнительный мёрдж
6. `effectHandler.playAll(res.effects ?? [])` — проигрываем эффекты

**Порядок шагов 2–6 критичен:** revision → patches к дереву → значения в кэш → эффекты.

**CLOSE:**
1. `viewTransport.post({ formSessionId, action: {type:'CLOSE'} })` — fire-and-forget
2. Ничего — `reset()` делает `SduiScreen`

### Обработка ошибок:
- HTTP 409 → `conflictHandler.handle(err, action)`
- Всё остальное → `toast.error(extractMessage(err))`

---

## 9. ConflictHandler (`lib/conflict-handler.ts`)

Обработка двух типов HTTP 409:

**STALE_REVISION:**
1. `toast.info(t('sdui.conflict.staleRevision'))` — "Синхронизирую..."
2. `treeStore.setSession(err.formSessionId, err.currentRevision)`
3. `viewStateStore.replaceAll(err.snapshot.state)`
4. НЕ повторяем оригинальный action

**SESSION_NOT_FOUND:**
1. `toast.warning(t('sdui.conflict.sessionNotFound'))` — "Сессия истекла, переоткрываю..."
2. `dispatch({ type: 'OPEN' })`

---

## 10. EffectHandler (`lib/effect-handler.ts`)

5 типов эффектов:

| Тип | Действие |
|---|---|
| `navigate` | Отправляем `CLOSE` текущей сессии → `router.navigate(effect.route)` |
| `openDialog` | Пушим `{node, formSessionId, revision}` в стек диалогов |
| `closeDialog` | Убираем из стека по `effect.id` + `CLOSE` сессии диалога |
| `notify` | `toast[effect.level](effect.message)` |
| `download` | `window.open(effect.url, '_blank')` |

Стек диалогов — zustand-стор или локальный стейт в `SduiScreen`. Каждый диалог рендерится через MUI `Dialog` + `NodeRenderer`.

---

## 11. ViewTransport (`api/view-transport.ts`)

```ts
import { http } from '@/shared/api'

const viewTransport = {
  post: (req: ViewRequest): Promise<ViewResponse> =>
    http.post<ViewResponse>('/api/view', req).then(r => r.data),

  closeBeacon: (sessionId: string): void => {
    navigator.sendBeacon(`/api/view/${sessionId}`, '')
  },
}
```

Использует существующий `http` из `@/shared/api`. Базовый URL берётся из env (`VITE_API_BASE_URL`).

---

## 12. SduiScreen (`ui/sdui-screen.tsx`)

```tsx
const SduiScreen: FC = () => {
  const location = useLocation()
  const tree     = useTreeStore(s => s.root)
  const reset    = useTreeStore(s => s.reset)
  const dispatch = useSduiDispatch()

  // OPEN при монтировании и смене route
  useEffect(() => {
    void dispatch({ type: 'OPEN' })
    return () => {
      void dispatch({ type: 'CLOSE' })
      reset()
    }
  }, [location.pathname])

  // beforeunload: CLOSE через sendBeacon
  useEffect(() => {
    const handler = () => {
      const sid = useTreeStore.getState().formSessionId
      if (sid) viewTransport.closeBeacon(sid)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!tree) return <Skeleton />
  return <NodeRenderer node={tree} />
}
```

---

## 13. NodeRenderer и ComponentRegistry

### ComponentRegistry (`lib/component-registry.ts`)

```ts
const registry: Record<string, FC<NodeProps>> = {
  APP_SHELL:       AppShellNode,
  TOP_BAR:         TopBarNode,
  SIDEBAR:         SidebarNode,
  WORKSPACE:       WorkspaceNode,
  PAGE:            PageNode,
  VSTACK:          VStackNode,
  HSTACK:          HStackNode,
  GRID:            GridNode,
  GROUP:           GroupNode,
  TABS:            TabsNode,
  TAB:             TabNode,
  TOOLBAR:         ToolbarNode,
  SEPARATOR:       SeparatorNode,
  SPACER:          SpacerNode,
  LABEL:           LabelNode,
  TEXT:             TextNode,
  BADGE:           BadgeNode,
  ICON:            IconNode,
  TEXT_FIELD:       TextFieldNode,
  TEXT_AREA:        TextAreaNode,
  NUMBER_FIELD:     NumberFieldNode,
  DATE_FIELD:       DateFieldNode,
  DATETIME_FIELD:   DatetimeFieldNode,
  CHECKBOX_FIELD:   CheckboxFieldNode,
  ENUM_FIELD:       EnumFieldNode,
  REFERENCE_FIELD:  ReferenceFieldNode,
  TABLE:            TableNode,
  TABLE_COLUMN:     TableColumnNode,
  OBJECT_FIELD:     ObjectFieldNode,
  BUTTON:           ButtonNode,
  MENU_ITEM:        MenuItemNode,
  LINK:             LinkNode,
}
```

### NodeRenderer (`ui/node-renderer.tsx`)

```tsx
const NodeRenderer: FC<{ node: ViewNode }> = ({ node }) => {
  const Component = registry[node.type] ?? UnknownNode
  return <Component node={node} />
}
```

### UnknownNode (`ui/unknown-node.tsx`)

Плейсхолдер для неизвестных типов. Не ломает приложение, показывает предупреждение в dev.

---

## 14. Компоненты узлов — детали реализации

### 14.1. Shell (4 заглушки)

`APP_SHELL`, `TOP_BAR`, `SIDEBAR`, `WORKSPACE` — рендерят `children` через `NodeRenderer`. На Phase 1 не используются реально (оболочка остаётся старая). Реализуем минимально:

```tsx
const AppShellNode: FC<NodeProps> = ({ node }) => (
  <div>{node.children?.map(c => <NodeRenderer key={c.id} node={c} />)}</div>
)
```

### 14.2. Layout (10 компонентов)

**PAGE** — `<div>` с padding. Ставит `document.title` из `props.title`. Рендерит children.

**VSTACK** — flexbox column. Props: `gap`, `padding`, `align`, `flex`. Образец: существующий `src/features/form-renderer/ui/VStackNode`.

**HSTACK** — flexbox row. Props: `gap`, `justify`, `align`, `flex`. Образец: существующий `src/features/form-renderer/ui/HStackNode`.

**GRID** — CSS Grid `repeat(columns, 1fr)`. Props: `columns`, `gap`.

**GROUP** — MUI `Paper` с заголовком из `props.title`. Props: `collapsible`, `collapsed` (локальный стейт для toggle).

**TABS** — MUI `Tabs` + панели. Children — массив `TAB`-узлов. Активная вкладка — локальный React-стейт (презентационное состояние). Если у `TAB` есть `actions` — при смене вкладки вызываем `dispatch` с EVENT.

**TAB** — контент вкладки. Props: `title`, `icon`, `badge`. Рендерит children.

**TOOLBAR** — flex row. Рендерит children (`BUTTON`, `MENU_ITEM`, `SEPARATOR`).

**SEPARATOR** — MUI `Divider`. Props: `orientation` (`'horizontal'` | `'vertical'`).

**SPACER** — `<div style={{flex:1}} />`.

### 14.3. Display (4 компонента)

**LABEL** — MUI `Typography`. Props: `text`, `variant` (`'default'` | `'link'` | `'heading'`). Variant `link` — кликабельный, если есть `actions` с `trigger:'click'` → dispatch EVENT.

**TEXT** — MUI `Typography`. Props: `text`.

**BADGE** — MUI `Chip`. Props: `text`, `color` (`'default'` | `'success'` | `'warning'` | `'error'` | `'info'`).

**ICON** — MUI Icon по `props.name`. Динамический импорт из `@mui/icons-material` по имени: `React.lazy(() => import(`@mui/icons-material/${name}`))` с fallback на `HelpOutline` для неизвестных имён.

### 14.4. Fields (8 компонентов)

Общий контракт для всех полей:
- Значение читается из `useViewState(node.binding)`
- Запись: `useViewStateSetter()` → `set(node.binding, newValue)`
- Server-event: проверяем `node.actions` на `{trigger, actionId:'fieldEvent'}`, если есть — `dispatch({type:'EVENT', sourceNodeId: node.id, trigger, value})`
- Общие props: `label`, `required`, `readonly`, `visible`, `enabled`, `error`
- `visible === false` → return null

**TEXT_FIELD** — MUI `TextField`. Доп. props: `placeholder`, `maxLength`, `mask`. Server-event на `blur` (не на каждый keystroke).

**TEXT_AREA** — MUI `TextField` с `multiline`. Доп. props: `rows`.

**NUMBER_FIELD** — переиспользуем `NumberInput` из `src/shared/ui/inputs/`. Доп. props: `precision`, `min`, `max`, `positiveOnly`.

**DATE_FIELD** — MUI `DatePicker`. Значение в кэше: ISO date `"2026-04-30"`.

**DATETIME_FIELD** — MUI `DateTimePicker`. Значение в кэше: ISO datetime `"2026-04-30T07:22:00"`.

**CHECKBOX_FIELD** — MUI `Checkbox` + `FormControlLabel`. Значение: `boolean`. Server-event на `change`.

**ENUM_FIELD** — MUI `Select`. Props: `options: {value: string, label: string}[]`. Options могут обновляться патчем `setOptions`.

**REFERENCE_FIELD** — переиспользуем `AutocompleteInput` из `src/shared/ui/inputs/`. Props: `domain`, `targetTypeCode`, `selectionMode`, `allowCreate`, `filter`. Серверный поиск по существующим эндпоинтам `/api/{domain}/{typeCode}/entries`. Значение: `{id: number, presentation: string} | null`. При `setOptions` с `filter` — обновляем параметры запроса.

### 14.5. Composite (3 компонента)

**TABLE** — MUI таблица (или `DataGrid`). Binding обязателен — строки читаются из `cache[binding]` (массив объектов). Children — `TABLE_COLUMN`. Props: `label`, `allowAdd`, `allowDelete`, `allowReorder`. Адресация строк: `"<tableId>/row-<rowId>"`.

**TABLE_COLUMN** — декларация колонки для родительского `TABLE`. Props: `header`, `width`, `attributeCode`, `readonly`. Не рендерится самостоятельно — используется `TABLE` для построения колонок.

**OBJECT_FIELD** — placeholder на MVP. Props: `allowedTypes`. Рендерит заглушку с типами.

### 14.6. Action (3 компонента)

**BUTTON** — MUI `Button`. Props: `label`, `icon`, `variant` (`'primary'` | `'secondary'` | `'dropdown'` | `'icon'`), `command`, `enabled`. Click → `dispatch({type:'COMMAND', command: props.command, sourceNodeId: node.id})`. Variant `'dropdown'` → рендерит children (`MENU_ITEM`) через MUI `Menu`.

**MENU_ITEM** — MUI `MenuItem`. Props: `label`, `icon`, `command`. Click → `dispatch({type:'COMMAND', command: props.command, sourceNodeId: node.id})`.

**LINK** — `<RouterLink>` (внутренний) или `<a>` (`external`). Props: `text`, `route`, `external`. Если в `actions` есть `navigate` — click через dispatch (даёт бэку проверить права).

---

## 15. Затрагиваемые существующие файлы

| Файл | Изменение | Риск |
|---|---|---|
| `src/app/App.tsx` | Добавить `<Route path="/sdui/*" element={<SduiScreen />} />` внутри `Layout` | Минимальный — одна строка |
| `public/locales/ru/common.json` | Добавить ключи `sdui.conflict.staleRevision`, `sdui.conflict.sessionNotFound`, `sdui.unknownNode`, `sdui.loading` | Минимальный |
| `public/locales/kz/common.json` | То же для казахского | Минимальный |

**Не меняем:**
- `src/shared/ui/inputs/AutocompleteInput.tsx` — переиспользуем через import
- `src/shared/ui/inputs/NumberInput.tsx` — переиспользуем через import
- `src/shared/api/api.ts` — импортируем `http`
- `src/features/form-renderer/` — не трогаем, старый код живёт параллельно
- `src/pages/` — не трогаем
- `src/widgets/` — не трогаем
- Zustand-сторы (`useFormCacheStore`, `useTableFilterStore` и т.д.) — не трогаем

---

## 16. Новые файлы (полный список)

```
src/features/sdui/
├── index.ts
├── api/
│   └── view-transport.ts
├── lib/
│   ├── stores/
│   │   ├── tree-store.ts
│   │   └── view-state-store.ts
│   ├── patch-applier.ts
│   ├── effect-handler.ts
│   ├── conflict-handler.ts
│   ├── session-cleanup.ts
│   ├── dispatch.ts
│   └── component-registry.ts
├── ui/
│   ├── sdui-screen.tsx
│   ├── node-renderer.tsx
│   ├── unknown-node.tsx
│   └── nodes/
│       ├── shell/
│       │   ├── app-shell-node.tsx
│       │   ├── top-bar-node.tsx
│       │   ├── sidebar-node.tsx
│       │   └── workspace-node.tsx
│       ├── layout/
│       │   ├── page-node.tsx
│       │   ├── vstack-node.tsx
│       │   ├── hstack-node.tsx
│       │   ├── grid-node.tsx
│       │   ├── group-node.tsx
│       │   ├── tabs-node.tsx
│       │   ├── tab-node.tsx
│       │   ├── toolbar-node.tsx
│       │   ├── separator-node.tsx
│       │   └── spacer-node.tsx
│       ├── display/
│       │   ├── label-node.tsx
│       │   ├── text-node.tsx
│       │   ├── badge-node.tsx
│       │   └── icon-node.tsx
│       ├── fields/
│       │   ├── text-field-node.tsx
│       │   ├── text-area-node.tsx
│       │   ├── number-field-node.tsx
│       │   ├── date-field-node.tsx
│       │   ├── datetime-field-node.tsx
│       │   ├── checkbox-field-node.tsx
│       │   ├── enum-field-node.tsx
│       │   └── reference-field-node.tsx
│       ├── composite/
│       │   ├── table-node.tsx
│       │   ├── table-column-node.tsx
│       │   └── object-field-node.tsx
│       └── action/
│           ├── button-node.tsx
│           ├── menu-item-node.tsx
│           └── link-node.tsx
└── types/
    ├── view.ts
    └── node-types.ts
```

**Итого: ~45 новых файлов.**

---

## 17. Порядок реализации (послойный)

| Шаг | Что | Файлы | Критерий готовности |
|---|---|---|---|
| 1 | Типы | `types/view.ts`, `types/node-types.ts` | Компилируется без ошибок |
| 2 | Сторы | `stores/tree-store.ts`, `stores/view-state-store.ts` | Стор создаётся, get/set работают |
| 3 | PatchApplier | `patch-applier.ts` | Мок-патч `setProp` / `setValue` корректно применяется |
| 4 | ComponentRegistry + NodeRenderer | `component-registry.ts`, `node-renderer.tsx`, `unknown-node.tsx` | Мок-дерево рендерится (заглушки) |
| 5 | Все 31 компонент | `nodes/**/*.tsx` | Каждый тип рендерится корректно |
| 6 | EffectHandler | `effect-handler.ts` | 5 типов эффектов работают |
| 7 | ConflictHandler | `conflict-handler.ts` | 409 обрабатываются |
| 8 | Dispatch | `dispatch.ts` | OPEN/EVENT/COMMAND/CLOSE формируют правильные запросы |
| 9 | ViewTransport | `view-transport.ts` | POST /api/view + sendBeacon |
| 10 | SduiScreen + session cleanup | `sdui-screen.tsx` | OPEN на mount, CLOSE на unmount, sendBeacon |
| 11 | Роутинг + i18n | `App.tsx`, `common.json` | `/sdui/*` маршрут работает |
| 12 | Barrel export | `index.ts` | Чистый публичный API |
| 13 | Проверка на реальном бэке | — | ЗаявкаГПСделки работает end-to-end |
