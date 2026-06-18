# SDUI: спека фронт-работ (fin-web) — Server-driven ссылочное поле, Phase 2 (Добавить / Проваливание)

Документ для фронт-команды (`fin-web`). Продолжение [Phase 1](frontend-spec-server-driven-reference-field.md). Архитектура — [ADR-0009](../adr/ADR-0009-sdui-server-driven-reference-field.md) §2.4–2.5.

Phase 1 серверизовал дропдаун-опции, «Показать все» и список-сайдбар (drawer + узел `LIST` + выбор). **Phase 2** серверизует оставшееся: кнопку **«Добавить»** (форма создания записи справочника прямо в drawer'е, с «Записать и выбрать») и **«проваливание»** (открыть карточку выбранной записи). Это требует от фронта новой инфраструктуры — **стека панелей с собственной SDUI-сессией на каждую** и кросс-сессионного реле выбора.

> **Честная оценка объёма (важно).** Phase 1 был «почти тупой рендерер» (узел + drawer). Phase 2 — НЕ тупой: фронт получает **оркестрацию нескольких одновременных SDUI-сессий на клиенте** (стек панелей, адресация действий в нужную сессию, реле выбора в родителя). По сложности это сопоставимо или больше, чем ретайримый `dict-sidebar`. Цель Phase 2 — не «нулевая логика на фронте», а «бэк владеет содержимым форм (поля/кнопки/сохранение/привязка к контексту)», тогда как фронт владеет **транспортом и композицией панелей**. Заложите на это время соответственно.

---

## Контракт Phase 2 (что добавляет бэк)

1. **`REFERENCE_FIELD` actions пополняются** (Phase 1 слал только `showAll`):
   ```jsonc
   "actions": [
     { "trigger": "change",  "actionId": "fieldEvent" },
     { "trigger": "showAll", "actionId": "command", "command": "ref.showAll:field.dogovorKontragenta" },
     { "trigger": "create",  "actionId": "command", "command": "ref.create:field.dogovorKontragenta" },  // НОВОЕ
     { "trigger": "open",    "actionId": "command", "command": "ref.open:field.dogovorKontragenta" }      // НОВОЕ
   ]
   ```
   Видимость: `props.allowCreate` (Добавить), `props.allowOpen` (проваливание).

2. **`openDialog`-эффект для панели с собственной сессией** теперь несёт транспорт дочерней сессии:
   ```jsonc
   {
     "type": "openDialog",
     "node": { "id": "panel.create.field.dogovorKontragenta", "type": "PAGE",
               "props": { "presentation": "drawer", "placement": "right", "width": 900, "kind": "OBJECT_FORM" },
               "children": [ /* поля формы справочника + TOOLBAR с «Записать и выбрать» */ ] },
     "sessionId": "<childFormSessionId>",   // НОВОЕ — у панели своя SDUI-сессия
     "revision": 0,                          // НОВОЕ
     "state": { /* начальные значения полей дочерней формы (binding→value) */ }  // НОВОЕ
   }
   ```
   Для `ref.showAll` (список выбора из Phase 1) `sessionId`/`revision`/`state` **отсутствуют** — у списка своей сессии нет (он pull-грид). Различай: панель с `sessionId` = форма со своей сессией; без — read-only список.

3. **Новый эффект возврата выбора `applyToParent`** (приходит в ответе на дочерний save):
   ```jsonc
   {
     "type": "applyToParent",            // НОВЫЙ EffectType (или поля внутри closeDialog — см. примечание)
     "parentSessionId": "<родительская сессия>",
     "targetNodeId": "field.dogovorKontragenta",
     "value": { "id": 88, "presentation": "Договор №12 от 01.01.2026" }
   }
   ```
   > Точную форму (отдельный `EffectType.applyToParent` vs поля внутри `closeDialog`) бэк зафиксирует в реализации — **сверьтесь с фактическим ответом**; обрабатывайте по типу/наличию полей.

4. **Глубина вложенности ограничена бэком** (`MAX_NESTED_SESSION_DEPTH=3`). При превышении бэк вернёт `notify(warning)` вместо `openDialog` — отдельной обработки на фронте не нужно, просто не придёт новая панель.

---

## Задача 1 — `ReferenceFieldNode`: кнопки «Добавить» и «проваливание» → серверные команды

**Файл:** `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`

В Phase 1 «Добавить»/проваливание остались на legacy-`dict-sidebar`. Теперь — на сервер, по аналогии с `ref.showAll`:

```ts
const createAction = node.actions?.find((a) => a.trigger === 'create' && a.actionId === 'command')
const openAction   = node.actions?.find((a) => a.trigger === 'open'   && a.actionId === 'command')

// «Добавить»
const onAdd = createAction
  ? () => void dispatch({ type: 'COMMAND', command: createAction.command, sourceNodeId: node.id })
  : (canBrowse ? openDictCreate /* legacy */ : undefined)

// «Проваливание» (endAction-иконка) — при заполненном поле
endAction={
  selectedOption && openAction ? (
    <IconButton onMouseDown={(e) => { e.preventDefault()
      void dispatch({ type: 'COMMAND', command: openAction.command, sourceNodeId: node.id })
    }}>…</IconButton>
  ) : (selectedOption && canBrowse ? /* legacy endAction */ : undefined)
}
```
Команда `dispatch` адресуется в сессию ТЕКУЩЕЙ формы (поле живёт в её панели) — см. Задача 2 про адресацию. После `ref.create`/`ref.open` бэк ответит `openDialog`-эффектом с дочерней панелью.

---

## Задача 2 — `PanelHost` со стеком панелей и сессией-на-панель (ядро Phase 2)

Это главная новая инфраструктура. Сейчас (Phase 1) `DialogHost`/`PanelHost` рендерит стек `openDialog`-узлов, но **все используют глобальные SDUI-сторы** (`tree-store`, `view-state-store` — синглтоны). Для формы создания/карточки справочника так нельзя: у дочерней панели **своё дерево, своё состояние, своя сессия/revision**, независимые от родителя.

### 2.1 Модель панели
Расширьте стек панелей до записей с собственным контекстом:
```ts
interface PanelEntry {
  panelId: string            // node.id корня панели
  presentation: 'drawer' | 'modal'
  node: ViewNode             // поддерево панели (исходное дерево)
  // ── для панелей со своей сессией (ref.create/ref.open): ──
  session?: {
    formSessionId: string
    revision: number
    parentSessionId?: string // чья это дочерняя панель (для applyToParent)
    targetNodeId?: string    // поле родителя, куда вернуть выбор
  }
  // локальное состояние панели (зеркало серверной дочерней сессии):
  tree: ViewNode             // мутируемое патчами дерево ЭТОЙ панели
  viewState: Record<string, unknown>  // значения по binding ЭТОЙ панели
}
```
- Панель из `ref.showAll` (список) — без `session` (pull-грид, состояние тривиально).
- Панель из `ref.create`/`ref.open` — с `session` (из полей `openDialog.sessionId/revision/state`), `tree=node`, `viewState=state`.

### 2.2 Изоляция SDUI-сторов по панели
`tree-store`/`view-state-store` нужно сделать **инстансируемыми**, а не глобальными синглтонами, ИЛИ держать состояние панелей внутри `PanelHost` и прокидывать его в `NodeRenderer` дочерней панели через контекст. Рекомендация: **React Context `SduiSessionContext`**, который несёт `{ formSessionId, revision, getValue, setValue, applyPatches, dispatch }` текущей панели. `NodeRenderer` и узлы-поля внутри панели читают сессию из контекста, а не из глобального стора.
- Корневой экран (родительская форма) — провайдер с глобальной/корневой сессией (как сейчас).
- Каждая панель-форма в `PanelHost` — свой провайдер со своей сессией и своим `viewState`.
- Узлы (`reference-field-node`, `text-field-node`, …) переходят с прямого `useViewState`/`useViewStateSetter` на чтение из `SduiSessionContext` (значение по binding в рамках своей сессии).

> Это рефактор runtime: сейчас поля жёстко завязаны на глобальный `view-state-store`. Без изоляции дочерняя форма будет читать/писать состояние родителя — поля перемешаются. Это обязательная часть Phase 2.

### 2.3 Адресация действий (dispatch per session)
`dispatch` должен слать `formSessionId`+`revision` ТОЙ панели, из которой пришло действие:
```ts
// было (Phase 1): берёт из глобального tree-store
const { formSessionId, revision } = useTreeStore.getState()
// стало: берёт из текущего SduiSessionContext (панель-источник)
const { formSessionId, revision } = useSduiSession()
```
Действия из узлов корневой формы → корневая сессия; из узлов дочерней панели → дочерняя сессия. Ответные патчи применяются к `tree`/`viewState` ИМЕННО этой панели.

### 2.4 Скоупинг входящих патчей по панели (важно — иначе коллизии)
Ответ на запрос конкретной сессии применяйте к дереву/состоянию ИМЕННО её панели, не глобально. Узлы родителя и дочерней формы могут иметь **совпадающие `nodeId`** (форма справочника и форма документа делят коды атрибутов через единый резолвер на бэке). `PatchApplier`, вызванный для ответа дочерней сессии, обязан работать над `panel.tree`, а не над корневым деревом. Привяжите применение патчей к сессии-источнику запроса.

### 2.5 Рендер
- Панель-форма (`presentation:'drawer'`, есть `session`) — правый MUI Drawer (стиль Phase 1, 900px), внутри `SduiSessionContext.Provider` с сессией панели → `NodeRenderer node={panel.tree}`. Поля и `TOOLBAR` («Записать и выбрать») рендерятся штатными узлами.
- Стек: несколько drawer'ов друг поверх друга (поле → «Показать все» → «Добавить»). Header каждого — Back (pop) / Close. Глубину бэк ограничит (≤3).

---

## Задача 3 — UX-гейт: родитель заблокирован, пока открыта дочерняя панель-форма

Пока в стеке есть **панель-форма со своей сессией** (create/open), родительская форма (и нижние панели) должны быть **неинтерактивны**: оверлей/`pointer-events:none` на нижних слоях, фокус — в верхней панели. Это гасит гонки (ADR-0009 §2.4.4, атака 1а/1в challenger): пользователь не может изменить зависимость родителя, пока создаёт запись справочника, поэтому возвращённый выбор не будет «затёрт» реакцией родителя. MUI `Drawer` с `backdrop` уже частично это даёт (модальный backdrop) — убедитесь, что нижние панели/форма под backdrop'ом не принимают ввод.

(Для read-only списка из Phase 1 — `ref.showAll` — строгий гейт не обязателен, но单 единообразный модальный drawer проще.)

---

## Задача 4 — «Записать и выбрать» и реле `applyToParent`

### 4.1 «Записать и выбрать»
В дочерней панели-форме бэк кладёт `TOOLBAR > BUTTON` с `props.command="save"` и обычным click→command action. Нажатие → `dispatch({type:'COMMAND', command:'save'})` **в сессию дочерней панели** (Задача 2.3). Ничего特special — обычная команда; бэк сам создаст запись справочника.

### 4.2 Реле выбора в родителя
В ответе на дочерний save бэк вернёт `effects`:
```
[ closeDialog(panelId), applyToParent{ parentSessionId, targetNodeId, value } ]
```
Обработка `applyToParent` в `effect-handler`:
1. Закрыть дочернюю панель (pop из стека) — снять её сессию/состояние.
2. **Сдиспатчить в РОДИТЕЛЬСКУЮ сессию** выбор: `dispatch_to(parentSessionId)({ type:'COMMAND', command: 'ref.select:'+targetNodeId, value })`.
   - **Критично (атака 1а):** реле берёт **АКТУАЛЬНЫЙ** `revision` родительской панели на момент диспатча (из `PanelEntry.session.revision` родителя), НЕ тот, что был при открытии дочерней. Иначе `STALE_REVISION` 409.
   - Родитель обработает `ref.select` ровно как выбор из списка (Phase 1 §2.3): `setValue` поля + пересчёт зависимостей.
3. Если родительская сессия отвечает `409 SESSION_NOT_FOUND` (родитель эвиктнут/рестарт пода) — `notify('warning', 'Форма устарела, выбор не применён')`. Запись справочника при этом уже создана (не теряется) — ADR-0009 D3.

`effect-handler` (`src/features/sdui/lib/effect-handler.ts`) дополняется case `applyToParent`. Для этого `effect-handler`/`dispatch` должны уметь адресовать сессию по `formSessionId` (а не только «текущую») — см. Задача 2.3.

---

## Задача 5 — типы и реестр

- `src/features/sdui/types/view.ts` / `node-types.ts`: `ViewEffect` += `sessionId?`, `revision?`, `state?`; новый `EffectType` `applyToParent` (или поля в существующем — по факту бэка) с `parentSessionId/targetNodeId/value`.
- `dispatch`: поддержать адресный вызов в конкретную сессию (по `formSessionId`+`revision`), не только глобальную.

---

## Чего НЕ делаем / последовательность

- **Сначала Задача 2** (PanelHost + сессия-на-панель + изоляция сторов) — без неё ни create, ни open не работают корректно. Это фундамент.
- Затем Задача 1 (кнопки), 3 (гейт), 4 (save+реле).
- `dict-sidebar` ретайрить можно только когда ВСЕ ссылочные аффордансы (showAll+create+open) мигрированы и проверены на эталоне (заявка ГП). До этого — поле-за-полем, переключение по наличию `ref.create`/`ref.open` actions.
- Глубину/память бэк стережёт; рекурсию create→create (форма справочника со своими ссылочными полями) бэк обрывает на depth=3.

---

## Сводка

| Задача | Файл(ы) | Объём | Зависимость от бэка |
|---|---|---|---|
| 1 Кнопки Добавить/проваливание → команды | `reference-field-node.tsx` | ~15 строк | actions `ref.create`/`ref.open` + allowCreate/allowOpen |
| 2 **PanelHost + сессия-на-панель + изоляция сторов** | `dialog-host.tsx`→`panel-host.tsx`, новый `SduiSessionContext`, `tree-store`/`view-state-store`, узлы-поля, `dispatch`, `patch-applier` | **крупный рефактор runtime** | `openDialog` несёт sessionId/revision/state |
| 3 UX-гейт родителя | `panel-host.tsx` | ~20 строк | — |
| 4 «Записать и выбрать» + реле applyToParent | `effect-handler.ts`, `dispatch.ts` | ~40 строк | эффект `applyToParent`, дочерний save создаёт запись |
| 5 Типы/реестр | `types/view.ts`, `node-types.ts` | ~15 строк | новые поля эффекта |

**Acceptance Phase 2** (эталон — `dogovorKontragenta` заявки ГП): «Добавить» открывает в drawer'е серверную форму создания договора с предзаполненным контекстом (контрагент/организация); «Записать и выбрать» создаёт запись и подставляет её в поле родителя с пересчётом зависимостей; «проваливание» открывает карточку выбранного договора. Родитель заблокирован, пока открыт дочерний drawer. Глубина вложенности ограничена.

**Открытые вопросы к бэку:**
1. Точная форма `applyToParent` (отдельный EffectType vs поля в closeDialog).
2. Изоляция сторов — Context vs инстансируемые zustand-сторы (фронт решает сам, бэк не зависит).
3. Нужен ли отдельный CLOSE дочерней сессии при отмене (крестик/Back на панели-форме) — вероятно да (`dispatch CLOSE` в дочернюю сессию на pop), подтвердить.
