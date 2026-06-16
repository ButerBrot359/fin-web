# SDUI: DialogHost + Dirty Tracking

Две фронт-фичи для SDUI-форм: рендер диалогов (Дт/Кт) и отслеживание модификации формы (звёздочка + «Сохранить изменения?» при закрытии вкладки).

Исходная спека: `docs/superpowers/plans/frontend-spec-zayavka-gp-features.md`.

---

## Фича 1 — DialogHost (рендер диалогов)

### Контекст

Эффекты `openDialog`/`closeDialog` уже обрабатываются в `dispatch.ts:60-69` — кладутся в модульный `dialogStack`. Есть `getDialogStack()` и `subscribeDialogs()`. Но стек **нигде не рендерится** — визуально диалоги не появляются.

### Решение

Новый компонент `src/features/sdui/ui/dialog-host.tsx`:
- Подписывается на `dialogStack` через `useSyncExternalStore(subscribeDialogs, getDialogStack)`
- Рендерит каждый элемент стека как MUI `<Dialog>` с `<NodeRenderer node={eff.node} />`
- `onClose` крестика вызывает новый `popDialog()` из `dispatch.ts`
- Заголовок из `eff.node.props.title`

**Монтаж:** Один раз рядом с `<NodeRenderer>` в `SduiScreen`, но вне основного дерева. Живёт независимо от перерисовки дерева формы.

### Изменения в dispatch.ts

Добавить экспорт `popDialog()` — убирает верхний диалог из стека. Нужен для ручного закрытия (крестик MUI Dialog). Существующий `closeDialog(id)` остаётся для серверного эффекта.

```ts
export function popDialog(): void {
  dialogStack = dialogStack.slice(0, -1)
  notifyDialogListeners()
}
```

### Затрагиваемые файлы

| Файл | Действие |
|---|---|
| `src/features/sdui/ui/dialog-host.tsx` | Новый, ~30 строк |
| `src/features/sdui/lib/dispatch.ts` | Добавить `popDialog()` |
| `src/features/sdui/ui/sdui-screen.tsx` | Смонтировать `<DialogHost />` |

---

## Фича 2 — Dirty Tracking

### Контекст

Для старых форм звёздочка и диалог «Сохранить изменения?» уже работают:
- `workspace-tab-item.tsx:25` — `isDirty ? title + " *" : title`
- `workspace-tab-bar.tsx:54-65` — `handleClose` проверяет dirty, показывает `UnsavedChangesDialog`
- `use-form-cache-store.ts` — `setDirty(tabId, isDirty)`

SDUI **не сообщает dirty** в `useFormCacheStore`. `view-state-store.ts` не отслеживает изменения. `isDirty` всегда `false`.

### Решение

#### 2.1. Dirty в view-state-store

Два метода вместо одного `set()`:
- `set(binding, value)` — вызывается полевыми узлами по пользовательскому вводу. Ставит `dirty = true`.
- `setFromServer(binding, value)` — вызывается из `applyValuePatches`. Не ставит dirty.

Также:
- `dirty: boolean` в стейте стора
- `resetDirty()` — сброс в `false`

```ts
interface ViewStateStoreState {
  state: Record<string, unknown>
  dirty: boolean
  get: (binding: string) => unknown
  set: (binding: string, value: unknown) => void          // dirty = true
  setFromServer: (binding: string, value: unknown) => void // dirty не трогает
  merge: (patch: Record<string, unknown>) => void          // серверный, dirty не трогает
  replaceAll: (s: Record<string, unknown>) => void         // серверный, dirty = false
  getAll: () => Record<string, unknown>
  resetDirty: () => void
}
```

#### 2.2. Переключить applyValuePatches на setFromServer

В `dispatch.ts` все вызовы `applyValuePatches(patches, useViewStateStore.getState().set)` заменить на `applyValuePatches(patches, useViewStateStore.getState().setFromServer)`. Серверные патчи не должны помечать форму грязной.

#### 2.3. Синхронизация dirty → useFormCacheStore

В `sdui-screen.tsx` добавить подписку на dirty из `useViewStateStore`:

```ts
const dirty = useViewStateStore((s) => s.dirty)
const route = location.pathname

useEffect(() => {
  useFormCacheStore.getState().setDirty(route, dirty)
}, [route, dirty])
```

После этого звёздочка во вкладке заработает автоматически — `workspace-tab-item` уже читает `useFormCacheStore`.

#### 2.4. Сброс dirty после save/post

В `dispatch.ts`, ветка `COMMAND`: после успешного ответа вызвать `useViewStateStore.getState().resetDirty()` только для save-related команд. Проверяем `action.command`: `save`, `saveAndClose`, `post`, `postAndClose` — сбрасываем dirty. Остальные команды (`showDtKt`, `print:*`, `unpost`) — dirty не трогаем.

```ts
const saveCommands = ['save', 'saveAndClose', 'post', 'postAndClose']
if (action.type === 'COMMAND' && saveCommands.includes(action.command ?? '')) {
  useViewStateStore.getState().resetDirty()
}
```

#### 2.5. SDUI-ветка в handleDialogSave

В `workspace-tab-bar.tsx`, `handleDialogSave`: определить, является ли вкладка SDUI-вкладкой, по наличию записи в `useSduiCacheStore` для данного tabId (route).

- **SDUI-вкладка:** вместо `setPendingAction('save-and-close')` — нужно активировать вкладку (если не активна), дождаться монтирования `SduiScreen`, и выполнить SDUI `COMMAND saveAndClose`. Реализация: ставим `pendingAction = 'save-and-close'` как и для старых форм, а **потребление** этого action делаем в `SduiScreen` — по аналогии с тем, как старые формы consumeят его.
- **Старая форма:** текущая логика без изменений.

В `sdui-screen.tsx` добавить `useEffect`, который проверяет `consumePendingAction(route)`. Если `'save-and-close'` — делает `dispatch({ type: 'COMMAND', command: 'saveAndClose' })` и затем закрывает вкладку.

### Затрагиваемые файлы

| Файл | Действие |
|---|---|
| `src/features/sdui/lib/stores/view-state-store.ts` | Добавить `dirty`, `setFromServer`, `resetDirty` |
| `src/features/sdui/lib/dispatch.ts` | Заменить `set` на `setFromServer` в патчах, сброс dirty после COMMAND |
| `src/features/sdui/ui/sdui-screen.tsx` | Sync dirty → formCacheStore, consume pendingAction |
| `src/widgets/workspace-tab-bar/ui/workspace-tab-bar.tsx` | Без изменений — `handleDialogSave` уже ставит pendingAction, потребление в SduiScreen |

---

## Порядок реализации

1. `dispatch.ts` — добавить `popDialog()`
2. `dialog-host.tsx` — новый компонент
3. `sdui-screen.tsx` — смонтировать `<DialogHost />`
4. `view-state-store.ts` — `dirty`, `setFromServer`, `resetDirty`
5. `dispatch.ts` — переключить `applyValuePatches` на `setFromServer`, сброс dirty после COMMAND
6. `sdui-screen.tsx` — sync dirty, consume pendingAction для save-and-close

---

## Что НЕ меняется

- `workspace-tab-item.tsx` — уже показывает звёздочку
- `UnsavedChangesDialog` — уже работает
- `use-form-cache-store.ts` — API `setDirty`/`consumePendingAction` готов
- `effect-handler.ts` — уже делегирует openDialog/closeDialog в dispatch
- Полевые узлы (text-field-node, number-field-node и т.д.) — они зовут `set()`, который теперь будет ставить dirty
