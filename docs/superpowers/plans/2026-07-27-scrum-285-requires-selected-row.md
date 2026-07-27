# SCRUM-285 — активность кнопок пикера из props (A3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать с фронта парсинг имени команды `ref.<verb>:<field>` — активность кнопок пикера «Выбрать»/«Скопировать» и ключ группы выбора читать из серверных props `requiresSelectedRow` / `selectionKey`.

**Architecture:** Три файла в `features/sdui`. `button-node.tsx` и `list-node.tsx` читают props вместо парсеров; парсеры `needsSelectedRow`/`refCommandField` удаляются из `ref-picker-selection-store.ts`. Механика стора (`setSelection`/`clearSelection`/`useRefPickerSelection`) не меняется — меняется только источник ключа. Бэк-часть (props) уже в webbuh.

**Tech Stack:** React 19, TypeScript, Zustand (ref-picker store), Vitest + Testing Library.

## Global Constraints

- Правки только в `src/features/sdui`. Легаси/shared не трогать. Изоляция SDUI↔легаси не нарушается.
- `requiresSelectedRow` — читать как `node.props?.requiresSelectedRow === true`. `selectionKey` — `node.props?.selectionKey as string | undefined`.
- Гарантия бэка: `selectionKey` на кнопках select/copy и на LIST посимвольно идентичен. Кнопка «Создать» намеренно без `requiresSelectedRow`/`selectionKey`.
- Fallback на парсинг команды НЕ делаем (критерий приёмки №1 — парсеры удалить полностью).
- Окружение тестов (как в SCRUM-265): нет `jest-dom` → проверять `(el as HTMLButtonElement).disabled`, не `toBeInTheDocument`/`toBeDisabled`; нет `@testing-library/user-event` → `fireEvent`; глобального setup нет → `afterEach(cleanup)`.
- Без `useMemo`/`useCallback` без перф-причины.
- НЕ запускать `tsc`/`lint`/`build` — только точечные `npx vitest run` из шагов.
- Формат коммита: `refactor: … (SCRUM-285)`.
- Алиас `@/*` → `src/*`.

---

## Task 1: button-node — props-driven requiresSelectedRow/selectionKey

**Files:**
- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx` (import стр. 7-11; блок стр. 39-42; `disabled` стр. 48; `handleClick` стр. 72)
- Modify: `src/features/sdui/ui/nodes/action/button-node.test.tsx` (мок стора — убрать мёртвые ключи)
- Modify: `src/features/sdui/ui/nodes/action/button-node-overflow.test.tsx` (мок стора — убрать мёртвые ключи)
- Create: `src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx` (новый тест на props-driven гейтинг через РЕАЛЬНЫЙ стор)

**Interfaces:**
- Consumes: `useRefPickerSelection(field: string | null): number | null` и `useRefPickerSelectionStore` из `ref-picker-selection-store` (остаются; Task 3 удаляет только парсеры).
- Produces: поведение — кнопка с `props.requiresSelectedRow === true` disabled, пока `useRefPickerSelection(props.selectionKey)` возвращает null; активна при непустом id.

- [ ] **Step 1: Написать новый падающий тест (RED)**

Новый файл `src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx`. Использует РЕАЛЬНЫЙ стор (не мок) — так тест проверяет реальную связку props→стор→disabled. `command` намеренно НЕ `ref.select:*` — чтобы доказать, что гейтинг идёт от props, а не от парсинга команды.

```tsx
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { useRefPickerSelectionStore } from '../../../lib/stores/ref-picker-selection-store'
import { ButtonNode } from './button-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

const button = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'b1', type: 'BUTTON', props }) as ViewNode

const btn = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement

