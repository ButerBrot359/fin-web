# Movements 1C Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Фикс `validatePatches` (null-поля узлов) + паритет SDUI-движений с 1С: 1С-блок бухрегистра, колонка «N», рендер движений в workspace-вкладке вместо fullScreen Dialog.

**Architecture:** Спека — `docs/superpowers/specs/2026-07-08-movements-1c-parity-design.md`. Блок A — точечный zod-фикс. Блок B — новая пара файлов (чистая логика + React-раскладка, скопированная из легаси без импортов). Блок C — флаг `showRowNumbers` в `ReadOnlyTable`. Блок D — новый `workspace-tab-gateway` в SDUI, generic-расширение `workspace-tabs` («панельные» вкладки), связка на app-уровне.

**Tech Stack:** React 19, TypeScript 5.9, zod, zustand (+persist), MUI Typography, TailwindCSS, vitest + @testing-library/react.

**Branch:** `feat/movements-1c-parity` (уже создана от `dev`, спека закоммичена).

## Global Constraints

- Новые файлы: цель ~200 строк, жёсткий потолок 300. Один файл — одна ответственность.
- SDUI (`src/features/sdui/`) не импортирует легаси и `features/workspace-tabs`; workspace-tabs не знает про SDUI. Единственный мост — gateway (образец `src/features/sdui/lib/reference-picker-gateway.ts`). app-уровень (`src/app/`) знает обе зоны.
- Из легаси (`src/pages/documents/document-movements/`) раскладку **копируем**, не импортируем. Сам легаси не трогаем.
- Бэк готов (§5 исходной спеки задеплоен): `regKind` на TABLE, `_period` с секундами (уже отформатирован строкой `dd.MM.yyyy HH:mm:ss`), `showRowNumbers`, строки панели в `childState` эффекта `openDialog`. **Фолбэков на старый контракт не делаем.**
- Тексты в JSX — только `useTranslation` + ключи `common.json` (ru/kz), текстовые элементы — `<Typography>`. Ключ «N» уже существует: `table.rowNumber` (ru: `"N"`, kz: `"N"`) — новые ключи не нужны.
- Без `useMemo`/`useCallback` без явной перф-причины.
- Формат коммитов: `feat|fix|add|refactor: описание` (commit-msg hook).
- НЕ запускать `tsc --noEmit`/`npm run lint`/`npm run build` после каждого изменения — только точечные vitest-прогоны; полная сборка один раз в Task 11.
- Barrel-экспорты только на уровне слайса (`src/features/<slice>/index.ts`).
- Суммы: `formatWithSpaces` из `@/shared/lib/utils/format-cell-value` (`"12345.00"` → `"12 345,00"`).

---

### Task 1: Блок A — `validatePatches` принимает null-поля узлов

**Files:**
- Modify: `src/features/sdui/lib/validation.ts:5-23`
- Test: `src/features/sdui/lib/validation.test.ts`

**Interfaces:**
- Consumes: существующие `viewNodeSchema`/`viewPatchSchema`/`validatePatches`.
- Produces: `validatePatches` пропускает `insertNode`/`replaceNode`, чей `node` содержит `binding:null`, `value:null`, `props:null`, `actions:null`, `children:null`, `action.command:null`. Сигнатура не меняется.

Контекст: бэк (Jackson) сериализует узлы с ЯВНЫМИ `null`, а `.optional()` в zod принимает `undefined`, но не `null` → весь патч отбрасывается с `console.warn('[sdui] malformed patch')`. Детали: `docs/superpowers/plans/frontend-handoff-2026-07-07-validatepatches-drops-insertnode.md`.

- [ ] **Step 1: Написать падающий тест**

Добавить в конец `describe('validatePatches', …)` в `src/features/sdui/lib/validation.test.ts`:

```ts
  it('пропускает insertNode/replaceNode с явными null-полями узла (Jackson)', () => {
    const nodeWithNulls = {
      id: 'label.ispolneno',
      type: 'LABEL',
      props: { variant: 'heading', text: 'Заявка исполнена на 1000.00 из 1000.00' },
      binding: null,
      value: null,
      children: null,
      actions: null,
    }
    const patches = [
      { op: 'insertNode', parentId: 'body', index: 2, node: nodeWithNulls },
      { op: 'replaceNode', nodeId: 'label.ispolneno', node: nodeWithNulls },
    ]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validatePatches(patches)).toHaveLength(2)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/validation.test.ts`
Expected: новый тест FAIL (`toHaveLength(2)` получает 0), два старых PASS.

- [ ] **Step 3: Фикс схемы**

Заменить в `src/features/sdui/lib/validation.ts` весь блок `viewNodeSchema` (строки 5-23) на код из handoff-дока §3 (дословно):

```ts
const viewNodeSchema: z.ZodType<ViewNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    // Бэк (Jackson) сериализует узлы с ЯВНЫМИ null (binding:null, children:null,
    // actions:null, ...), а не с отсутствующими полями. Базовый tree идёт через setRoot
    // без валидации, но узлы внутри insertNode/replaceNode-патчей валидируются здесь —
    // поэтому optional-поля должны принимать И null (.nullish), иначе весь патч молча
    // отбрасывается как malformed (напр. insertNode label.ispolneno не вставлялся).
    binding: z.string().nullish(),
    value: z.unknown().nullish(),
    props: z.record(z.string(), z.unknown()).nullish(),
    actions: z
      .array(
        z.object({
          trigger: z.string(),
          actionId: z.string(),
          command: z.string().nullish(),
        }),
      )
      .nullish(),
    children: z.array(viewNodeSchema).nullish(),
  }),
) as z.ZodType<ViewNode>
```

Схемы патчей (`viewPatchSchema`) и `patch-applier.ts` НЕ трогать.

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run src/features/sdui/lib/validation.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/validation.ts src/features/sdui/lib/validation.test.ts
git commit -m "fix: validatePatches принимает null-поля узлов в insertNode/replaceNode"
```

---

### Task 2: Блок B — чистая логика 1С-блока (`accounting-block-logic.ts`)

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/accounting-block-logic.ts`
- Test: `src/features/sdui/ui/nodes/composite/accounting-block-logic.test.ts`

**Interfaces:**
- Consumes: `formatWithSpaces(raw: string): string` из `@/shared/lib/utils/format-cell-value`; тип `ViewNode` из `../../../types/view`.
- Produces (Task 3 использует ровно эти имена):
  - `interface AccountingRow { rowId: string; [key: string]: unknown }`
  - `interface BlockRowDef { subDt; subKt; a1Dt; a1Kt; a2Dt; a2Kt: string }`
  - `const ROW_LAYOUT: BlockRowDef[]` (3 строки)
  - `resolveCellValue(v: unknown): string`
  - `formatSum(v: unknown): string`
  - `collectColumnLabels(tableNode: ViewNode): Map<string, string>`
  - `collectGroupLabels(tableNode: ViewNode): string[]`
  - `getBlockRowCount(rows: AccountingRow[]): number`
  - `buildRowDefs(rowCount: number): BlockRowDef[]`

Контракт данных (бэк, `buildAccountingRows`): строка проводки — плоская Map по binding. Ссылочная ячейка — `{ id, presentation, entityRef }`, пустая — `""` (не null). Ключи: `rowId`, `_period` (строка `dd.MM.yyyy HH:mm:ss`), `_accountDtCode`/`_accountKtCode`, `_summa` (`"12345.00"`), `_soderzhanie`, `_kolichestvo`, `_subkontoDt1..N`/`_subkontoKt1..N`, `_fkrDt/Kt`, `_spetsifikaDt/Kt`, `_istochnikFinansirovaniyaDt/Kt`, `_podrazdelenieDt/Kt`, `_kodPlatnykhUslugDt/Kt`. Игнорируются: `_isActive`, `_isActiveLabel`, `_valyutnayaSumma`, `_organizatsiya`.

- [ ] **Step 1: Написать падающие тесты**

