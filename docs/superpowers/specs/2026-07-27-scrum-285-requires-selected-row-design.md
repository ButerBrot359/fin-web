# SCRUM-285 — управление активностью кнопок пикера из props (A3)

**Тикет:** [SCRUM-285 «Управление состоянием элементов интерфейса»](https://sulubaiguskarova.atlassian.net/browse/SCRUM-285)
**Дата дизайна:** 2026-07-27
**Источник правды:** бэкенд-хендовер `specs-local/scrum-285-upravlenie-sostoyaniem/frontend-spec-requires-selected-row.md` (A3 из `docs/superpowers/specs/2026-07-02-sdui-backend-handoff.md`). Бэк-часть уже реализована в webbuh (аддитивно).

## Проблема

Фронт сам определяет, что кнопке пикера «Выбрать»/«Скопировать» нужна выбранная строка, **парся имя команды** `ref.<verb>:<field>` в двух хелперах:
- `needsSelectedRow(command)` — префикс `ref.select:`/`ref.copy:` → нужна ли строка;
- `refCommandField(command)` — суффикс после `:` → общий ключ выбора (LIST пишет, кнопка читает).

Это знание структуры команды, которым фронт владеть не должен. Цель A3 — фронт лишь отображает состояние, присланное бэком.

## Что присылает бэк (контракт, уже в webbuh)

Два новых prop'а в `props` узла (рядом с `enabled`/`selectionMode`, НЕ внутри `action`):

| Prop | Узлы | Значение |
|---|---|---|
| `requiresSelectedRow: true` | кнопки «Выбрать», «Скопировать» | активна только при выбранной строке |
| `selectionKey: "<field>"` | кнопки «Выбрать»/«Скопировать» **и** LIST | общий ключ группы выбора (тот же, что раньше доставался из команды) |

Кнопка «Создать» — намеренно без этих props (создание не требует выбора). Гарантия бэка: `selectionKey` на кнопках select/copy и на LIST посимвольно идентичен.

## Изменения на фронте (только `features/sdui`)

### 1. `ui/nodes/action/button-node.tsx`
Заменить чтение из команды на props:
```ts
const requiresSelectedRow = node.props?.requiresSelectedRow === true
const selectionKey = node.props?.selectionKey as string | undefined
const selectedRowId = useRefPickerSelection(requiresSelectedRow ? (selectionKey ?? null) : null)
```
- `disabled = !enabled || (requiresSelectedRow && selectedRowId == null)`.
- В обработчике клика ветку `if (usesSelectedRow)` заменить на `if (requiresSelectedRow)`; dispatch `value: { id: selectedRowId }` и `command` из `props.command` — без изменений.
- Удалить импорты `needsSelectedRow`, `refCommandField`.

### 2. `ui/nodes/composite/list-node.tsx`
```ts
// было (:124)
const selectField = refCommandField(selectAction?.command)
// стало
const selectField = node.props?.selectionKey as string | undefined
```
Дальше без изменений: `setSelection(selectField, rowId)` / `clearSelection(selectField)`, гард `if (!selectField) return` остаётся. Удалить импорт `refCommandField`.

### 3. `lib/stores/ref-picker-selection-store.ts`
Удалить `refCommandField` и `needsSelectedRow` целиком (других потребителей нет — только button-node и list-node, оба переведены). `setSelection` / `clearSelection` / `useRefPickerSelection` / `useRefPickerSelectionStore` — оставить.

### 4. Тесты
- `button-node.test.tsx`, `button-node-overflow.test.tsx`: моки `needsSelectedRow`/`refCommandField` больше не нужны — убрать; кейсы «нужна строка» строить через props `requiresSelectedRow`/`selectionKey`.
- `list-node` / `ref-picker-selection` тесты (если есть): источник ключа — `selectionKey` из props.

## Подход и совместимость

**Approach A (принят):** парсеры удаляются полностью, состояние читается только из props — прямая цель таски. Fallback на парсинг команды НЕ делаем (противоречит критерию приёмки №1).

**Deploy-зависимость:** если на стенде старый бэк без `requiresSelectedRow`/`selectionKey`, кнопки пикера потеряют блокировку (станут всегда активны), LIST не запишет выбор. Для e2e нужен задеплоенный webbuh с A3-частью. Транзиторного fallback нет — по спеке.

## Критерии приёмки

1. `grep -rn "needsSelectedRow\|refCommandField\|startsWith('ref.select\|startsWith('ref.copy" src/features/sdui` → пусто.
2. Кнопки «Выбрать»/«Скопировать» в drawer: неактивны без выбранной строки, активны после клика по строке — по `requiresSelectedRow` + `selectionKey`, без разбора команды.
3. Кнопка «Создать» активна всегда (нет `requiresSelectedRow`).
4. Выбор строки в LIST активирует кнопку «Выбрать» той же панели (общий `selectionKey`).
5. Существующие тесты `button-node` / `ref-picker-selection` / `list-node` зелёные; моки переведены с парсинга на props.

## Границы

- Только `features/sdui`; легаси/shared не трогаем.
- Прочие enabled/disabled кнопок (не про выбор строки) — уже управляются бэком через `enabled`/`setProp` (A1), вне этой таски.
- Если `requiresSelectedRow:true`, но `selectionKey` пуст — баг бэка (кнопку не с чем связать), не повод парсить команду; сообщить бэку.