describe('ButtonNode: requiresSelectedRow из props (SCRUM-285 A3)', () => {
  beforeEach(() => {
    useRefPickerSelectionStore.setState({ selection: {} })
  })
  afterEach(cleanup)

  it('requiresSelectedRow:true → disabled без выбранной строки (не по имени команды)', () => {
    render(
      <ButtonNode
        node={button({
          label: 'Выбрать',
          command: 'noparse',
          requiresSelectedRow: true,
          selectionKey: 'field.x',
        })}
      />,
    )
    expect(btn('Выбрать').disabled).toBe(true)
  })

  it('становится активной после выбора строки по selectionKey', () => {
    render(
      <ButtonNode
        node={button({
          label: 'Выбрать',
          command: 'noparse',
          requiresSelectedRow: true,
          selectionKey: 'field.x',
        })}
      />,
    )
    expect(btn('Выбрать').disabled).toBe(true)
    act(() => {
      useRefPickerSelectionStore.getState().setSelection('field.x', 42)
    })
    expect(btn('Выбрать').disabled).toBe(false)
  })

  it('без requiresSelectedRow активна всегда («Создать»)', () => {
    render(
      <ButtonNode
        node={button({ label: 'Создать', command: 'ref.create:field.x' })}
      />,
    )
    expect(btn('Создать').disabled).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx`
Expected: FAIL — первый кейс: текущий код зовёт `needsSelectedRow('noparse')` → false → кнопка НЕ disabled, `expect(...).toBe(true)` падает.

- [ ] **Step 3: Переписать button-node.tsx на props**

Импорт (стр. 7-11) — оставить только `useRefPickerSelection`:

```ts
import { useRefPickerSelection } from '../../../lib/stores/ref-picker-selection-store'
```

Блок стр. 39-42 заменить:

```ts
  const usesSelectedRow = needsSelectedRow(command)
  const selectedRowId = useRefPickerSelection(
    usesSelectedRow ? refCommandField(command) : null
  )
```

на:

```ts
  // A3 (SCRUM-285): активность кнопки пикера описывает бэк через props —
  // фронт больше не парсит имя команды ref.<verb>:<field>.
  const requiresSelectedRow = node.props?.requiresSelectedRow === true
  const selectionKey = node.props?.selectionKey as string | undefined
  const selectedRowId = useRefPickerSelection(
    requiresSelectedRow ? (selectionKey ?? null) : null
  )
```

`disabled` (стр. 48):

```ts
  const disabled = !enabled || (requiresSelectedRow && selectedRowId == null)
```

`handleClick` (стр. 72) — ветку `if (usesSelectedRow) {` заменить на `if (requiresSelectedRow) {` (тело без изменений: `if (selectedRowId == null) return; void dispatch({ type:'COMMAND', command, value:{ id: selectedRowId }, sourceNodeId: node.id }, behavior); return`).

- [ ] **Step 4: Запустить новый тест — GREEN**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Убрать мёртвые ключи из моков существующих тестов**

В `src/features/sdui/ui/nodes/action/button-node.test.tsx` и `src/features/sdui/ui/nodes/action/button-node-overflow.test.tsx` мок стора сейчас:

```ts
vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  needsSelectedRow: () => false,
  refCommandField: () => null,
  useRefPickerSelection: () => null,
}))
```

Заменить (в ОБОИХ файлах) на:

```ts
vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  useRefPickerSelection: () => null,
}))
```

- [ ] **Step 6: Прогнать все тесты button-node (регресс)**

Run: `npx vitest run src/features/sdui/ui/nodes/action`
Expected: PASS (button-node, button-node-overflow, button-node-requires-row, menu-item-node — все зелёные, вывод чистый).

- [ ] **Step 7: Коммит**

```bash
git add src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/action/button-node.test.tsx src/features/sdui/ui/nodes/action/button-node-overflow.test.tsx src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx
git commit -m "refactor: активность кнопки пикера из props requiresSelectedRow/selectionKey (SCRUM-285)"
```

---

## Task 2: list-node — selectionKey из props

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx` (import стр. 20-23; `selectField` стр. 124)

**Interfaces:**
- Consumes: `useRefPickerSelectionStore` (остаётся).
- Produces: `selectField = node.props?.selectionKey` — LIST пишет выбранную строку в стор под серверным ключом.