Создать `src/features/sdui/ui/nodes/composite/accounting-block-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../types/view'
import {
  ROW_LAYOUT,
  buildRowDefs,
  collectColumnLabels,
  collectGroupLabels,
  formatSum,
  getBlockRowCount,
  resolveCellValue,
} from './accounting-block-logic'

describe('resolveCellValue', () => {
  it('ссылочная ячейка → presentation', () => {
    expect(
      resolveCellValue({ id: 5, presentation: 'Касса', entityRef: { id: 5 } }),
    ).toBe('Касса')
  })
  it('пусто → пустая строка', () => {
    expect(resolveCellValue('')).toBe('')
    expect(resolveCellValue(null)).toBe('')
    expect(resolveCellValue(undefined)).toBe('')
    expect(resolveCellValue({})).toBe('')
  })
  it('строка как есть (коды счетов и даты не форматируются)', () => {
    expect(resolveCellValue('1080')).toBe('1080')
    expect(resolveCellValue('07.07.2026 10:15:30')).toBe('07.07.2026 10:15:30')
  })
  it('число → разряды пробелами', () => {
    expect(resolveCellValue(12345)).toBe('12 345')
  })
})

describe('formatSum', () => {
  it('"12345.00" → "12 345,00"', () => {
    expect(formatSum('12345.00')).toBe('12 345,00')
  })
  it('пусто → ""', () => {
    expect(formatSum('')).toBe('')
    expect(formatSum(null)).toBe('')
    expect(formatSum(undefined)).toBe('')
  })
})

describe('collectColumnLabels / collectGroupLabels', () => {
  const table = {
    id: 'tbl',
    type: 'TABLE',
    children: [
      { id: 'c.period', type: 'TABLE_COLUMN', binding: '_period', props: { label: 'Дата' } },
      {
        id: 'g.dt',
        type: 'COLUMN_GROUP',
        props: { label: 'ДЕБЕТ' },
        children: [
          { id: 'c.accDt', type: 'TABLE_COLUMN', binding: '_accountDtCode', props: { label: 'Счёт' } },
          { id: 'c.subDt1', type: 'TABLE_COLUMN', binding: '_subkontoDt1', props: { label: 'КПС' } },
        ],
      },
      {
        id: 'g.kt',
        type: 'COLUMN_GROUP',
        props: { label: 'КРЕДИТ' },
        children: [
          { id: 'c.accKt', type: 'TABLE_COLUMN', binding: '_accountKtCode', props: { label: 'Счёт' } },
        ],
      },
    ],
  } as ViewNode

  it('собирает binding → label по листьям, включая вложенные в группы', () => {
    const labels = collectColumnLabels(table)
    expect(labels.get('_period')).toBe('Дата')
    expect(labels.get('_subkontoDt1')).toBe('КПС')
    expect(labels.get('_accountKtCode')).toBe('Счёт')
  })

  it('метки групп верхнего уровня в порядке документа', () => {
    expect(collectGroupLabels(table)).toEqual(['ДЕБЕТ', 'КРЕДИТ'])
  })
})

describe('getBlockRowCount / buildRowDefs', () => {
  it('минимум 3 строки', () => {
    expect(getBlockRowCount([])).toBe(3)
    expect(getBlockRowCount([{ rowId: '1', _subkontoDt1: '' }])).toBe(3)
  })
  it('расширяется по фактическому max индексу субконто', () => {
    expect(getBlockRowCount([{ rowId: '1', _subkontoKt4: '' }])).toBe(4)
  })
  it('строки 1-3 из ROW_LAYOUT, дальше — только субконто', () => {
    const defs = buildRowDefs(4)
    expect(defs.slice(0, 3)).toEqual(ROW_LAYOUT)
    expect(defs[3]).toEqual({
      subDt: '_subkontoDt4',
      subKt: '_subkontoKt4',
      a1Dt: '',
      a1Kt: '',
      a2Dt: '',
      a2Kt: '',
    })
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/accounting-block-logic.test.ts`
Expected: FAIL — модуль `./accounting-block-logic` не найден.

- [ ] **Step 3: Реализация**

Создать `src/features/sdui/ui/nodes/composite/accounting-block-logic.ts`:

```ts
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type { ViewNode } from '../../../types/view'

// Чистая логика 1С-блока проводок бухрегистра (без React).
// Контракт данных — buildAccountingRows (бэк, MovementsComposer): строка
// проводки — плоская Map по binding. Ссылочная ячейка — { id, presentation,
// entityRef }, пустая — "" (не null).

export interface SduiCellObject {
  id?: number | string
  presentation?: string
  entityRef?: { domain?: string; id?: number | string; presentation?: string }
}

export interface AccountingRow {
  rowId: string
  [key: string]: unknown
}

// Раскладка 1С-блока по строкам (§1.3 спеки), side-specific ключи:
//  строка 1: Субконто1 · ФКР · Подразделение
//  строка 2: Субконто2 · Специфика · Количество
//  строка 3: Субконто3 · Источник финансирования · Код платных услуг
export interface BlockRowDef {
  subDt: string
  subKt: string
  a1Dt: string
  a1Kt: string
  a2Dt: string
  a2Kt: string
}

export const ROW_LAYOUT: BlockRowDef[] = [
  {
    subDt: '_subkontoDt1',
    subKt: '_subkontoKt1',
    a1Dt: '_fkrDt',
    a1Kt: '_fkrKt',
    a2Dt: '_podrazdelenieDt',
    a2Kt: '_podrazdelenieKt',
  },
  {
    subDt: '_subkontoDt2',
    subKt: '_subkontoKt2',
    a1Dt: '_spetsifikaDt',
    a1Kt: '_spetsifikaKt',
    a2Dt: '_kolichestvo',
    a2Kt: '_kolichestvo',
  },
  {
    subDt: '_subkontoDt3',
    subKt: '_subkontoKt3',
    a1Dt: '_istochnikFinansirovaniyaDt',
    a1Kt: '_istochnikFinansirovaniyaKt',
    a2Dt: '_kodPlatnykhUslugDt',
    a2Kt: '_kodPlatnykhUslugKt',
  },
]

/** Ссылочная ячейка → presentation; число → разряды; строка как есть; пусто → ''. */
export function resolveCellValue(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'object') {
    return (v as SduiCellObject).presentation ?? ''
  }
  if (typeof v === 'number') return formatWithSpaces(String(v))
  return String(v)
}

/** Сумма/количество: бэк шлёт "12345.00" (toPlainString) → "12 345,00". */
export function formatSum(v: unknown): string {
  if (v == null || v === '') return ''
  return formatWithSpaces(String(v))
}

/** binding → props.label по листьям TABLE_COLUMN (включая вложенные в COLUMN_GROUP). */
export function collectColumnLabels(tableNode: ViewNode): Map<string, string> {
  const map = new Map<string, string>()
  const visit = (n: ViewNode): void => {
    if (n.type === 'TABLE_COLUMN') {
      const binding = n.binding ?? (n.props?.binding as string | undefined) ?? n.id
      map.set(binding, (n.props?.label as string | undefined) ?? '')
      return
    }
    if (n.type === 'COLUMN_GROUP') (n.children ?? []).forEach(visit)
  }
  ;(tableNode.children ?? []).forEach(visit)
  return map
}

/** Метки COLUMN_GROUP верхнего уровня в порядке документа (ДЕБЕТ, КРЕДИТ). */
export function collectGroupLabels(tableNode: ViewNode): string[] {
  return (tableNode.children ?? [])
    .filter((c) => c.type === 'COLUMN_GROUP')
    .map((c) => (c.props?.label as string | undefined) ?? '')
}

const SUBKONTO_RE = /^_subkonto(?:Dt|Kt)(\d+)$/

/** Число строк блока: max(3, фактический max индекс субконто в данных). */
export function getBlockRowCount(rows: AccountingRow[]): number {
  let max = 3
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const m = SUBKONTO_RE.exec(key)
      if (m) max = Math.max(max, Number(m[1]))
    }
  }
  return max
}

/** Дефиниции строк блока: 1-3 из ROW_LAYOUT, дальше — только субконто. */
export function buildRowDefs(rowCount: number): BlockRowDef[] {
  return Array.from(
    { length: rowCount },
    (_, r) =>
      ROW_LAYOUT[r] ?? {
        subDt: `_subkontoDt${r + 1}`,
        subKt: `_subkontoKt${r + 1}`,
        a1Dt: '',
        a1Kt: '',
        a2Dt: '',
        a2Kt: '',
      },
  )
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/accounting-block-logic.test.ts`
Expected: PASS (все кейсы).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/accounting-block-logic.ts src/features/sdui/ui/nodes/composite/accounting-block-logic.test.ts
git commit -m "add: логика 1С-блока проводок бухрегистра (SDUI)"
```

---

### Task 3: Блок B — компонент `AccountingPostingsBlock` + ветка в `TableNode`

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/accounting-postings-block.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx:161-162` (read-only ветка)
- Test: `src/features/sdui/ui/nodes/composite/accounting-postings-block.test.tsx`

