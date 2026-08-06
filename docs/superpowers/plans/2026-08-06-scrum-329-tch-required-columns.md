# SCRUM-329 — Обязательные колонки в ТЧ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показывать «\*» у заголовка обязательной колонки ТЧ и красную рамку + tooltip у пустой обязательной ячейки (клиентский дублёр серверной валидации).

**Architecture:** Бэк уже шлёт `props.required:true` на `TABLE_COLUMN` (проверено вживую). Фронт добавляет: (1) маркер «\*» в заголовок leaf-колонок; (2) новую клиентскую валидацию ячейки — пусто (`isCellEmpty`) + `touched`(blur) + `revealErrors`(на write-командах через реестр-близнец `pending-table-commits`). Сабмит не блокируем — авторитет за серверным 422.

**Tech Stack:** React 19, TypeScript, MUI, TanStack Table, Zustand, Vitest + React Testing Library, react-i18next.

## Global Constraints

- Design-док: `docs/superpowers/specs/2026-08-06-scrum-329-tch-required-columns-design.md`.
- FSD: barrel-экспорты только на уровне слайса; внутри сегмента импорт из конкретных файлов.
- Тексты — через `useTranslation`; ключ «Обязательное поле» = **`errors.required`** (RU/KZ уже есть в `common.json`).
- Не трогать легаси; менять только SDUI (`src/features/sdui/`). Не трогать не-табличные ноды.
- Цель ~200 строк/файл; файл >300 обязан быть разбит. `table-cell-editor.tsx` уже 302 строки → в задаче 5 вынести sx-константы, чтобы остаться под лимитом.
- Формат коммита: `feat|fix|add|refactor: описание`. Хук lint-staged гоняет ESLint/Prettier на коммите.
- НЕ запускать `tsc`/`lint`/`build` после каждого шага — только целевой vitest указанного файла.
- Тесты: `npx vitest run <path>`.
- Пустота: `null`/`undefined`/`""`/нет ключа; для `REFERENCE_FIELD`/`OBJECT_FIELD` — нет `id`; числовой `0` и `false` — НЕ пусто.
- Reveal-триггер: `action.type==='COMMAND' && behavior?.flushPendingTables===true` (НЕ `shouldFlush`).
- «\*» и рамка только при `required && !readonly`.

## File Structure

**Создаём:**

- `src/features/sdui/lib/utils/is-cell-empty.ts` — чистая утилита пустоты.
- `src/features/sdui/lib/utils/is-cell-empty.test.ts`
- `src/features/sdui/lib/table-validation-registry.ts` — реестр reveal-колбэков.
- `src/features/sdui/lib/table-validation-registry.test.ts`
- `src/features/sdui/lib/hooks/use-table-validation.ts` — `revealErrors` + регистрация.
- `src/features/sdui/lib/hooks/use-table-validation.test.tsx`
- `src/features/sdui/lib/utils/reveal-policy.ts` — предикат `shouldRevealTableErrors`.
- `src/features/sdui/lib/utils/reveal-policy.test.ts`
- `src/features/sdui/ui/nodes/composite/required-mark.tsx` — маркер «\*».
- `src/features/sdui/ui/nodes/composite/required-mark.test.tsx`
- `src/features/sdui/ui/nodes/composite/required-cell-frame.tsx` — рамка + tooltip вокруг ячейки.
- `src/features/sdui/ui/nodes/composite/table-cell-editor-styles.ts` — вынесенные sx-константы.

**Меняем:**

- `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx` — `required`/`revealErrors`/`touched`, рамка.
- `src/features/sdui/ui/nodes/composite/table-cell-editor.test.tsx` (если есть — дополнить; иначе создать)
- `src/features/sdui/lib/utils/build-column-defs.ts` — маркер в header + проброс в cell.
- `src/features/sdui/lib/utils/build-column-defs.test.tsx` (создать)
- `src/features/sdui/ui/nodes/composite/editable-table.tsx` — маркер + проброс + `useTableValidation`.
- `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx` — `useTableValidation` + `validationRef`.
- `src/features/sdui/lib/dispatch.ts` — вызов `revealAllTableErrors()` на write-команде.

---

### Task 1: Утилита `isCellEmpty`

**Files:**

