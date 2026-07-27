# SCRUM-284 — контракт событий (Δ1–4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать с фронта конструирование и декодирование имён событий: команды приходят непрозрачными, а решения (нужна ли строка, по какому полю, готовая релей-команда) — явными полями с `action`/эффекта. Рантайм-параметры едут в `value`.

**Architecture:** Только `features/sdui`. Δ3 — `relay-selection.ts` шлёт `applyToParentCommand` дословно. Δ4 — `button-node.tsx`/`list-node.tsx` читают `requiresSelectedRow`/`selectionField` с `ViewNodeAction` (не `props`; доводит SCRUM-285 до финального контракта). Δ1–2 — удалить мёртвые `addRow:`/`deleteRow:` в `ReadOnlyTable`. Типы `ViewNodeAction`/`ViewEffect` расширяются. Бэк готов в `sdui-1.5`.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest + Testing Library.

## Global Constraints

- Правки только в `src/features/sdui`. Editable-таблицы (`useTableSync`), `ActionBehavior`, транспорт — не трогать.
- `command` — непрозрачный токен: не строить, не парсить, не интерполировать. Рантайм-параметры — в `value`.
- Окружение тестов: нет `jest-dom` (`.hasAttribute('disabled')`/spy-assert); нет `@testing-library/user-event` (`fireEvent`); `afterEach(cleanup)`; i18n в компонент-тестах — `import '@/app/config/i18n'` (или мок).
- Без `useMemo`/`useCallback` без перф-причины.
- НЕ запускать `tsc`/`lint`/`build` — только точечные `npx vitest run`.
- Формат коммита: `refactor: … (SCRUM-284)`.
- Алиас `@/*` → `src/*`.

---

## Task 1: Δ3 — relay-selection шлёт applyToParentCommand

**Files:**
- Modify: `src/features/sdui/types/view.ts` (`ViewEffect` += `applyToParentCommand`)
- Modify: `src/features/sdui/lib/relay-selection.ts` (гард + команда)
- Create: `src/features/sdui/lib/relay-selection.test.ts`

**Interfaces:**
- Consumes: `ViewEffect.applyToParentCommand?: string`.
- Produces: `relaySelectionToParent` шлёт `{ type:'COMMAND', command: effect.applyToParentCommand, value: effect.applyToParentValue }`.

- [ ] **Step 1: Расширить тип ViewEffect**

В `src/features/sdui/types/view.ts`, интерфейс `ViewEffect` (после `applyToParentValue`, строка ~94):
```ts
  applyToParentCommand?: string
```

- [ ] **Step 2: Написать падающий тест**

```ts
// src/features/sdui/lib/relay-selection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { relaySelectionToParent } from './relay-selection'
import { viewTransport } from '../api/view-transport'
import type { ViewEffect } from '../types/view'

vi.mock('../api/view-transport', () => ({
  viewTransport: { post: vi.fn() },
  ViewConflictError: class extends Error {},
}))
vi.mock('./stores/panel-store', () => ({
  usePanelStore: { getState: () => ({ findBySessionId: () => undefined, updateSession: vi.fn() }) },
}))
vi.mock('./stores/tree-store', () => ({
  useTreeStore: { getState: () => ({ revision: 1, bumpRevision: vi.fn(), clearAllErrors: vi.fn(), applyPatches: vi.fn() }) },
}))
vi.mock('./stores/view-state-store', () => ({
  useViewStateStore: { getState: () => ({ setFromServer: vi.fn(), merge: vi.fn() }) },
}))
vi.mock('./patch-applier', () => ({ applyValuePatches: vi.fn() }))
vi.mock('./validation', () => ({ validatePatches: (p: unknown) => p ?? [] }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const noop = () => {}

describe('relaySelectionToParent (SCRUM-284 Δ3)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('шлёт applyToParentCommand дословно + value', () => {
    vi.mocked(viewTransport.post).mockResolvedValue({ revision: 2, patches: [], effects: [] } as never)
    const effect = {
      type: 'closeDialog',
      applyToParentSessionId: 's1',
      applyToParentCommand: 'OPAQUE_CMD',
      applyToParentValue: { id: 7 },
    } as unknown as ViewEffect

    relaySelectionToParent(effect, noop)

    expect(viewTransport.post).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({ command: 'OPAQUE_CMD', value: { id: 7 } }),
      })
    )
  })

  it('без applyToParentCommand — no-op (не строит ref.select)', () => {
    const effect = {
      type: 'closeDialog',
      applyToParentSessionId: 's1',
      applyToParentTargetNodeId: 'n1',
      applyToParentValue: { id: 7 },
    } as unknown as ViewEffect

    relaySelectionToParent(effect, noop)

    expect(viewTransport.post).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Запустить — RED**

Run: `npx vitest run src/features/sdui/lib/relay-selection.test.ts`
Expected: FAIL. Тест 1: старый гард `!applyToParentTargetNodeId` (в эффекте его нет) → return → post не вызван → падает. Тест 2: старый гард пропускает (targetNodeId есть) → строит `ref.select:` → post вызван → падает.

- [ ] **Step 4: Правка relay-selection.ts**

Гард (строка 39) — заменить `applyToParentTargetNodeId` на `applyToParentCommand`:
```ts
  if (!effect.applyToParentSessionId || !effect.applyToParentCommand || !effect.applyToParentValue) {
    return
  }