**Interfaces:**
- Consumes: всё из Task 2 (`AccountingRow`, `BlockRowDef`, `buildRowDefs`, `collectColumnLabels`, `collectGroupLabels`, `formatSum`, `getBlockRowCount`, `resolveCellValue`); `useSduiSession().getValue(binding)` (строки из view-state); `cn` из `@/shared/lib/utils/cn`; тип `NodeProps` из `../../../types/view`; i18n-ключ `table.rowNumber`.
- Produces: `export const AccountingPostingsBlock: ({ node }: NodeProps) => JSX` — рендерится из `TableNode` при `node.props.regKind === 'ACCOUNTING'`.

Раскладка СКОПИРОВАНА из легаси `src/pages/documents/document-movements/ui/accounting-postings-table.tsx` (никаких импортов из легаси — правило изоляции CLAUDE.md; легаси-файл будет удалён вместе с легаси). Отличия от легаси: метки шапки из дерева колонок (не из `group.columns`), side-specific ключи аналитики, `_period` уже отформатирован бэком (рендер как есть), высота блока динамическая (`getBlockRowCount`), Активность не рисуем.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/ui/nodes/composite/accounting-postings-block.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { AccountingPostingsBlock } from './accounting-postings-block'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const table = {
  id: 'tbl',
  type: 'TABLE',
  binding: 'movements.acc.Zhurnal',
  props: { regKind: 'ACCOUNTING', editable: false },
  children: [
    { id: 'c.period', type: 'TABLE_COLUMN', binding: '_period', props: { label: 'Дата' } },
    {
      id: 'g.dt',
      type: 'COLUMN_GROUP',
      props: { label: 'ДЕБЕТ' },
      children: [
        { id: 'c.accDt', type: 'TABLE_COLUMN', binding: '_accountDtCode', props: { label: 'Счёт' } },
        { id: 'c.subDt1', type: 'TABLE_COLUMN', binding: '_subkontoDt1', props: { label: 'КПС' } },
      ],
    },
    {
      id: 'g.kt',
      type: 'COLUMN_GROUP',
      props: { label: 'КРЕДИТ' },
      children: [
        { id: 'c.accKt', type: 'TABLE_COLUMN', binding: '_accountKtCode', props: { label: 'Счёт' } },
      ],
    },
    { id: 'c.summa', type: 'TABLE_COLUMN', binding: '_summa', props: { label: 'Сумма' } },
    { id: 'c.sod', type: 'TABLE_COLUMN', binding: '_soderzhanie', props: { label: 'Содержание' } },
  ],
} as ViewNode

