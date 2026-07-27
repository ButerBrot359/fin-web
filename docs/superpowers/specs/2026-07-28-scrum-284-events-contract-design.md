# SCRUM-284 — контракт событий: фронт вызывает команды вслепую (Δ1–4)

**Тикет:** [SCRUM-284 «Контракт событий (Events)»](https://sulubaiguskarova.atlassian.net/browse/SCRUM-284)
**Дата дизайна:** 2026-07-28
**Источники правды:** `specs-local/scrum-284-events-contract/SCRUM-284-spec-v1-2026-07-24-front.md` (фронт-предложение) + `SCRUM-284-back-response.md` (бэк согласовал, готово в `sdui-1.5`).

## Оценка бэк/фронт

**Фронт-таска** (SDUI). Бэк-часть готова в `sdui-1.5` (Δ3/Δ4 реализованы, Δ1–2 = удаление на фронте, 4 вопроса отвечены). Инвариант: `command` — непрозрачный токен; фронт его не строит и не парсит, все решения приходят явными полями, рантайм-параметры едут в `value`. Фронт снимает 3 конструкции имён + декод `ref.*`.

## ⚠️ Связь с SCRUM-285 (важно)

SCRUM-285 (A3) читал `requiresSelectedRow`/`selectionKey` из `node.props`. В ответе на 284 бэк **перенёс** эти поля с `props` на `ViewNodeAction` и **переименовал** `selectionKey`→`selectionField`. Поэтому:
- **284 Δ4 доводит 285 до финального контракта** (чтение с `action`, новое имя `selectionField`). Удаление парсеров `needsSelectedRow`/`refCommandField` (сделано в 285) остаётся; меняется источник полей.
- **Deploy-order:** если `sdui-1.5` выкатится раньше 284-фронта, 285-код (читает `props`) получит `undefined` → блокировка кнопок пикера временно отвалится. Помечаем бэку: 284-фронт катить с/до `sdui-1.5`, либо бэку держать `props` в переходный период. Дизайн не блокирует.

## Дельты (только `features/sdui`)

### Δ3 — `lib/relay-selection.ts`: готовая команда вместо `ref.select:...`
Сейчас (стр. 39, 48-52) строит `command: `ref.select:${effect.applyToParentTargetNodeId}`` и гардит по `applyToParentTargetNodeId`.
Станет:
```ts
if (!effect.applyToParentSessionId || !effect.applyToParentCommand || !effect.applyToParentValue) return
// ...
const action = {
  type: 'COMMAND' as const,
  command: effect.applyToParentCommand,   // непрозрачная команда от бэка
  value: effect.applyToParentValue,
}
```
`applyToParentTargetNodeId` фронт больше не читает (бэк оставляет поле для back-compat).
Тип `ViewEffect` (`types/view.ts`) += `applyToParentCommand?: string`.

### Δ4 — `button-node.tsx` / `list-node.tsx`: поля с action вместо props
Контракт бэка (с `ViewNodeAction`):
- select/copy-кнопки: `{ trigger:'click', command, behavior, requiresSelectedRow: true, selectionField: '<field>' }`
- LIST select/activate: `{ trigger:'select'|'activate', command, behavior, requiresSelectedRow: null, selectionField: '<field>' }`
- «Создать»: `{ trigger:'click', …, requiresSelectedRow: null, selectionField: null }`
- Инвариант связки (гарантия бэка): `selectionField` совпадает у парных кнопки и списка.

**`button-node.tsx`** — сейчас (стр. 37-38) читает `node.props?.requiresSelectedRow` / `node.props?.selectionKey`. Станет: захватить click-действие один раз и читать оттуда:
```ts
const clickAction = node.actions?.find((a) => a.trigger === 'click')
const behavior = (node.props?.behavior as ActionBehavior | undefined) ?? clickAction?.behavior ?? null
const requiresSelectedRow = clickAction?.requiresSelectedRow === true
const selectionField = clickAction?.selectionField ?? undefined
const selectedRowId = useRefPickerSelection(requiresSelectedRow ? (selectionField ?? null) : null)
```
`disabled` и клик-ветка — как в 285, но по `requiresSelectedRow`/`selectionField` с action.

**`list-node.tsx`** — сейчас (стр. 122) `selectField = node.props?.selectionKey`. Станет:
```ts
const selectField = selectAction?.selectionField  // selectAction уже есть (стр. 50)
```
Механика `setSelection`/`clearSelection`/гард — без изменений.

Тип `ViewNodeAction` (`types/view.ts:24`) += `requiresSelectedRow?: boolean | null`, `selectionField?: string | null`.

### Δ1–2 — `table-node.tsx` (ReadOnlyTable): убрать мёртвые add/delete
Сейчас `ReadOnlyTable` строит `addRow:${node.binding}` (стр.183) и `deleteRow:${node.binding}:${rowId}` (стр.189). Бэк подтвердил: dead code (read-only не несёт `allow*` → кнопки «+»/«удалить» не рендерятся; бэк команды `addRow:`/`deleteRow:` не обрабатывает).
**Решение (владелец): убрать мёртвые кнопки целиком** — удалить onClick-хендлеры add/delete, их JSX-кнопки и упоминания `allowAdd`/`allowDelete` в `ReadOnlyTable` (включая упрощение `colSpan`, где `allowDelete ? 1 : 0` → `0`). ReadOnlyTable остаётся чисто отображающей.
Редактируемые ТЧ (`EditableTable`/`ComplexEditableTable`/`useTableSync` full-snapshot) — **НЕ трогаем** (уже соответствуют инварианту: change-EVENT с `sourceNodeId`, без имени).

## Границы (не трогаем)

- Editable-таблицы (`useTableSync`, full-snapshot EVENT) — вне SCRUM-284.
- `ActionBehavior` (283), транспорт `viewTransport`, диспетчер `useSduiDispatch` — без изменений формы запроса.
- Прочие непрозрачные `command` — уже соответствуют.

## Тесты (Vitest)

- **Δ3:** `relay-selection` — при `closeDialog`-эффекте с `applyToParentCommand` транспорт зовётся с этой командой дословно + `value = applyToParentValue`; при отсутствии `applyToParentCommand` — no-op (обновить существующие тесты relay, если есть).
- **Δ4 button-node:** `requiresSelectedRow:true` на click-action → disabled без выбора, активна после `setSelection(selectionField, id)` (реальный стор); действие с `requiresSelectedRow:null` — активна; проверить, что читается с action, а не props (обновить/заменить 285-тест `button-node-requires-row.test.tsx`).
- **Δ4 list-node:** публикация выбора под `selectAction.selectionField` (если тест есть; иначе покрыто регрессом + e2e).
- **Δ1–2:** `table-node` — рендер `ReadOnlyTable` без кнопок add/delete; grep-критерий на отсутствие `addRow:`/`deleteRow:`.
- Регресс: полный `src/features/sdui`.

## Критерии приёмки

1. `grep -rn "addRow:\|deleteRow:\|ref.select:" src/features/sdui` → пусто (ни одной конструкции имени команды); `relay-selection` не строит `ref.select:`.
2. `button-node`/`list-node` читают `requiresSelectedRow`/`selectionField` из `action`, не из `props`; `node.props?.selectionKey`/`node.props?.requiresSelectedRow` в SDUI не осталось.
3. Реф-пикер: «Выбрать»/«Скопировать» disabled без выбора строки, активны после выбора; «Записать и выбрать» дочернего справочника релеит выбор в родителя (Δ3).
4. ReadOnlyTable рендерится без кнопок add/delete; редактируемые ТЧ (add/delete/reorder + save) — регресса нет.
5. sdui-тесты зелёные; типы `ViewNodeAction`/`ViewEffect` расширены.

## Deploy-зависимость / вопрос бэку

Бэк готов (`sdui-1.5`). Порядок деплоя: 284-фронт с/до `sdui-1.5` (иначе окно, где 285-props-чтение отвалилось). Поле `applyToParentTargetNodeId` бэк оставляет для back-compat — фронт перестаёт читать; отдельная уборка на бэке позже (опционально).