```
Блок `action` (строки 48-52):
```ts
  const action = {
    type: 'COMMAND' as const,
    command: effect.applyToParentCommand,
    value: effect.applyToParentValue,
  }
```
Комментарий над функцией (строки 33-34) обновить: «…ретранслируется готовой командой applyToParentCommand».

- [ ] **Step 5: Запустить — GREEN**

Run: `npx vitest run src/features/sdui/lib/relay-selection.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/types/view.ts src/features/sdui/lib/relay-selection.ts src/features/sdui/lib/relay-selection.test.ts
git commit -m "refactor: relay-selection шлёт applyToParentCommand вместо ref.select:targetNodeId (SCRUM-284)"
```

---

## Task 2: Δ4 — requiresSelectedRow/selectionField с action

**Files:**
- Modify: `src/features/sdui/types/view.ts` (`ViewNodeAction` += поля)
- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx` (читать с click-action)
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx:122` (selectionField с selectAction)
- Modify: `src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx` (props → action)

**Interfaces:**
- Consumes: `ViewNodeAction.requiresSelectedRow?: boolean | null`, `selectionField?: string | null`.
- Produces: button-node/list-node читают эти поля с `action`, не с `props`.

- [ ] **Step 1: Расширить ViewNodeAction**

`src/features/sdui/types/view.ts`, интерфейс `ViewNodeAction` (строки 24-29):
```ts
export interface ViewNodeAction {
  trigger: string
  actionId: string
  command?: string
  behavior?: ActionBehavior | null
  requiresSelectedRow?: boolean | null   // SCRUM-284 Δ4
  selectionField?: string | null         // SCRUM-284 Δ4
}
```

- [ ] **Step 2: Переписать тест кнопки на action-based (RED)**

Заменить `src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx` целиком (поля переезжают с `props` на click-`action`; `selectionKey`→`selectionField`):

```tsx
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { useRefPickerSelectionStore } from '../../../lib/stores/ref-picker-selection-store'
import { ButtonNode } from './button-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

// requiresSelectedRow/selectionField приходят на click-action (SCRUM-284 Δ4),
// command берётся из props (props.command побеждает, SCRUM-283).
const button = (
  label: string,
  action: Record<string, unknown>,
): ViewNode =>
  ({
    id: 'b1',
    type: 'BUTTON',
    props: { label, command: 'noparse' },
    actions: [{ trigger: 'click', actionId: 'command', ...action }],
  }) as ViewNode

const isDisabled = (name: string) =>
  screen.getByRole('button', { name }).hasAttribute('disabled')