describe('AccountingPostingsBlock', () => {
  it('рендерит 1С-блок: группы, N, сумму с разрядами, секунды, 3 строки на проводку', () => {
    state['movements.acc.Zhurnal'] = [
      {
        rowId: '1',
        _period: '07.07.2026 10:15:30',
        _accountDtCode: '1080',
        _accountKtCode: '3010',
        _summa: '12345.00',
        _soderzhanie: 'Оплата',
        _subkontoDt1: { id: 1, presentation: 'КПС-111' },
        _isActiveLabel: 'Да',
      },
    ]

    const { container } = render(<AccountingPostingsBlock node={table} />)

    expect(screen.getByText('ДЕБЕТ')).toBeTruthy()
    expect(screen.getByText('КРЕДИТ')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy() // N = idx + 1
    expect(screen.getByText('07.07.2026 10:15:30')).toBeTruthy() // период с секундами как есть
    expect(screen.getByText('12 345,00')).toBeTruthy() // формат суммы
    expect(screen.getByText('КПС-111')).toBeTruthy() // презентация субконто
    expect(screen.queryByText('Да')).toBeNull() // Активность не рисуем (§1.5)
    // проводка — <tbody> из 3 строк
    const tbody = container.querySelector('tbody')
    expect(tbody?.querySelectorAll('tr')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/accounting-postings-block.test.tsx`
Expected: FAIL — модуль `./accounting-postings-block` не найден.

- [ ] **Step 3: Реализация компонента**

Создать `src/features/sdui/ui/nodes/composite/accounting-postings-block.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import {
  type AccountingRow,
  type BlockRowDef,
  buildRowDefs,
  collectColumnLabels,
  collectGroupLabels,
  formatSum,
  getBlockRowCount,
  resolveCellValue,
} from './accounting-block-logic'

// Журнал проводок бухрегистра в раскладке 1С. Раскладка СКОПИРОВАНА из легаси
// accounting-postings-table.tsx (импортов из легаси нет — правило изоляции):
// проводка — блок из N строк (обычно 3), аналитика Дт/Кт в двух группах
// колонок, метки полей — в многорядной шапке, в строках только значения.
// Метки шапки — из props.label листьев дерева колонок TABLE (бэк резолвит).

const thBase =
  'whitespace-nowrap px-3 py-1.5 text-left text-[11px] font-semibold uppercase text-ui-06 align-bottom'
const cellPad = 'px-3 py-1.5 align-top'
const bl = 'border-l border-ui-04'

const Val = ({ value, numeric }: { value: string; numeric?: boolean }) => (
  <Typography
    variant="body2"
    noWrap
    className={cn('truncate text-ui-06', numeric && 'text-right tabular-nums')}
  >
    {value}
  </Typography>
)

export const AccountingPostingsBlock = ({ node }: NodeProps) => {
  const { t } = useTranslation()
  const { getValue } = useSduiSession()

  const rows = (getValue(node.binding) as AccountingRow[] | undefined) ?? []
  const labels = collectColumnLabels(node)
  const groups = collectGroupLabels(node)
  const rowDefs = buildRowDefs(getBlockRowCount(rows))

  const label = (binding: string) => labels.get(binding) ?? ''
  const headSpan = 1 + rowDefs.length

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-ui-04">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          {/* Ряд 1 — группы ДЕБЕТ / КРЕДИТ. */}
          <tr className="border-b border-ui-04">
            <th rowSpan={headSpan} className={cn(thBase, 'text-center')}>
              {t('table.rowNumber')}
            </th>
            <th rowSpan={headSpan} className={thBase}>
              {label('_period')}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {groups[0] ?? ''}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {groups[1] ?? ''}
            </th>
            <th rowSpan={headSpan} className={cn(thBase, bl, 'text-right')}>
              {label('_summa')}
            </th>
            <th rowSpan={headSpan} className={cn(thBase, bl)}>
              {label('_soderzhanie')}
            </th>
          </tr>
          {/* Ряды 2..N+1 — метки субконто/аналитики построчно, как в 1С. */}
          {rowDefs.map((rd, r) => (
            <tr
              key={r}
              className={r === rowDefs.length - 1 ? 'border-b border-ui-04' : undefined}
            >
              {r === 0 && (
                <th rowSpan={rowDefs.length} className={cn(thBase, bl)}>
                  {label('_accountDtCode')}
                </th>
              )}
              <th className={thBase}>{label(rd.subDt)}</th>
              <th className={thBase}>{rd.a1Dt ? label(rd.a1Dt) : ''}</th>
              <th className={thBase}>{rd.a2Dt ? label(rd.a2Dt) : ''}</th>
              {r === 0 && (
                <th rowSpan={rowDefs.length} className={cn(thBase, bl)}>
                  {label('_accountKtCode')}
                </th>
              )}
              <th className={thBase}>{label(rd.subKt)}</th>
              <th className={thBase}>{rd.a1Kt ? label(rd.a1Kt) : ''}</th>
              <th className={thBase}>{rd.a2Kt ? label(rd.a2Kt) : ''}</th>
            </tr>
          ))}
        </thead>
        {/* Каждая проводка — отдельный <tbody class="group"> для hover всего блока. */}
        {rows.map((row, idx) => (
          <tbody key={row.rowId} className="group">
            {rowDefs.map((rd, r) => (
              <BlockRow
                key={r}
                row={row}
                rd={rd}
                first={r === 0}
                blockHeight={rowDefs.length}
                zebra={idx % 2 === 1}
                num={idx + 1}
              />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

interface BlockRowProps {
  row: AccountingRow
  rd: BlockRowDef
  first: boolean
  blockHeight: number
  zebra: boolean
  num: number
}

const BlockRow = ({ row, rd, first, blockHeight, zebra, num }: BlockRowProps) => {
  const numeric = rd.a2Dt === '_kolichestvo' // строка с «Количество»
  const a2 = (key: string) =>
    key === '_kolichestvo' ? formatSum(row[key]) : resolveCellValue(row[key])

  return (
    <tr
      className={cn(
        zebra && 'bg-ui-02/40',
        'group-hover:bg-ui-07',
        first && 'border-t-2 border-ui-04',
      )}
    >
      {first && (
        <>
          <td rowSpan={blockHeight} className={cn(cellPad, 'text-center text-ui-06')}>
            {num}
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, 'whitespace-nowrap text-ui-06')}>
            <Typography variant="body2" noWrap className="text-ui-06">
              {resolveCellValue(row._period)}
            </Typography>
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
            <Typography variant="body2" noWrap className="font-bold text-ui-06">
              {resolveCellValue(row._accountDtCode)}
            </Typography>
          </td>
        </>
      )}
      {/* Дебет: субконто / аналитика1 / аналитика2 */}
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={resolveCellValue(row[rd.subDt])} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a1Dt ? resolveCellValue(row[rd.a1Dt]) : ''} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a2Dt ? a2(rd.a2Dt) : ''} numeric={numeric} />
      </td>
      {first && (
        <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
          <Typography variant="body2" noWrap className="font-bold text-ui-06">
            {resolveCellValue(row._accountKtCode)}
          </Typography>
        </td>
      )}
      {/* Кредит: субконто / аналитика1 / аналитика2 */}
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={resolveCellValue(row[rd.subKt])} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a1Kt ? resolveCellValue(row[rd.a1Kt]) : ''} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a2Kt ? a2(rd.a2Kt) : ''} numeric={numeric} />
      </td>
      {first && (
        <>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'text-right align-middle')}>
            <Typography variant="body2" noWrap className="font-bold text-ui-06">
              {formatSum(row._summa)}
            </Typography>
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
            <Typography variant="body2" className="text-ui-06">
              {resolveCellValue(row._soderzhanie)}
            </Typography>
          </td>
        </>
      )}
    </tr>
  )
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/accounting-postings-block.test.tsx`
Expected: PASS.

- [ ] **Step 5: Ветка в TableNode**

В `src/features/sdui/ui/nodes/composite/table-node.tsx`:

1. Добавить импорт после `import { ComplexEditableTable } from './complex-editable-table'`:

```ts
import { AccountingPostingsBlock } from './accounting-postings-block'
```

2. Заменить строки 161-162:

```tsx
  // Read-only path (preserved as-is)
  return <ReadOnlyTable node={node} />
```

на:

```tsx
  // Read-only path: бухрегистр — 1С-блок, остальные — прежняя таблица
  if (node.props?.regKind === 'ACCOUNTING') {
    return <AccountingPostingsBlock node={node} />
  }
  return <ReadOnlyTable node={node} />
```

- [ ] **Step 6: Регресс существующих тестов таблицы**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: все PASS (table-node.test.ts, object-field-logic.test.ts, accounting-block-logic.test.ts, accounting-postings-block.test.tsx).

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/accounting-postings-block.tsx src/features/sdui/ui/nodes/composite/accounting-postings-block.test.tsx src/features/sdui/ui/nodes/composite/table-node.tsx
git commit -m "feat: 1С-блок проводок бухрегистра в SDUI-движениях"
```

---

### Task 4: Блок C — колонка «N» в `ReadOnlyTable` по флагу `showRowNumbers`

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx` (компонент `ReadOnlyTable`, строки 165-287)
- Test: `src/features/sdui/ui/nodes/composite/read-only-table.test.tsx` (создать)

**Interfaces:**
- Consumes: `node.props.showRowNumbers === true` (бэк проставляет на таблицах движений, §5.3 готов); i18n-ключ `table.rowNumber`.
- Produces: generic-механизм для любой read-only таблицы; без флага DOM байт-в-байт прежний.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/ui/nodes/composite/read-only-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

const makeTable = (props: Record<string, unknown>): ViewNode =>
  ({
    id: 'tbl',
    type: 'TABLE',
    binding: 'rows',
    props: { editable: false, ...props },
    children: [
      { id: 'c.a', type: 'TABLE_COLUMN', binding: 'a', props: { label: 'A' } },
    ],
  }) as ViewNode

beforeEach(() => {
  delete state.rows
})

describe('ReadOnlyTable showRowNumbers', () => {
  it('с флагом рендерит ведущую колонку N со значениями 1..n', () => {
    state.rows = [
      { rowId: 'r1', a: 'x' },
      { rowId: 'r2', a: 'y' },
    ]
    render(<TableNode node={makeTable({ showRowNumbers: true })} />)
    expect(screen.getByText('table.rowNumber')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('без флага колонки N нет', () => {
    state.rows = [{ rowId: 'r1', a: 'x' }]
    render(<TableNode node={makeTable({})} />)
    expect(screen.queryByText('table.rowNumber')).toBeNull()
  })
})
```

- [ ] **Step 2: Убедиться, что первый кейс падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/read-only-table.test.tsx`
Expected: кейс «с флагом…» FAIL (нет `table.rowNumber`), кейс «без флага…» PASS.

- [ ] **Step 3: Реализация в ReadOnlyTable**

В `src/features/sdui/ui/nodes/composite/table-node.tsx`, компонент `ReadOnlyTable`, три точечных правки:

1. После `const allowDelete = …` (строка ~169) добавить:

```ts
  const showRowNumbers = node.props?.showRowNumbers === true
```

2. В `<TableHead>` в первом `<TableRow>` ПЕРЕД `{headerModel.topRow.map(…)}` добавить:

```tsx
              {showRowNumbers && (
                <TableCell
                  align="center"
                  rowSpan={headerModel.hasGroups ? 2 : undefined}
                  sx={{ width: 48 }}
                >
                  {t('table.rowNumber')}
                </TableCell>
              )}
```

3. В `<TableBody>`:
   - в пустом состоянии заменить `colSpan={columns.length + (allowDelete ? 1 : 0)}` на `colSpan={columns.length + (allowDelete ? 1 : 0) + (showRowNumbers ? 1 : 0)}`;
   - заменить `rows.map((row) => (` на `rows.map((row, idx) => (` и первой ячейкой строки добавить:

```tsx
                  {showRowNumbers && (
                    <TableCell align="center">{idx + 1}</TableCell>
                  )}
```

- [ ] **Step 4: Тесты зелёные + регресс composite**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: все PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/read-only-table.test.tsx
git commit -m "feat: колонка N в read-only SDUI-таблицах по флагу showRowNumbers"
```

---

### Task 5: Блок D-1 — `workspace-tab-gateway` (SDUI владеет интерфейсом)

**Files:**
- Create: `src/features/sdui/lib/workspace-tab-gateway.ts`
- Modify: `src/features/sdui/index.ts` (barrel слайса)
- Test: `src/features/sdui/lib/workspace-tab-gateway.test.ts`

**Interfaces:**
- Consumes: ничего (module-level state, образец — `reference-picker-gateway.ts`).
- Produces (Tasks 7 и 10 используют ровно эти имена):
  - `interface OpenPanelTabParams { tabKey: string; title: string; panelId: string }`
  - `interface WorkspaceTabGatewayImpl { openPanelTab: (params: OpenPanelTabParams) => void }`
  - `setWorkspaceTabGateway(g: WorkspaceTabGatewayImpl | null): void`
  - `openPanelTab(params: OpenPanelTabParams): boolean` — `false` + `console.warn`, если impl не зарегистрирован (вызывающая сторона откатывается на fullScreen Dialog).
  - Barrel-экспорты: `setWorkspaceTabGateway`, `openPanelTab`, типы, а также `usePanelStore` (нужен app-биндингу в Task 10).

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/lib/workspace-tab-gateway.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openPanelTab, setWorkspaceTabGateway } from './workspace-tab-gateway'

describe('workspace-tab-gateway', () => {
  afterEach(() => setWorkspaceTabGateway(null))

  it('зовёт зарегистрированную реализацию и возвращает true', () => {
    const impl = { openPanelTab: vi.fn() }
    setWorkspaceTabGateway(impl)
    const params = { tabKey: 'movements:1', title: 'Движения', panelId: 'p1' }
    expect(openPanelTab(params)).toBe(true)
    expect(impl.openPanelTab).toHaveBeenCalledWith(params)
  })

  it('без реализации — warn и false (фолбэк на Dialog)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(openPanelTab({ tabKey: 'k', title: 't', panelId: 'p' })).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/workspace-tab-gateway.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

Создать `src/features/sdui/lib/workspace-tab-gateway.ts`:

```ts
export interface OpenPanelTabParams {
  tabKey: string // стабильный id вкладки, напр. "movements:123" (props.tabKey с бэка)
  title: string // из props.title узла панели
  panelId: string // id PanelEntry в panel-store
}

export interface WorkspaceTabGatewayImpl {
  openPanelTab: (params: OpenPanelTabParams) => void
}

let gateway: WorkspaceTabGatewayImpl | null = null

// SDUI не знает про реализацию workspace-вкладок (features/workspace-tabs).
// Хост-приложение регистрирует реализацию на своём уровне (app/).
export function setWorkspaceTabGateway(g: WorkspaceTabGatewayImpl | null): void {
  gateway = g
}

// false — если impl не зарегистрирован: вызывающая сторона (dispatch.openDialog)
// откатывается на прежний fullScreen Dialog, функциональность не теряется.
export function openPanelTab(params: OpenPanelTabParams): boolean {
  if (!gateway) {
    console.warn('[sdui] workspace-tab gateway is not bound, falling back to dialog')
    return false
  }
  gateway.openPanelTab(params)
  return true
}
```

- [ ] **Step 4: Barrel-экспорты**

В `src/features/sdui/index.ts` добавить в конец:

```ts
export { setWorkspaceTabGateway, openPanelTab } from './lib/workspace-tab-gateway'
export type { OpenPanelTabParams, WorkspaceTabGatewayImpl } from './lib/workspace-tab-gateway'
export { usePanelStore } from './lib/stores/panel-store'
```

- [ ] **Step 5: Тесты зелёные**

Run: `npx vitest run src/features/sdui/lib/workspace-tab-gateway.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/lib/workspace-tab-gateway.ts src/features/sdui/lib/workspace-tab-gateway.test.ts src/features/sdui/index.ts
git commit -m "add: workspace-tab gateway в SDUI"
```

---

### Task 6: Блок D-2 — панельные вкладки в `features/workspace-tabs` (generic, без знания о SDUI)

**Files:**
- Modify: `src/features/workspace-tabs/types/workspace-tab.ts`
- Modify: `src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.ts`
- Create: `src/features/workspace-tabs/lib/panel-tab-close-registry.ts`
- Modify: `src/features/workspace-tabs/index.ts`
- Test: `src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.test.ts` (создать)

**Interfaces:**
- Consumes: существующие `WorkspaceTab`, `MAX_TABS`, `updateTab`.
- Produces (Tasks 8-10 используют ровно эти имена):
  - `TabPageType` + вариант `'sdui-panel'`; `WorkspaceTab.panelId?: string`
  - `activateOrCreatePanel(id: string, title: string, panelId: string): void` в сторе
  - `onPanelTabClose(cb: (panelId: string) => void): () => void` (подписка, возвращает unsubscribe)
  - `notifyPanelTabClose(panelId: string): void`
  - Панельные вкладки НЕ попадают в sessionStorage-персист (контент in-memory, reload не переживает — иначе осиротевшая вкладка).

- [ ] **Step 1: Написать падающие тесты**

Создать `src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyPanelTabClose, onPanelTabClose } from '../panel-tab-close-registry'
import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

beforeEach(() => {
  sessionStorage.clear()
  useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
})

describe('activateOrCreatePanel', () => {
  it('создаёт панельную вкладку без маршрута и активирует её', () => {
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p1')
    const s = useWorkspaceTabsStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]).toMatchObject({
      id: 'movements:1',
      path: '',
      search: '',
      title: 'Движения',
      pageType: 'sdui-panel',
      panelId: 'p1',
    })
    expect(s.activeTabId).toBe('movements:1')
  })

  it('повторный вызов с тем же tabKey переиспользует вкладку и обновляет panelId', () => {
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p1')
    useWorkspaceTabsStore.getState().activateOrCreate('/modules/x', '', 'module')
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p2')
    const s = useWorkspaceTabsStore.getState()
    expect(s.tabs.filter((t) => t.id === 'movements:1')).toHaveLength(1)
    expect(s.tabs.find((t) => t.id === 'movements:1')?.panelId).toBe('p2')
    expect(s.activeTabId).toBe('movements:1')
  })
})

describe('персист панельных вкладок', () => {
  it('sdui-panel вкладки не попадают в снимок; activeTabId-панель сбрасывается в null', () => {
    useWorkspaceTabsStore.getState().activateOrCreate('/modules/x', '', 'module')
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p1')
    const raw = sessionStorage.getItem('workspace-tabs')
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw!) as {
      state: { tabs: { id: string }[]; activeTabId: string | null }
    }
    expect(persisted.state.tabs.map((t) => t.id)).toEqual(['/modules/x'])
    expect(persisted.state.activeTabId).toBeNull()
  })
})

describe('panel-tab-close-registry', () => {
  it('уведомляет подписчиков и отписывает', () => {
    const cb = vi.fn()
    const unsubscribe = onPanelTabClose(cb)
    notifyPanelTabClose('p1')
    expect(cb).toHaveBeenCalledWith('p1')
    unsubscribe()
    notifyPanelTabClose('p2')
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.test.ts`
Expected: FAIL — нет модуля `panel-tab-close-registry`, нет `activateOrCreatePanel`.

- [ ] **Step 3: Тип вкладки**

В `src/features/workspace-tabs/types/workspace-tab.ts`:

1. В union `TabPageType` добавить последним вариантом:

```ts
  | 'sdui-panel'
```

2. В `WorkspaceTab` добавить поле:

```ts
  // Только для pageType 'sdui-panel': id панели в сторе владельца контента (SDUI).
  // Панельные вкладки не маршрутные: path = '', search = ''.
  panelId?: string
```

- [ ] **Step 4: Реестр закрытия**

Создать `src/features/workspace-tabs/lib/panel-tab-close-registry.ts`:

```ts
type PanelTabCloseCallback = (panelId: string) => void

const callbacks = new Set<PanelTabCloseCallback>()

// Generic-реестр закрытия панельных вкладок: workspace-tabs не знает, кто
// владеет контентом панели (SDUI). Хост-приложение подписывается на app/.
export function onPanelTabClose(cb: PanelTabCloseCallback): () => void {
  callbacks.add(cb)
  return () => {
    callbacks.delete(cb)
  }
}

export function notifyPanelTabClose(panelId: string): void {
  callbacks.forEach((cb) => cb(panelId))
}
```

- [ ] **Step 5: Стор — `activateOrCreatePanel` + фильтр персиста**

В `src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.ts`:

1. В интерфейс `WorkspaceTabsStore` после `activateOrCreate: …` добавить:

```ts
  activateOrCreatePanel: (id: string, title: string, panelId: string) => void
```

2. В реализацию стора после метода `activateOrCreate` добавить:

```ts
      // Панельная вкладка (sdui-panel): не маршрутная, id = стабильный tabKey.
      // Повторный вызов с тем же id переиспользует вкладку (обновляя panelId).
      activateOrCreatePanel: (id, title, panelId) => {
        const { tabs } = get()

        const existing = tabs.find((t) => t.id === id)
        if (existing) {
          set({
            activeTabId: existing.id,
            tabs: updateTab(tabs, existing.id, (t) => ({ ...t, title, panelId })),
          })
          return
        }

        const tab: WorkspaceTab = {
          id,
          path: '',
          search: '',
          title,
          pageType: 'sdui-panel',
          panelId,
          createdAt: Date.now(),
        }

        let newTabs = [...tabs, tab]
        if (newTabs.length > MAX_TABS) {
          newTabs = [newTabs[0], ...newTabs.slice(2)]
        }

        set({ tabs: newTabs, activeTabId: id })
      },
```

3. Заменить `partialize` на:

```ts
      // Панельные вкладки не персистим: их контент — in-memory panel-store SDUI,
      // перезагрузку не переживает (иначе после reload осиротевшая вкладка).
      partialize: (state) => {
        const tabs = state.tabs.filter((t) => t.pageType !== 'sdui-panel')
        return {
          tabs,
          activeTabId: tabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : null,
        }
      },
```

- [ ] **Step 6: Barrel-экспорт**

В `src/features/workspace-tabs/index.ts` добавить:

```ts
export { onPanelTabClose, notifyPanelTabClose } from './lib/panel-tab-close-registry'
```

- [ ] **Step 7: Тесты зелёные**

Run: `npx vitest run src/features/workspace-tabs/`
Expected: все PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/workspace-tabs/types/workspace-tab.ts src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.ts src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.test.ts src/features/workspace-tabs/lib/panel-tab-close-registry.ts src/features/workspace-tabs/index.ts
git commit -m "feat: панельные вкладки в workspace-tabs (activateOrCreatePanel, без персиста)"
```

---

### Task 7: Блок D-3 — `dispatch.openDialog` + `panel-store` (открытие в вкладку, выживание при reset)

**Files:**
- Modify: `src/features/sdui/lib/stores/panel-store.ts`
- Modify: `src/features/sdui/lib/dispatch.ts:46-64` (обработчик `openDialog`)
- Test: `src/features/sdui/lib/stores/panel-store.test.ts` (создать)

**Interfaces:**
- Consumes: `openPanelTab` из Task 5 (`../workspace-tab-gateway` относительно dispatch.ts).
- Produces: `PanelEntry` + поля `openInWorkspaceTab?: boolean; tabKey?: string`; `reset()` сохраняет tab-панели (нужно Task 8: контент вкладки переживает размонтирование родительской формы — `sdui-screen.tsx:84` зовёт `reset()` при каждой смене маршрута).

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/lib/stores/panel-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { usePanelStore } from './panel-store'

const node = { id: 'n1', type: 'PAGE' } as ViewNode

beforeEach(() => usePanelStore.setState({ panels: [] }))

describe('panel-store reset', () => {
  it('сбрасывает диалоги, но сохраняет панели workspace-вкладок', () => {
    usePanelStore.getState().push({
      panelId: 'dlg',
      node,
      presentation: 'modal',
      viewState: {},
    })
    usePanelStore.getState().push({
      panelId: 'tab',
      node,
      presentation: 'page',
      viewState: {},
      openInWorkspaceTab: true,
      tabKey: 'movements:1',
    })
    usePanelStore.getState().reset()
    const panels = usePanelStore.getState().panels
    expect(panels).toHaveLength(1)
    expect(panels[0].panelId).toBe('tab')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/stores/panel-store.test.ts`
Expected: FAIL — TS не знает `openInWorkspaceTab` (и/или `reset` очищает всё → `toHaveLength(1)` получает 0).

- [ ] **Step 3: panel-store — поля и reset**

В `src/features/sdui/lib/stores/panel-store.ts`:

1. В `PanelEntry` после `viewState: Record<string, unknown>` добавить:

```ts
  // Панель показывается workspace-вкладкой (Блок D): DialogHost её пропускает,
  // живёт до закрытия вкладки (переживает reset() при размонтировании формы).
  openInWorkspaceTab?: boolean
  tabKey?: string
```

2. Заменить `reset: () => set({ panels: [] }),` на:

```ts
  // reset зовётся при размонтировании SduiScreen (sdui-screen.tsx): диалоги
  // умирают вместе с формой, а панели workspace-вкладок самодостаточны
  // (childState) и живут до закрытия своей вкладки.
  reset: () =>
    set((s) => ({ panels: s.panels.filter((p) => p.openInWorkspaceTab) })),
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/stores/panel-store.test.ts`
Expected: PASS.

- [ ] **Step 5: dispatch.openDialog — ветка вкладки**

В `src/features/sdui/lib/dispatch.ts`:

1. Добавить импорт после `import { relaySelectionToParent } from './relay-selection'`:

```ts
import { openPanelTab } from './workspace-tab-gateway'
```

2. Заменить обработчик `openDialog` (строки 46-64) целиком на:

```ts
        openDialog: (effect) => {
          const props = effect.node?.props
          const presentation = (props?.presentation as string) ?? 'modal'
          const panelId = effect.node?.id ?? String(Date.now())
          const tabKey = props?.tabKey as string | undefined
          // Блок D: page-панель с openInWorkspaceTab уходит в workspace-вкладку.
          // Если gateway не забинден — openPanelTab вернёт false и панель
          // откатится на прежний fullScreen Dialog.
          const inTab =
            props?.openInWorkspaceTab === true &&
            typeof tabKey === 'string' &&
            openPanelTab({
              tabKey,
              title: (props?.title as string | undefined) ?? '',
              panelId,
            })
          const entry: PanelEntry = {
            panelId,
            node: effect.node!,
            presentation: presentation as 'drawer' | 'modal' | 'page',
            viewState: effect.childState ?? {},
            ...(inTab ? { openInWorkspaceTab: true, tabKey } : {}),
          }
          if (effect.sessionId) {
            entry.session = {
              formSessionId: effect.sessionId,
              revision: effect.childRevision ?? 0,
              parentSessionId: session.getSession().formSessionId ?? undefined,
              targetNodeId: undefined,
            }
          }
          // Повторное открытие того же документа (тот же tabKey → тот же
          // node.id): свежий PanelEntry с новым childState заменяет старый.
          if (inTab) usePanelStore.getState().remove(panelId)
          usePanelStore.getState().push(entry)
        },
```

- [ ] **Step 6: Регресс SDUI-тестов**

Run: `npx vitest run src/features/sdui/`
Expected: все PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/lib/stores/panel-store.ts src/features/sdui/lib/stores/panel-store.test.ts src/features/sdui/lib/dispatch.ts
git commit -m "feat: openDialog с openInWorkspaceTab заводит workspace-вкладку"
```

---

### Task 8: Блок D-4 — рендер SDUI-панели в области workspace-вкладки

**Files:**
- Create: `src/features/sdui/lib/panel-state-provider.tsx`
- Create: `src/features/sdui/ui/workspace-panel-host.tsx`
- Modify: `src/features/sdui/ui/dialog-host.tsx` (пропуск панелей `openInWorkspaceTab`)
- Modify: `src/app/layout/layout.tsx`
- Modify: `src/features/sdui/index.ts`
- Test: `src/features/sdui/ui/workspace-panel-host.test.tsx`

**Interfaces:**
- Consumes: `PanelEntry` с полями `openInWorkspaceTab?: boolean` / `tabKey?: string` (Task 7); `usePanelStore`; `NodeRenderer` (`src/features/sdui/ui/node-renderer.tsx`); `WorkspaceTab.pageType === 'sdui-panel'` + `panelId` (Task 6); `SduiSessionProvider`/`SduiSessionValue` (`src/features/sdui/lib/sdui-session-context.tsx`).
- Produces: `WorkspacePanelHost({ panelId }: { panelId: string })` — экспорт из `@/features/sdui` (Task 10 и layout используют его). `PanelStateProvider` — внутренний, из barrel НЕ экспортируется.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/ui/workspace-panel-host.test.tsx`. `NodeRenderer` мокаем (тянет всю фабрику нод); `usePanelStore` — реальный zustand-стор, состояние ставим напрямую. jest-dom в проекте нет (`vitest.config.ts` без `setupFiles`) — ассерты через `toBeTruthy()` / `toBeNull()`, cleanup вручную.

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePanelStore, type PanelEntry } from '../lib/stores/panel-store'
import { WorkspacePanelHost } from './workspace-panel-host'

vi.mock('./node-renderer', () => ({
  NodeRenderer: ({ node }: { node: { id: string } }) => <div>{node.id}</div>,
}))

const makePanel = (panelId: string): PanelEntry => ({
  panelId,
  node: { id: 'root.movements', type: 'CONTAINER' },
  presentation: 'page',
  viewState: {},
  openInWorkspaceTab: true,
  tabKey: 'movements:42',
})

describe('WorkspacePanelHost', () => {
  beforeEach(() => {
    usePanelStore.setState({ panels: [] })
  })
  afterEach(cleanup)

  it('рендерит дерево панели по panelId', () => {
    usePanelStore.setState({ panels: [makePanel('p-1')] })
    render(<WorkspacePanelHost panelId="p-1" />)
    expect(screen.getByText('root.movements')).toBeTruthy()
  })

  it('рендерит null, если панели нет в сторе', () => {
    const { container } = render(<WorkspacePanelHost panelId="missing" />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/workspace-panel-host.test.tsx`
Expected: FAIL — модуль `workspace-panel-host` не найден.

- [ ] **Step 3: Read-only провайдер сессии панели**

Создать `src/features/sdui/lib/panel-state-provider.tsx`:

```tsx
import type { ReactNode } from 'react'

import {
  SduiSessionProvider,
  type SduiSessionValue,
} from './sdui-session-context'
import type { PanelEntry } from './stores/panel-store'

const warnReadOnly = () => {
  console.warn('[sdui] panel tab is read-only, mutation ignored')
}

// Read-only сессия для SDUI-панели в workspace-вкладке. Движения — read-only
// представление (спека §2.4): мутаций/патчей из вкладки не бывает, поэтому все
// сеттеры — warn+noop, dirty всегда false. Значения читаются из снимка
// viewState PanelEntry (актуальный снимок кладёт dispatch при открытии).
export const PanelStateProvider = ({
  panel,
  children,
}: {
  panel: PanelEntry
  children: ReactNode
}) => {
  const sessionValue: SduiSessionValue = {
    kind: 'panel',
    getSession: () => ({
      formSessionId: panel.session?.formSessionId ?? null,
      revision: panel.session?.revision ?? null,
    }),
    getValue: (binding) => (binding ? panel.viewState[binding] : undefined),
    setValue: warnReadOnly,
    setFromServer: warnReadOnly,
    getAll: () => panel.viewState,
    replaceAll: warnReadOnly,
    merge: warnReadOnly,
    isDirty: false,
    resetDirty: () => {},
    tree: panel.node,
    setRoot: warnReadOnly,
    setSession: warnReadOnly,
    bumpRevision: warnReadOnly,
    applyTreePatches: warnReadOnly,
    clearAllErrors: () => {},
  }

  return (
    <SduiSessionProvider value={sessionValue}>{children}</SduiSessionProvider>
  )
}
```

Замечание по типам: `warnReadOnly` — `() => void`; присваивание в поля вида `(binding: string, value: unknown) => void` корректно (TS разрешает функции с меньшим числом параметров).

- [ ] **Step 4: Хост панели**

Создать `src/features/sdui/ui/workspace-panel-host.tsx`:

```tsx
import { PanelStateProvider } from '../lib/panel-state-provider'
import { usePanelStore } from '../lib/stores/panel-store'
import { NodeRenderer } from './node-renderer'

// Рендерит контент SDUI-панели в области workspace-вкладки (вместо Dialog).
// panelId приходит из активной вкладки pageType 'sdui-panel' (layout.tsx).
export const WorkspacePanelHost = ({ panelId }: { panelId: string }) => {
  const panel = usePanelStore((s) =>
    s.panels.find((p) => p.panelId === panelId),
  )
  if (!panel) return null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <PanelStateProvider panel={panel}>
        <NodeRenderer node={panel.node} />
      </PanelStateProvider>
    </div>
  )
}
```

- [ ] **Step 5: Тест зелёный**

Run: `npx vitest run src/features/sdui/ui/workspace-panel-host.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 6: DialogHost пропускает панели-вкладки**

В `src/features/sdui/ui/dialog-host.tsx`, в `stack.map((panel) => {` сразу после строки `if (!panel.node) return null`:

```tsx
        // Панель, открытая в workspace-вкладке, рендерится через
        // WorkspacePanelHost — DialogHost её не показывает.
        if (panel.openInWorkspaceTab) return null
```

- [ ] **Step 7: Layout переключает контент по активной панельной вкладке**

`src/app/layout/layout.tsx` — целиком новое содержимое (файл 22 строки, app-слой знает обе зоны — гейтвей не нужен):

```tsx
import type { ReactNode } from 'react'

import { WorkspacePanelHost } from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { WorkspaceTabBar } from '@/widgets/workspace-tab-bar'

interface LayoutProps {
  sidebar: ReactNode
  header?: ReactNode
  children?: ReactNode
}

export const Layout = ({ sidebar, header, children }: LayoutProps) => {
  // panelId активной вкладки типа 'sdui-panel'; undefined — обычная вкладка/нет вкладок
  const activePanelId = useWorkspaceTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return tab?.pageType === 'sdui-panel' ? tab.panelId : undefined
  })

  return (
    <div className="flex h-screen w-full bg-ui-06">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col rounded-tl-4xl rounded-bl-4xl bg-ui-02 p-8 pb-0">
        <header>{header}</header>
        <main className="min-h-0 flex-1 overflow-auto">
          {/* Роут-контент прячем классом, НЕ размонтируем: форма документа
              под панельной вкладкой должна пережить переключение (спека §2.4) */}
          <div className={activePanelId ? 'hidden' : 'h-full'}>{children}</div>
          {activePanelId && <WorkspacePanelHost panelId={activePanelId} />}
        </main>
        <WorkspaceTabBar />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Barrel-экспорт**

В `src/features/sdui/index.ts` добавить:

```ts
export { WorkspacePanelHost } from './ui/workspace-panel-host'
```

- [ ] **Step 9: Регресс SDUI-тестов**

Run: `npx vitest run src/features/sdui/`
Expected: все PASS.

- [ ] **Step 10: Commit**

```bash
git add src/features/sdui/lib/panel-state-provider.tsx src/features/sdui/ui/workspace-panel-host.tsx src/features/sdui/ui/workspace-panel-host.test.tsx src/features/sdui/ui/dialog-host.tsx src/app/layout/layout.tsx src/features/sdui/index.ts
git commit -m "feat: рендер SDUI-панели в области workspace-вкладки"
```

---

### Task 9: Блок D-5 — активация и закрытие панельных вкладок в таб-баре

**Files:**
- Modify: `src/widgets/workspace-tab-bar/ui/workspace-tab-bar.tsx`
- Test: `src/widgets/workspace-tab-bar/ui/workspace-tab-bar.test.tsx` (создать)

**Interfaces:**
- Consumes: `notifyPanelTabClose` из `@/features/workspace-tabs` (Task 6); `WorkspaceTab.pageType === 'sdui-panel'` + `panelId` (Task 6).
- Produces: поведение UI — активация панельной вкладки без `navigate`, закрытие с уведомлением реестра. Новых API нет.

- [ ] **Step 1: Написать падающие тесты**

Создать `src/widgets/workspace-tab-bar/ui/workspace-tab-bar.test.tsx`. Ключевые моки: `cross.svg` (в `vitest.config.ts` нет svgr — импорт svg как компонента упадёт), роутер — `MemoryRouter` + проба локации.

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  onPanelTabClose,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

import { WorkspaceTabBar } from './workspace-tab-bar'

vi.mock('@/shared/assets/icons/cross.svg', () => ({
  default: () => null,
}))

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="loc">{location.pathname}</div>
}

const formTab = {
  id: '/documents/42',
  path: '/documents/42',
  search: '',
  title: 'Документ 42',
  pageType: 'document-entry' as const,
  createdAt: 1,
}

const panelTab = {
  id: 'movements:42',
  path: '',
  search: '',
  title: 'Движения 42',
  pageType: 'sdui-panel' as const,
  panelId: 'p-42',
  createdAt: 2,
}

const renderBar = () =>
  render(
    <MemoryRouter initialEntries={['/documents/42']}>
      <WorkspaceTabBar />
      <LocationProbe />
    </MemoryRouter>,
  )

describe('WorkspaceTabBar: панельные вкладки', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({
      tabs: [formTab, panelTab],
      activeTabId: formTab.id,
    })
  })
  afterEach(cleanup)

  it('активация панельной вкладки не навигирует', () => {
    renderBar()
    fireEvent.click(screen.getByText('Движения 42'))
    expect(useWorkspaceTabsStore.getState().activeTabId).toBe('movements:42')
    expect(screen.getByTestId('loc').textContent).toBe('/documents/42')
  })

  it('закрытие панельной вкладки уведомляет реестр её panelId', () => {
    const onClose = vi.fn()
    const unsubscribe = onPanelTabClose(onClose)
    renderBar()

    // Кнопка-крестик — вложенный span[role=button] внутри кнопки вкладки
    const tabButton = screen.getByText('Движения 42').closest('button')!
    fireEvent.click(within(tabButton).getByRole('button'))

    expect(onClose).toHaveBeenCalledWith('p-42')
    expect(useWorkspaceTabsStore.getState().tabs.map((t) => t.id)).toEqual([
      '/documents/42',
    ])
    unsubscribe()
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/widgets/workspace-tab-bar/`
Expected: FAIL — первый тест: локация меняется на `''` (navigate по пустому path); второй: `onClose` не вызван.

- [ ] **Step 3: Реализация — три развилки в `workspace-tab-bar.tsx`**

1. Импорт: в существующий импорт из `@/features/workspace-tabs` добавить `notifyPanelTabClose`:

```tsx
import {
  useWorkspaceTabsStore,
  useFormCacheStore,
  notifyPanelTabClose,
} from '@/features/workspace-tabs'
```

2. `navigateAfterClose` (строки 13-24) — заменить целиком:

```tsx
const navigateAfterClose = (
  navigate: ReturnType<typeof useNavigate>,
  activeTabId: string | null
) => {
  const remaining = useWorkspaceTabsStore.getState()
  if (remaining.tabs.length > 0) {
    const nextTab = remaining.tabs[0]
    if (nextTab.pageType === 'sdui-panel') {
      // Панельная вкладка живёт вне роутера — активируем без навигации
      remaining.setActiveTab(nextTab.id)
      return
    }
    void navigate(nextTab.path + nextTab.search)
  } else if (activeTabId === null) {
    void navigate('/')
  }
}
```

3. `handleActivate` — заменить целиком:

```tsx
  const handleActivate = (tabId: string) => {
    if (tabId === activeTabId) return
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    setActiveTab(tab.id)
    // Панельная вкладка (sdui-panel) не привязана к роуту: контент рендерит
    // WorkspacePanelHost по activeTabId, навигация не нужна (и сломала бы URL).
    if (tab.pageType === 'sdui-panel') return
    void navigate(tab.path + tab.search)
  }
```

4. `performClose` — заменить целиком:

```tsx
  const performClose = (tabId: string) => {
    const tab = useWorkspaceTabsStore
      .getState()
      .tabs.find((t) => t.id === tabId)
    const isPanel = tab?.pageType === 'sdui-panel'
    // У панельных вкладок нет кэша формы
    if (!isPanel) useFormCacheStore.getState().removeTab(tabId)
    const closed = closeTab(tabId)
    // Реестр (Task 6) уведомляет app-биндинг → panel-store.remove(panelId)
    if (isPanel && closed?.panelId) notifyPanelTabClose(closed.panelId)
    if (closed?.id === activeTabId) {
      navigateAfterClose(navigate, useWorkspaceTabsStore.getState().activeTabId)
    }
  }
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run src/widgets/workspace-tab-bar/`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/workspace-tab-bar/ui/workspace-tab-bar.tsx src/widgets/workspace-tab-bar/ui/workspace-tab-bar.test.tsx
git commit -m "feat: активация и закрытие панельных workspace-вкладок без навигации"
```

---

### Task 10: Блок D-6 — app-биндинг гейтвея (единственная точка связи SDUI ↔ workspace-tabs)

**Files:**
- Create: `src/app/providers/workspace-tab-binding.ts`
- Modify: `src/app/App.tsx` (функция `App()`, строка ~222)
- Test: `src/app/providers/workspace-tab-binding.test.ts`

**Interfaces:**
- Consumes: `setWorkspaceTabGateway`, `openPanelTab`, `usePanelStore` из `@/features/sdui` (Tasks 5, 7); `onPanelTabClose`, `useWorkspaceTabsStore` (+ `activateOrCreatePanel`) из `@/features/workspace-tabs` (Task 6).
- Produces: `useWorkspaceTabGatewayBinding(): void` — хук, вызывается один раз в `App()`.

- [ ] **Step 1: Написать падающие тесты**

Создать `src/app/providers/workspace-tab-binding.test.ts` (`renderHook` не требует JSX — обычный `.ts` достаточен):

```ts
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openPanelTab, usePanelStore } from '@/features/sdui'
import {
  notifyPanelTabClose,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

import { useWorkspaceTabGatewayBinding } from './workspace-tab-binding'

describe('useWorkspaceTabGatewayBinding', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
    usePanelStore.setState({ panels: [] })
  })

  it('связывает openPanelTab SDUI с activateOrCreatePanel', () => {
    const { unmount } = renderHook(() => useWorkspaceTabGatewayBinding())

    const ok = openPanelTab({
      tabKey: 'movements:1',
      title: 'Движения',
      panelId: 'p1',
    })

    expect(ok).toBe(true)
    expect(useWorkspaceTabsStore.getState().tabs[0]).toMatchObject({
      id: 'movements:1',
      title: 'Движения',
      pageType: 'sdui-panel',
      panelId: 'p1',
    })
    unmount()
  })

  it('закрытие панельной вкладки удаляет панель из panel-store', () => {
    const { unmount } = renderHook(() => useWorkspaceTabGatewayBinding())
    usePanelStore.setState({
      panels: [
        {
          panelId: 'p1',
          node: { id: 'n', type: 'CONTAINER' },
          presentation: 'page',
          viewState: {},
        },
      ],
    })

    notifyPanelTabClose('p1')

    expect(usePanelStore.getState().panels).toHaveLength(0)
    unmount()
  })

  it('после unmount гейтвей отвязан (openPanelTab → false)', () => {
    const { unmount } = renderHook(() => useWorkspaceTabGatewayBinding())
    unmount()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      openPanelTab({ tabKey: 'movements:2', title: 'Движения', panelId: 'p2' }),
    ).toBe(false)
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/app/providers/workspace-tab-binding.test.ts`
Expected: FAIL — модуль `workspace-tab-binding` не найден.

- [ ] **Step 3: Реализация биндинга**

Создать `src/app/providers/workspace-tab-binding.ts`:

```ts
import { useEffect } from 'react'

import { setWorkspaceTabGateway, usePanelStore } from '@/features/sdui'
import {
  onPanelTabClose,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

// Единственная точка связи SDUI ↔ workspace-tabs (app-слой знает обе зоны,
// сами фичи друг о друге — нет; образец — reference-picker gateway в App()).
// Прямая связь: SDUI просит открыть панельную вкладку → workspace-tabs.
// Обратная связь: вкладку закрыли крестиком → удалить панель из panel-store.
export function useWorkspaceTabGatewayBinding(): void {
  useEffect(() => {
    setWorkspaceTabGateway({
      openPanelTab: ({ tabKey, title, panelId }) => {
        useWorkspaceTabsStore
          .getState()
          .activateOrCreatePanel(tabKey, title, panelId)
      },
    })
    const unsubscribe = onPanelTabClose((panelId) => {
      usePanelStore.getState().remove(panelId)
    })
    return () => {
      setWorkspaceTabGateway(null)
      unsubscribe()
    }
  }, [])
}
```

- [ ] **Step 4: Вызов в `App()`**

В `src/app/App.tsx`:

1. Добавить импорт (рядом с остальными импортами app-слоя):

```ts
import { useWorkspaceTabGatewayBinding } from './providers/workspace-tab-binding'
```

2. В `function App()` (строка ~222) первой строкой тела, ПЕРЕД существующим `useEffect` с `setReferencePickerGateway`:

```ts
function App() {
  useWorkspaceTabGatewayBinding()

  useEffect(() => {
    setReferencePickerGateway((req) => {
```

- [ ] **Step 5: Тесты зелёные**

Run: `npx vitest run src/app/providers/workspace-tab-binding.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 6: Commit**

```bash
git add src/app/providers/workspace-tab-binding.ts src/app/providers/workspace-tab-binding.test.ts src/app/App.tsx
git commit -m "feat: app-биндинг workspace-tab gateway (SDUI и workspace-tabs)"
```

---

### Task 11: Финальная верификация

**Files:** нет изменений кода (только фиксы, если верификация что-то найдёт).

- [ ] **Step 1: Весь тестовый прогон**

Run: `npx vitest run`
Expected: все PASS, ни одного skip из новых.

- [ ] **Step 2: Сборка**

Run: `npm run build`
Expected: `tsc` + `vite build` зелёные (это явно санкционированный прогон — финальная приёмка, не «после каждого изменения»).

- [ ] **Step 3: Ручная проверка на стенде (Playwright MCP или вручную)**

Dev-сервер: `npm run dev`. Чек-лист из дизайн-спеки (`docs/superpowers/specs/2026-07-08-movements-1c-parity-design.md`):

1. Открыть проведённый документ (ЗаявкаНаРегистрациюГПСделки или др.) → кнопка «ДтКт» → движения открываются **workspace-вкладкой** (внизу появляется вкладка, модалки нет).
2. Бухрегистр отображается **1С-блоком**: 4-строчная шапка, группы-проводки, колонка «N», период с секундами (`dd.MM.yyyy HH:mm:ss`), суммы с пробелами и запятой (`12 345,00`), зебра между группами.
3. Переключение вкладок форма ↔ движения: контент формы не теряется (роут-контент под `hidden`, не размонтирован).
4. Повторный клик «ДтКт» на том же документе → активируется существующая вкладка, дубль не создаётся.
5. Крестик на вкладке движений → вкладка закрывается, панель удаляется (повторный «ДтКт» открывает заново).
6. Вкладки «Накопление» и «Сведения» (если у документа есть): обычная read-only таблица с колонкой «N».
7. Регресс: справочные drawer'ы/диалоги SDUI открываются как раньше (панели без `openInWorkspaceTab` не затронуты).
8. Блок A: у проведённой ЗаявкиГП с «Сумма 1-й год» > 0 над вкладками виден статус «Заявка исполнена на X из Y»; в консоли нет `[sdui] malformed patch`.
9. Перезагрузка страницы с открытой панельной вкладкой → вкладка движений НЕ восстанавливается (не персистится), обычные вкладки — восстанавливаются, активная не «осиротела».

- [ ] **Step 4: Финальный коммит (если были фиксы по чек-листу)**

Формат: `fix: <описание>` — по одному коммиту на смысловой фикс.