Примечание: у `list-node.tsx` нет юнит-теста (pre-existing; рендер требует QueryClient + virtualizer + IntersectionObserver + i18n — заводить тест ради чтения одного prop'а несоразмерно). Изменение механическое, читается из тех же props; проверяется финальным регрессом sdui (Task 3), критерием grep и ручным e2e в drawer. Новый тест НЕ пишем (YAGNI).

- [ ] **Step 1: Заменить источник ключа**

Импорт (стр. 20-23) — убрать `refCommandField`:

```ts
import { useRefPickerSelectionStore } from '../../../lib/stores/ref-picker-selection-store'
```

Строка 124:

```ts
  // было
  const selectField = refCommandField(selectAction?.command)
  // стало (A3, SCRUM-285): ключ группы выбора — из props, не из парсинга команды
  const selectField = node.props?.selectionKey as string | undefined
```

Гард `if (!selectField) return` (стр. 128) и вся механика `setSelection`/`clearSelection` — БЕЗ изменений. `selectAction`/`activateAction` (стр. 53-54) остаются — используются для dispatch по строке.

- [ ] **Step 2: Проверить, что refCommandField больше не используется в list-node**

Run: `grep -n "refCommandField" src/features/sdui/ui/nodes/composite/list-node.tsx`
Expected: пусто (ни импорта, ни вызова).

- [ ] **Step 3: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/list-node.tsx
git commit -m "refactor: LIST пишет выбор по selectionKey из props, без парсинга команды (SCRUM-285)"
```

---

## Task 3: удалить парсеры из стора + приёмка

**Files:**
- Modify: `src/features/sdui/lib/stores/ref-picker-selection-store.ts` (удалить `refCommandField` стр. 23-28 и `needsSelectedRow` стр. 30-36)

**Interfaces:**
- Consumes: ничего (Task 1/2 убрали всех потребителей парсеров).
- Produces: стор без парсеров; экспортирует `useRefPickerSelectionStore`, `setSelection`/`clearSelection` (внутри), `useRefPickerSelection`.

- [ ] **Step 1: Удалить парсеры**

Из `src/features/sdui/lib/stores/ref-picker-selection-store.ts` удалить целиком два блока:

```ts
/** Extract `<field>` from `ref.<verb>:<field>` (everything after the first `:`). */
export function refCommandField(command?: string): string | null {
  if (!command) return null
  const idx = command.indexOf(':')
  return idx >= 0 ? command.slice(idx + 1) : null
}

/** Commands that operate on the picker LIST's highlighted row. */
export function needsSelectedRow(command: string | undefined): boolean {
  return (
    command?.startsWith('ref.select:') === true ||
    command?.startsWith('ref.copy:') === true
  )
}
```

Оставить: интерфейс `RefPickerSelectionState`, `useRefPickerSelectionStore`, `useRefPickerSelection`.

- [ ] **Step 2: Критерий приёмки №1 — grep пуст**

Run: `grep -rn "needsSelectedRow\|refCommandField\|startsWith('ref.select\|startsWith('ref.copy" src/features/sdui`
Expected: пусто (ни определений, ни вызовов, ни мок-ключей).

- [ ] **Step 3: Полный регресс sdui**

Run: `npx vitest run src/features/sdui`
Expected: PASS (вывод чистый). Известное pre-existing падение вне sdui (`dict-sidebar/dict-columns.test.tsx`) в этот прогон не входит.

- [ ] **Step 4: Коммит**

```bash
git add src/features/sdui/lib/stores/ref-picker-selection-store.ts
git commit -m "refactor: удалить парсеры needsSelectedRow/refCommandField — источник состояния props (SCRUM-285)"
```

---

## Верификация (e2e, ручная — после деплоя A3-части webbuh)

1. Открыть drawer пикера (например поле «Договор контрагента»): кнопки «Выбрать»/«Скопировать» неактивны без выбранной строки, активны после клика по строке списка — по `requiresSelectedRow` + `selectionKey`.
2. Кнопка «Создать» в drawer активна всегда.
3. Выбор строки в LIST активирует «Выбрать» той же панели (общий `selectionKey`).
4. Регресс: обычные кнопки формы (не пикер) — активность как раньше (по `enabled`).

---

## Self-Review (выполнено при написании плана)

**Покрытие спеки (frontend-spec-requires-selected-row.md):**
- §3.1 button-node props → Task 1. ✓
- §3.2 list-node selectionKey → Task 2. ✓
- §3.3 удалить парсеры → Task 3. ✓
- §4 критерий №1 (grep пуст) → Task 3 Step 2. ✓
- §4 критерии №2-4 (drawer-поведение) → новый тест Task 1 (гейтинг по props) + ручной e2e. ✓
- §4 критерий №5 (тесты зелёные, моки переведены) → Task 1 Step 5-6, Task 3 Step 3. ✓

**Плейсхолдеры:** нет TBD/TODO; код и тесты приведены целиком.

**Согласованность:** `requiresSelectedRow`/`selectionKey`/`useRefPickerSelection`/`useRefPickerSelectionStore` — единые имена сквозь Task 1-3; порядок задач (button-node → list-node → удаление парсеров) исключает битые импорты на каждом шаге.

**Осознанные упущения:** нет юнит-теста для `list-node` (pre-existing gap, рендер несоразмерно тяжёл ради чтения одного prop'а) — Task 2 механический, покрыт grep-критерием + финальным регрессом + e2e.