describe('ButtonNode: requiresSelectedRow с action (SCRUM-284 Δ4)', () => {
  beforeEach(() => {
    useRefPickerSelectionStore.setState({ selection: {} })
  })
  afterEach(cleanup)

  it('action.requiresSelectedRow:true → disabled без выбранной строки', () => {
    render(<ButtonNode node={button('Выбрать', { requiresSelectedRow: true, selectionField: 'field.x' })} />)
    expect(isDisabled('Выбрать')).toBe(true)
  })

  it('активна после выбора строки по selectionField с action', () => {
    render(<ButtonNode node={button('Выбрать', { requiresSelectedRow: true, selectionField: 'field.x' })} />)
    expect(isDisabled('Выбрать')).toBe(true)
    act(() => {
      useRefPickerSelectionStore.getState().setSelection('field.x', 42)
    })
    expect(isDisabled('Выбрать')).toBe(false)
  })

  it('requiresSelectedRow:null («Создать») → активна всегда', () => {
    render(<ButtonNode node={button('Создать', { requiresSelectedRow: null, selectionField: null })} />)
    expect(isDisabled('Создать')).toBe(false)
  })
})
```

- [ ] **Step 3: Запустить — RED**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx`
Expected: FAIL — button-node читает `node.props?.requiresSelectedRow` (у тест-ноды его нет в props) → кнопка не disabled → первый тест падает.

- [ ] **Step 4: button-node.tsx — читать с click-action**

Заменить блок (строки 35-41):
```ts
  // A3 (SCRUM-285): активность кнопки пикера описывает бэк через props —
  // фронт больше не парсит имя команды ref.<verb>:<field>.
  const requiresSelectedRow = node.props?.requiresSelectedRow === true
  const selectionKey = node.props?.selectionKey as string | undefined
  const selectedRowId = useRefPickerSelection(
    requiresSelectedRow ? (selectionKey ?? null) : null
  )
```
на (читаем с того же click-action, откуда берём behavior — SCRUM-284 Δ4):
```ts
  // SCRUM-284 Δ4: активность кнопки пикера — явные поля на ViewNodeAction
  // (click-действие), фронт имя команды не парсит.
  const clickAction = node.actions?.find((a) => a.trigger === 'click')
  const requiresSelectedRow = clickAction?.requiresSelectedRow === true
  const selectionField = clickAction?.selectionField ?? undefined
  const selectedRowId = useRefPickerSelection(
    requiresSelectedRow ? (selectionField ?? null) : null
  )
```
Также `clickBehavior` (строки 22-23) переиспользовать через `clickAction` (убрать дублирующий `find`):
```ts
  const behavior =
    (node.props?.behavior as ActionBehavior | undefined) ?? clickAction?.behavior ?? null
```
(Переставить объявление `clickAction` выше блока `behavior`; `handleClick` и `disabled` по `requiresSelectedRow` — без изменений.)

- [ ] **Step 5: list-node.tsx — selectionField с selectAction**

Строка 122:
```ts
// было
const selectField = node.props?.selectionKey as string | undefined
// стало (SCRUM-284 Δ4): ключ связки — с selectAction, не с props
const selectField = selectAction?.selectionField ?? undefined
```
(`selectAction` уже объявлен на строке 50; механика `setSelection`/`clearSelection`/гард — без изменений.)

- [ ] **Step 6: Запустить — GREEN + регресс action-тестов**

Run: `npx vitest run src/features/sdui/ui/nodes/action`
Expected: PASS (button-node-requires-row 3/3 + существующие button-node/overflow/menu-item зелёные).

- [ ] **Step 7: Коммит**

```bash
git add src/features/sdui/types/view.ts src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/composite/list-node.tsx src/features/sdui/ui/nodes/action/button-node-requires-row.test.tsx
git commit -m "refactor: requiresSelectedRow/selectionField читаются с action (SCRUM-284 Δ4, доводит 285)"
```

---