- Create: `src/features/sdui/lib/utils/is-cell-empty.ts`
- Test: `src/features/sdui/lib/utils/is-cell-empty.test.ts`

**Interfaces:**

- Produces: `isCellEmpty(value: unknown, cellWidget: string): boolean`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/utils/is-cell-empty.test.ts
import { describe, it, expect } from 'vitest'
import { isCellEmpty } from './is-cell-empty'

describe('isCellEmpty', () => {
  it('null/undefined/"" — пусто', () => {
    expect(isCellEmpty(null, 'TEXT_FIELD')).toBe(true)
    expect(isCellEmpty(undefined, 'TEXT_FIELD')).toBe(true)
    expect(isCellEmpty('', 'TEXT_FIELD')).toBe(true)
  })
  it('0 и false — НЕ пусто', () => {
    expect(isCellEmpty(0, 'NUMBER_FIELD')).toBe(false)
    expect(isCellEmpty(false, 'CHECKBOX_FIELD')).toBe(false)
  })
  it('непустая строка — НЕ пусто', () => {
    expect(isCellEmpty('x', 'TEXT_FIELD')).toBe(false)
  })
  it('REFERENCE без id — пусто, с id — НЕ пусто', () => {
    expect(isCellEmpty(null, 'REFERENCE_FIELD')).toBe(true)
    expect(isCellEmpty({ presentation: 'X' }, 'REFERENCE_FIELD')).toBe(true)
    expect(isCellEmpty({ id: 5, presentation: 'X' }, 'REFERENCE_FIELD')).toBe(
      false
    )
  })
  it('OBJECT_FIELD без id — пусто', () => {
    expect(isCellEmpty({ member: 'A' }, 'OBJECT_FIELD')).toBe(true)
    expect(isCellEmpty({ id: 1 }, 'OBJECT_FIELD')).toBe(false)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/utils/is-cell-empty.test.ts`
Expected: FAIL — модуль `./is-cell-empty` не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/sdui/lib/utils/is-cell-empty.ts
/**
 * Пустая ли ячейка ТЧ для клиентской проверки обязательности (SCRUM-329).
 * REFERENCE/OBJECT — «нет id»; числовой 0 и false — НЕ пусто (валидные значения).
 */
export function isCellEmpty(value: unknown, cellWidget: string): boolean {
  if (value == null) return true
  if (cellWidget === 'REFERENCE_FIELD' || cellWidget === 'OBJECT_FIELD') {
    if (typeof value === 'object') {
      return (value as { id?: unknown }).id == null
    }
    return value === ''
  }
  if (typeof value === 'string') return value === ''
  return false
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/utils/is-cell-empty.test.ts`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/utils/is-cell-empty.ts src/features/sdui/lib/utils/is-cell-empty.test.ts
git commit -m "feat: isCellEmpty util for TCH required validation (SCRUM-329)"
```

---

### Task 2: Реестр reveal-колбэков

**Files:**

- Create: `src/features/sdui/lib/table-validation-registry.ts`
- Test: `src/features/sdui/lib/table-validation-registry.test.ts`

**Interfaces:**

- Produces:
  - `registerRevealErrors(reveal: () => void): symbol`
  - `unregisterRevealErrors(token: symbol): void`
  - `revealAllTableErrors(): void`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/table-validation-registry.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  registerRevealErrors,
  unregisterRevealErrors,
  revealAllTableErrors,
} from './table-validation-registry'

describe('table-validation-registry', () => {
  it('revealAll дёргает все зарегистрированные колбэки', () => {
    const a = vi.fn()
    const b = vi.fn()
    const ta = registerRevealErrors(a)
    const tb = registerRevealErrors(b)
    revealAllTableErrors()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unregisterRevealErrors(ta)
    unregisterRevealErrors(tb)
  })
  it('снятый колбэк не дёргается', () => {
    const a = vi.fn()
    const t = registerRevealErrors(a)
    unregisterRevealErrors(t)
    revealAllTableErrors()
    expect(a).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/table-validation-registry.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/sdui/lib/table-validation-registry.ts
// Реестр-близнец pending-table-commits (SCRUM-329): на write-команде dispatch
// зовёт revealAllTableErrors(), каждая смонтированная ТЧ показывает пустые
// обязательные ячейки. Отдельный модуль — тот же паттерн, что flush-before-save.
const registry = new Map<symbol, () => void>()

export function registerRevealErrors(reveal: () => void): symbol {
  const token = Symbol('reveal-errors')
  registry.set(token, reveal)
  return token
}

export function unregisterRevealErrors(token: symbol): void {
  registry.delete(token)
}

export function revealAllTableErrors(): void {
  for (const reveal of registry.values()) reveal()
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/table-validation-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/table-validation-registry.ts src/features/sdui/lib/table-validation-registry.test.ts
git commit -m "feat: table-validation reveal registry (SCRUM-329)"
```

---

### Task 3: Хук `useTableValidation`

**Files:**

- Create: `src/features/sdui/lib/hooks/use-table-validation.ts`
- Test: `src/features/sdui/lib/hooks/use-table-validation.test.tsx`

**Interfaces:**

- Consumes: `registerRevealErrors`/`unregisterRevealErrors` (Task 2), `ViewNode` из `../../types/view`.
- Produces: `useTableValidation(node: ViewNode): { revealErrors: boolean }` (`UseTableValidationResult`).

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/lib/hooks/use-table-validation.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { ViewNode } from '../../types/view'
import { useTableValidation } from './use-table-validation'
import { revealAllTableErrors } from '../table-validation-registry'

const node: ViewNode = { id: 't', type: 'TABLE', binding: 'VychetyIPN' }

function Probe() {
  const { revealErrors } = useTableValidation(node)
  return <span>{revealErrors ? 'on' : 'off'}</span>
}

describe('useTableValidation', () => {
  it('revealErrors=false до сабмита, true после revealAll', () => {
    render(<Probe />)
    expect(screen.getByText('off')).toBeInTheDocument()
    act(() => {
      revealAllTableErrors()
    })
    expect(screen.getByText('on')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/hooks/use-table-validation.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/sdui/lib/hooks/use-table-validation.ts
import { useState, useEffect } from 'react'

import type { ViewNode } from '../../types/view'
import {
  registerRevealErrors,
  unregisterRevealErrors,
} from '../table-validation-registry'

export interface UseTableValidationResult {
  revealErrors: boolean
}

/**
 * Клиентская валидация обязательных ячеек ТЧ (SCRUM-329). Держит флаг
 * revealErrors: false до сабмита, true после write-команды (dispatch зовёт
 * revealAllTableErrors). Регистрация — как registerPendingFlush, эффект по
 * node.binding; на новом OPEN таблица перемонтируется и флаг сбрасывается.
 */
export function useTableValidation(node: ViewNode): UseTableValidationResult {
  const [revealErrors, setRevealErrors] = useState(false)

  useEffect(() => {
    if (!node.binding) return
    const token = registerRevealErrors(() => setRevealErrors(true))
    return () => {
      unregisterRevealErrors(token)
    }
  }, [node.binding])

  return { revealErrors }
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/hooks/use-table-validation.test.tsx`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/hooks/use-table-validation.ts src/features/sdui/lib/hooks/use-table-validation.test.tsx
git commit -m "feat: useTableValidation hook (SCRUM-329)"
```

---

### Task 4: Предикат reveal-политики

**Files:**

- Create: `src/features/sdui/lib/utils/reveal-policy.ts`
- Test: `src/features/sdui/lib/utils/reveal-policy.test.ts`

**Interfaces:**

- Consumes: `ViewAction`, `ActionBehavior` из `../../types/view`.
- Produces: `shouldRevealTableErrors(action: ViewAction, behavior?: ActionBehavior | null): boolean`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/utils/reveal-policy.test.ts
import { describe, it, expect } from 'vitest'
import { shouldRevealTableErrors } from './reveal-policy'

describe('shouldRevealTableErrors', () => {
  it('COMMAND с flushPendingTables:true → true (save/post)', () => {
    expect(
      shouldRevealTableErrors(
        { type: 'COMMAND', command: 'save' },
        {
          flushPendingTables: true,
          resetsDirty: true,
          closeAfter: true,
        }
      )
    ).toBe(true)
  })
  it('reference-команда без behavior → false', () => {
    expect(
      shouldRevealTableErrors(
        { type: 'COMMAND', command: 'showAll' },
        undefined
      )
    ).toBe(false)
  })
  it('behavior.flushPendingTables:false → false (rowActivate/reference)', () => {
    expect(
      shouldRevealTableErrors(
        { type: 'COMMAND', command: 'x' },
        {
          flushPendingTables: false,
        }
      )
    ).toBe(false)
  })
  it('OPEN/EVENT → false', () => {
    expect(
      shouldRevealTableErrors({ type: 'OPEN' }, { flushPendingTables: true })
    ).toBe(false)
    expect(
      shouldRevealTableErrors(
        { type: 'EVENT', sourceNodeId: 'n' },
        { flushPendingTables: true }
      )
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/utils/reveal-policy.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/sdui/lib/utils/reveal-policy.ts
import type { ActionBehavior, ViewAction } from '../../types/view'

/**
 * Подсвечивать ли пустые обязательные ячейки ТЧ по этому действию (SCRUM-329).
 * Только write-команды: save/post/postAndClose несут behavior.flushPendingTables:true.
 * reference-команды (showAll/create/open/copy) и rowActivate — false (или без
 * behavior). НЕ использовать shouldFlush (?? true) — он сработал бы на reference.
 */
export function shouldRevealTableErrors(
  action: ViewAction,
  behavior?: ActionBehavior | null
): boolean {
  return action.type === 'COMMAND' && behavior?.flushPendingTables === true
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/utils/reveal-policy.test.ts`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/utils/reveal-policy.ts src/features/sdui/lib/utils/reveal-policy.test.ts
git commit -m "feat: reveal-policy predicate for TCH validation (SCRUM-329)"
```

---

### Task 5: Компонент `RequiredMark`

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/required-mark.tsx`
- Test: `src/features/sdui/ui/nodes/composite/required-mark.test.tsx`

**Interfaces:**

- Produces: `RequiredMark: FC<{ label: string }>` — рендерит `label` + красный `*`.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/ui/nodes/composite/required-mark.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequiredMark } from './required-mark'

describe('RequiredMark', () => {
  it('рендерит label и звёздочку', () => {
    render(<RequiredMark label="Вычет ИПН" />)
    expect(screen.getByText('Вычет ИПН')).toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/required-mark.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```tsx
// src/features/sdui/ui/nodes/composite/required-mark.tsx
import type { FC } from 'react'
import { Box } from '@mui/material'

interface RequiredMarkProps {
  label: string
}

/**
 * Заголовок обязательной колонки ТЧ: label + красный «*» (SCRUM-329),
 * визуально как MUI-астериск обязательного поля шапки.
 */
export const RequiredMark: FC<RequiredMarkProps> = ({ label }) => (
  <Box component="span">
    {label}
    <Box component="span" aria-hidden sx={{ color: 'error.main', ml: '2px' }}>
      *
    </Box>
  </Box>
)
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/required-mark.test.tsx`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/required-mark.tsx src/features/sdui/ui/nodes/composite/required-mark.test.tsx
git commit -m "feat: RequiredMark header marker (SCRUM-329)"
```

---

### Task 6: Валидация в `TableCellEditor` (+ вынос sx-констант, + `RequiredCellFrame`)

Файл `table-cell-editor.tsx` уже 302 строки. Сначала выносим sx-константы в отдельный файл (освобождаем место под лимит), затем добавляем валидацию. `RequiredCellFrame` — отдельный компонент.

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/table-cell-editor-styles.ts`
- Create: `src/features/sdui/ui/nodes/composite/required-cell-frame.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`
- Create: `src/features/sdui/ui/nodes/composite/table-cell-editor.test.tsx`

**Interfaces:**

- Consumes: `isCellEmpty` (Task 1), `errors.required` i18n-ключ.
- Produces:
  - `RequiredCellFrame: FC<{ show: boolean; children: ReactNode }>`
  - `TableCellEditor` получает новые опциональные пропы: `required?: boolean`, `revealErrors?: boolean`.

- [ ] **Step 1: Вынести sx-константы в новый файл**

```ts
// src/features/sdui/ui/nodes/composite/table-cell-editor-styles.ts
import type { SxProps, Theme } from '@mui/material'

export const cellSx: SxProps<Theme> = {
  mb: 0,
  position: 'static',
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
  },
  '& .MuiInputBase-input': {
    padding: '4px 8px !important',
    fontSize: '14px !important',
  },
}

export const enumCellSx: SxProps<Theme> = {
  fontSize: '14px',
  '&::before, &::after': { display: 'none' },
  '& .MuiSelect-select': {
    padding: '4px 8px !important',
    minHeight: '28px',
    display: 'flex',
    alignItems: 'center',
  },
}

export const dateCellSx: SxProps<Theme> = {
  '& .MuiFormControl-root': { mb: 0, position: 'static', width: '100%' },
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 !important',
  },
  '& .MuiPickersInputBase-root': {
    position: 'relative',
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 8px !important',
  },
  '& .MuiPickersInputBase-sectionsContainer': {
    padding: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    fontSize: '14px !important',
  },
  '& .MuiInputAdornment-root': {
    width: 0,
    overflow: 'visible',
    ml: 0,
    transform: 'translateX(-24px)',
  },
  '& .MuiInputAdornment-root .MuiIconButton-root': { p: '2px' },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': { fontSize: 16 },
}
```

Затем в `table-cell-editor.tsx` удалить эти три `const ...Sx` и импортировать:

```tsx
import { cellSx, enumCellSx, dateCellSx } from './table-cell-editor-styles'
```

- [ ] **Step 2: Прогнать существующие тесты (если есть) — регрессии нет**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: PASS (вынос констант поведение не меняет).

- [ ] **Step 3: Создать `RequiredCellFrame`**

```tsx
// src/features/sdui/ui/nodes/composite/required-cell-frame.tsx
import type { FC, ReactNode } from 'react'
import { Box, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface RequiredCellFrameProps {
  show: boolean
  children: ReactNode
}

/**
 * Обёртка обязательной ячейки ТЧ (SCRUM-329): при show=true — красная рамка
 * + tooltip «Обязательное поле». Структура стабильна (Box+Tooltip всегда),
 * меняются только sx/title — инпут не перемонтируется, фокус сохраняется.
 */
export const RequiredCellFrame: FC<RequiredCellFrameProps> = ({
  show,
  children,
}) => {
  const { t } = useTranslation()
  return (
    <Tooltip title={show ? t('errors.required') : ''}>
      <Box
        sx={{
          width: '100%',
          borderRadius: 1,
          outline: show ? '1px solid' : 'none',
          outlineColor: 'error.main',
        }}
      >
        {children}
      </Box>
    </Tooltip>
  )
}
```

- [ ] **Step 4: Написать падающий тест `TableCellEditor`**

```tsx
// src/features/sdui/ui/nodes/composite/table-cell-editor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableCellEditor } from './table-cell-editor'

const base = {
  cellWidget: 'TEXT_FIELD',
  dataType: 'STRING',
  onChange: vi.fn(),
  onCommit: vi.fn(),
}

describe('TableCellEditor required validation', () => {
  it('пустая обязательная ячейка после blur → рамка (tooltip-обёртка)', () => {
    const { container } = render(
      <TableCellEditor {...base} value="" required />
    )
    const input = container.querySelector('input')!
    fireEvent.blur(input)
    // outline становится '1px solid' на обёртке
    const framed = container.querySelector('[style*="outline"]')
    expect(framed).toBeTruthy()
  })

  it('revealErrors подсвечивает пустую обязательную БЕЗ blur', () => {
    render(<TableCellEditor {...base} value="" required revealErrors />)
    expect(screen.getByRole('tooltip', { hidden: true })).toBeDefined()
  })

  it('необязательная ячейка не оборачивается рамкой', () => {
    const { container } = render(<TableCellEditor {...base} value="" />)
    const input = container.querySelector('input')!
    fireEvent.blur(input)
    expect(container.querySelector('[style*="outline: 1px solid"]')).toBeNull()
  })

  it('readonly обязательная — span без рамки', () => {
    const { container } = render(
      <TableCellEditor {...base} value="" required readonly />
    )
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('[style*="outline: 1px solid"]')).toBeNull()
  })
})
```

> Примечание для исполнителя: проверка рамки идёт по инлайн-стилю `outline`
> (MUI кладёт `sx.outline` в style). Если в рантайме селектор `[style*="outline"]`
> ловит и `outline: none`, уточни на `outline: 1px solid`. Тест должен именно
> ПАДАТЬ до реализации (компонент ещё не принимает `required`).

- [ ] **Step 5: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-cell-editor.test.tsx`
Expected: FAIL — рамки нет (проп `required` игнорируется).

- [ ] **Step 6: Реализовать валидацию в `TableCellEditor`**

Изменения в `table-cell-editor.tsx`:

1. Импорты:

```tsx
import { useState } from 'react'
import { isCellEmpty } from '../../../lib/utils/is-cell-empty'
import { RequiredCellFrame } from './required-cell-frame'
```

2. Расширить интерфейс пропов:

```tsx
interface TableCellEditorProps {
  cellWidget: string
  dataType: string
  value: unknown
  readonly?: boolean
  required?: boolean
  revealErrors?: boolean
  props?: Record<string, unknown>
  onChange: (value: unknown) => void
  onCommit: () => void
}
```

3. В теле компонента (после деструктуризации пропов, до `if (readonly)`):

```tsx
const [touched, setTouched] = useState(false)
const handleCommit = () => {
  setTouched(true)
  onCommit()
}
```

4. Во ВСЕХ ветках `switch` заменить `onBlur={onCommit}` / `onCommit()` вызовы
   в редакторах на `handleCommit` (TEXT/NUMBER — `onBlur={handleCommit}` и
   `if (e.key==='Enter') handleCommit()`; DATE — `onCommit={handleCommit}`;
   CHECKBOX/ENUM — `handleCommit()` после `onChange`; REFERENCE/OBJECT —
   `onCommit={handleCommit}`).

5. Обернуть тело switch в локальную функцию и обернуть результат рамкой.
   Структура метода становится:

```tsx
if (readonly) {
  return (
    <span style={{ padding: '4px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>
      {formatReadonlyValue(value, dataType)}
    </span>
  )
}

const renderWidget = (): ReactNode => {
  switch (
    cellWidget
    // …существующие ветки без изменений, но onCommit → handleCommit…
  ) {
  }
}

const inner = renderWidget()
if (!required) return inner

const showError = isCellEmpty(value, cellWidget) && (touched || !!revealErrors)
return <RequiredCellFrame show={showError}>{inner}</RequiredCellFrame>
```

Добавить `import type { ReactNode } from 'react'` (или расширить существующий
импорт из `react`).

- [ ] **Step 7: Тест зелёный + нет регрессий по папке**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-cell-editor.test.tsx`
Expected: PASS

Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: PASS (остальные табличные тесты не сломаны).

- [ ] **Step 8: Проверить лимит строк**

Run: `wc -l src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`
Expected: < 300 (после выноса sx-констант). Если ≥300 — вынести `formatReadonlyValue`/`toDisplayString`/`resolveEnumValue` в `table-cell-editor-styles.ts` соседним хелпер-файлом.

- [ ] **Step 9: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/table-cell-editor-styles.ts \
  src/features/sdui/ui/nodes/composite/required-cell-frame.tsx \
  src/features/sdui/ui/nodes/composite/table-cell-editor.tsx \
  src/features/sdui/ui/nodes/composite/table-cell-editor.test.tsx
git commit -m "feat: required-cell red frame + tooltip in TableCellEditor (SCRUM-329)"
```

---

### Task 7: Маркер и проброс в `buildColumnDefs`

**Files:**

- Modify: `src/features/sdui/lib/utils/build-column-defs.ts`
- Create: `src/features/sdui/lib/utils/build-column-defs.test.tsx`

**Interfaces:**

- Consumes: `RequiredMark` (Task 5), `TableCellEditor` c пропами `required`/`revealErrors` (Task 6), `UseTableValidationResult` (Task 3).
- Produces: `buildColumnDefs(children, syncRef, validationRef?)` — 3-й опциональный параметр `validationRef: RefObject<UseTableValidationResult> | undefined`.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/lib/utils/build-column-defs.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { isValidElement, type RefObject } from 'react'
import { buildColumnDefs } from './build-column-defs'
import type { ViewNode } from '../../types/view'
import type { UseTableSyncResult } from '../hooks/use-table-sync'

const syncRef = {
  current: {
    rows: [],
    updateCell: () => {},
    commitCell: () => {},
    addRow: () => {},
    deleteRow: () => {},
    moveRow: () => {},
  },
} as RefObject<UseTableSyncResult>

function col(id: string, extra: Record<string, unknown>): ViewNode {
  return { id, type: 'TABLE_COLUMN', props: { label: id, ...extra } }
}

describe('buildColumnDefs — required header marker', () => {
  it('required && !readonly → header это элемент (RequiredMark), в нём «*»', () => {
    const defs = buildColumnDefs([col('c1', { required: true })], syncRef)
    const header = defs[0].header
    expect(isValidElement(header)).toBe(true)
    const { getByText } = render(header as React.ReactElement)
    expect(getByText('*')).toBeTruthy()
  })
  it('обычная колонка → header это строка-label', () => {
    const defs = buildColumnDefs([col('c2', {})], syncRef)
    expect(defs[0].header).toBe('c2')
  })
  it('required && readonly → без маркера (строка)', () => {
    const defs = buildColumnDefs(
      [col('c3', { required: true, readonly: true })],
      syncRef
    )
    expect(defs[0].header).toBe('c3')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/utils/build-column-defs.test.tsx`
Expected: FAIL — header пока всегда `col.label` (строка), `isValidElement` false.

- [ ] **Step 3: Реализовать**

В `build-column-defs.ts`:

1. Импорты:

```ts
import { RequiredMark } from '../../ui/nodes/composite/required-mark'
import type { UseTableValidationResult } from '../hooks/use-table-validation'
```

2. Сигнатура (добавить 3-й параметр и прокинуть в рекурсию):

```ts
export function buildColumnDefs(
  children: ViewNode[] | undefined,
  syncRef: RefObject<UseTableSyncResult>,
  validationRef?: RefObject<UseTableValidationResult>,
): ColumnDef<TableRow>[] {
```

В горизонтальной группе:

```ts
columns: buildColumnDefs(node.children, syncRef, validationRef),
```

3. Хелпер заголовка (рядом с `verticalSubRows`):

```ts
function columnHeader(col: TableColumnDef): ReactNode {
  return col.required && !col.readonly
    ? createElement(RequiredMark, { label: col.label })
    : col.label
}
```

4. Плоская `TABLE_COLUMN`: `header: col.label` → `header: columnHeader(col)`; в
   `createElement(TableCellEditor, { … })` добавить:

```ts
required: col.required,
revealErrors: validationRef?.current?.revealErrors ?? false,
```

5. VERTICAL-группа: `subLabels.map((col) => ({ key: col.id, content: col.label }))`
   → `content: columnHeader(col)`; в дочернем `createElement(TableCellEditor, {…})`
   добавить:

```ts
required: childCol.required,
revealErrors: validationRef?.current?.revealErrors ?? false,
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/utils/build-column-defs.test.tsx`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/utils/build-column-defs.ts src/features/sdui/lib/utils/build-column-defs.test.tsx
git commit -m "feat: required marker + validation props in buildColumnDefs (SCRUM-329)"
```

---

### Task 8: Подключить валидацию в оба редактируемых рендерера

`EditableTable` строит колонки инлайн; `ComplexEditableTable` — через `buildColumnDefs`. Оба получают `useTableValidation` + `validationRef`.

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`

**Interfaces:**

- Consumes: `useTableValidation` (Task 3), `RequiredMark` (Task 5), `buildColumnDefs(...,validationRef)` (Task 7).

- [ ] **Step 1: `EditableTable` — импорты и валидация**

В `editable-table.tsx`:

```tsx
import { RequiredMark } from './required-mark'
import { useTableValidation } from '../../../lib/hooks/use-table-validation'
```

После `const sync = useTableSync(node, columns)`:

```tsx
const validation = useTableValidation(node)
const validationRef = useRef(validation)
validationRef.current = validation
```

- [ ] **Step 2: `EditableTable` — маркер в header и пропы в cell**

В мемоизированном `tableColumns.map`:

- `header: col.label` → `header: col.required && !col.readonly ? <RequiredMark label={col.label} /> : col.label,`
- в `<TableCellEditor …>` добавить:

```tsx
required={col.required}
revealErrors={validationRef.current?.revealErrors ?? false}
```

- [ ] **Step 3: `ComplexEditableTable` — валидация и проброс**

В `complex-editable-table.tsx`:

```tsx
import { useTableValidation } from '../../../lib/hooks/use-table-validation'
```

После создания `syncRef` (там, где `const sync = useTableSync(...)`):

```tsx
const validation = useTableValidation(node)
const validationRef = useRef(validation)
validationRef.current = validation
```

Изменить вызов:

```tsx
const tableColumns = useMemo(
  () => buildColumnDefs(node.children, syncRef, validationRef),
  [node.children]
)
```

- [ ] **Step 4: Прогнать табличные тесты — нет регрессий**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/editable-table.tsx src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "feat: wire table validation into editable tables (SCRUM-329)"
```

---

### Task 9: Триггер reveal на write-командах в `dispatch`

**Files:**

- Modify: `src/features/sdui/lib/dispatch.ts`

**Interfaces:**

- Consumes: `shouldRevealTableErrors` (Task 4), `revealAllTableErrors` (Task 2).

- [ ] **Step 1: Импорты**

```ts
import { revealAllTableErrors } from './table-validation-registry'
import { shouldRevealTableErrors } from './utils/reveal-policy'
```

- [ ] **Step 2: Вызвать reveal рядом с flush**

В `dispatch.ts`, сразу ПОСЛЕ блока flush (после `if (action.type === 'COMMAND' && shouldFlush) { … }`, перед `const res = await viewTransport.post(...)`):

```ts
// SCRUM-329: на write-команде (save/post) подсветить пустые обязательные
// ячейки ТЧ — клиентский дублёр серверной 422-валидации. Сабмит не блокируем.
if (shouldRevealTableErrors(action, behavior)) {
  revealAllTableErrors()
}
```

- [ ] **Step 3: Ручная проверка сценария на dev-стенде**

Открыть форму «Регистрация заявлений по вычетам ИПН» (модуль ЗарплатаИКадры).
Ожидаемо:

- у заголовков «Вычет ИПН» (ТЧ «Вычеты ИПН») и «Размер»/«Дата начала»/«Дата окончания» (график) — «\*»;
- пустая ячейка «Вычет ИПН» после blur → красная рамка + tooltip «Обязательное поле»;
- «Записать» с пустой обязательной → все пустые обязательные (вкл. новые строки) краснеют, сервер возвращает 422 с сообщением (как раньше);
- ввод значения → рамка гаснет.

- [ ] **Step 4: Прогнать релевантные тесты**

Run: `npx vitest run src/features/sdui/lib src/features/sdui/ui/nodes/composite`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/dispatch.ts
git commit -m "feat: reveal empty required TCH cells on save/post (SCRUM-329)"
```

---

## Self-Review

**Spec coverage:**

- §3.1 «\*» в заголовке (плоская + VERTICAL) → Task 5 (RequiredMark) + Task 7 (buildColumnDefs) + Task 8 (EditableTable). ✓
- §3.2 пустота → Task 1; touched/blur + рамка+tooltip → Task 6; revealErrors на сабмите → Task 2/3/4/9; проброс → Task 7/8. ✓
- readonly без «\*»/рамки → Task 6 (early return) + Task 7 (`!col.readonly`). ✓
- visible:false отбрасывается до заголовка → уже в buildColumnDefs, отдельной задачи не нужно. ✓
- Сабмит не блокируем → Task 9 (только reveal, post уходит всегда). ✓
- Оба рендерера (Editable/Complex) → Task 8. ✓

**Placeholder scan:** плейсхолдеров нет; весь код приведён.

**Type consistency:** `isCellEmpty(value, cellWidget)`, `shouldRevealTableErrors(action, behavior)`, `useTableValidation(node): {revealErrors}`, `buildColumnDefs(children, syncRef, validationRef?)`, `RequiredMark({label})`, `RequiredCellFrame({show, children})`, `TableCellEditor` пропы `required?`/`revealErrors?` — согласованы между задачами.

## Границы

- Точечная адресация серверной ошибки до ячейки (`rowNumber`/`columnCode`) — вне скоупа.
- ReadOnlyTable/легаси не трогаем.
- `revealErrors` живёт до перемонтирования ТЧ (новый OPEN) — сознательно, сброс на успехе не делаем.