## Task 3: Δ1–2 — убрать мёртвые add/delete в ReadOnlyTable

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx` (ReadOnlyTable + импорты)

**Interfaces:**
- Produces: `ReadOnlyTable` без кнопок add/delete и без конструкций `addRow:`/`deleteRow:`.

- [ ] **Step 1: Удалить мёртвые add/delete из ReadOnlyTable**

В `src/features/sdui/ui/nodes/composite/table-node.tsx`, компонент `ReadOnlyTable`:
- Удалить чтение `allowAdd`/`allowDelete` (строки 170-171).
- Удалить `const dispatch = useSduiDispatch()` (строка 177) и хендлеры `handleAdd` (182-184), `handleDelete` (186-191).
- Заголовочный блок (строки 195-220): `{(label || allowAdd) && (...)}` → показывать только при `label`, без кнопки add:
  ```tsx
  {label && (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{label}</Typography>
    </div>
  )}
  ```
- Удалить header-ячейку delete (строки 244-249, блок `{allowDelete && (<TableCell padding="checkbox" .../>)}`).
- colSpan пустого состояния (строка 263): `columns.length + (allowDelete ? 1 : 0) + (showRowNumbers ? 1 : 0)` → `columns.length + (showRowNumbers ? 1 : 0)`.
- Удалить body-ячейку delete (строки 284-293, блок `{allowDelete && (<TableCell ...><IconButton onClick={() => handleDelete(row.rowId)}>...</IconButton></TableCell>)}`).

- [ ] **Step 2: Удалить ставшие неиспользуемыми импорты**

После удаления проверить и убрать импорты, которые больше нигде в файле не используются (grep по файлу перед удалением каждого):
- `Button` (строка 4), `IconButton` (строка 5) из `@mui/material`.
- `AddIcon` (строка 15), `DeleteIcon` (строка 16).
- `useSduiDispatch` (строка 20).

Run для проверки: `grep -n "Button\b\|IconButton\|AddIcon\|DeleteIcon\|useSduiDispatch\|dispatch" src/features/sdui/ui/nodes/composite/table-node.tsx`
Expected: после правки — ни одного использования (только, возможно, отсутствие). Если какой-то из символов используется в другом месте файла — импорт оставить.

- [ ] **Step 3: Регресс table-node + критерий grep**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: PASS (тест проверяет чистые `extractReadOnlyColumns`/`buildHeaderModel`, рендер ReadOnlyTable не задет).

Run: `grep -rn "addRow:\|deleteRow:" src/features/sdui`
Expected: пусто.

- [ ] **Step 4: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx
git commit -m "refactor: убрать мёртвые addRow/deleteRow-кнопки из ReadOnlyTable (SCRUM-284 Δ1–2)"
```

---

## Верификация (контроллер: приёмка)

- `grep -rn "addRow:\|deleteRow:\|ref.select:\|needsSelectedRow\|refCommandField\|selectionKey" src/features/sdui` → пусто (все конструкции имён и props-поля убраны; `needsSelectedRow`/`refCommandField` удалены ещё в 285).
- `node.props?.requiresSelectedRow`/`node.props?.selectionKey` в SDUI не осталось.
- Полный регресс `npx vitest run src/features/sdui` — зелёный.
- eslint по изменённым файлам — 0 новых ошибок.
- `npm run build` — зелёный.

## Верификация (e2e, ручная — на стенде с sdui-1.5)

1. Реф-пикер: «Выбрать»/«Скопировать» disabled без выбора строки, активны после клика по строке (по `action.requiresSelectedRow`/`selectionField`).
2. «Создать» в пикере активна всегда.
3. «Записать и выбрать» дочернего справочника → выбор релеится в родительскую форму (Δ3, `applyToParentCommand`).
4. Read-only таблица рендерится без кнопок add/delete. Редактируемые ТЧ (add/delete/reorder + save через full-snapshot) — регресса нет.

## Deploy-зависимость

284-фронт катить с/до `sdui-1.5` (иначе окно, где 285-props-чтение отвалилось — поля переехали на action). `applyToParentTargetNodeId` бэк оставляет для back-compat; фронт перестал читать.

---

## Self-Review (выполнено при написании плана)

**Покрытие дизайна:**
- Δ3 (relay-selection + ViewEffect + тест) → Task 1. ✓
- Δ4 (button-node/list-node + ViewNodeAction + переписанный 285-тест) → Task 2. ✓
- Δ1–2 (ReadOnlyTable dead-button removal + импорты) → Task 3. ✓
- Связь с 285 (props→action, selectionKey→selectionField) → Task 2. ✓
- Критерии приёмки (grep, регресс) → Верификация. ✓

**Плейсхолдеры:** нет TBD/TODO; код и тесты целиком.

**Согласованность:** `applyToParentCommand` (Task 1), `requiresSelectedRow`/`selectionField` на `ViewNodeAction` (Task 2) — единые имена; `clickAction` переиспользуется для behavior и полей Δ4; порядок задач независим (каждая коммитится отдельно, битых импортов между шагами нет).

**Осознанные упущения:** list-node без прямого юнит-теста (pre-existing) — Δ4-правка `selectField` покрыта регрессом + e2e; relay happy-path тест держит стор-моки минимальными (findBySessionId→undefined), .then-путь не крашится.
