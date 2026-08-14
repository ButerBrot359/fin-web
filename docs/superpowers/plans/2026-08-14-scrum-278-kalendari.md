# SCRUM-278 «Графики работы» (Kalendari) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отрендерить SDUI-карточку «Графики работы» — две специализированные редактируемые таблицы (шаблон заполнения, расписание работы), исправить перенос формы enum-значения через session-state, и сделать календарь результата строго read-only.

**Architecture:** Бэк уже влит в main и присылает ноды kalendari-таблиц обычной stateful `POST /api/view`-сессией. Фронт распознаёт их по `binding` (`ShablonZapolneniya`/`RaspisanieRaboty`) — новая ветка роутинга в `table-node.tsx`. Обе таблицы строятся поверх существующего `use-table-sync` (полный упорядоченный массив на каждой правке, ADR-0011 §3.4). Никаких новых механизмов синхронизации, кэшей или API.

**Tech Stack:** React 19 + TypeScript, MUI, TanStack Table, date-fns, vitest + React Testing Library, react-i18next.

**Spec:**

- Дизайн-док: `docs/superpowers/specs/2026-08-13-scrum-278-kalendari-design.md`
- Контракт бэка (wire): `specs-local/scrum-278-grafiki-raboty/SCRUM-278-spec-v2-2026-08-13-back.md`
- Бизнес-правила: `specs-local/scrum-278-grafiki-raboty/SCRUM-278-spec-v1-2026-08-12-back.md`

## Global Constraints

- **Изоляция:** задача целиком в зоне SDUI (`src/features/sdui/`). Легаси не трогать. Мосты между мирами не создавать.
- **Тексты:** только через `useTranslation`/`react-i18next`, ключи в `src/app/config/i18n/locales/{ru,kz}/common.json`. Никакого хардкода строк в JSX. Тексты — `<Typography>` из `@mui/material` там, где это самостоятельный текстовый элемент.
- **Хуки:** без `useMemo`/`useCallback`, кроме случаев с явной причиной по перформансу (мемоизация колонок TanStack — такой случай, см. `editable-table.tsx`).
- **Размер файла:** новый код ~200 строк/файл, >300 обязателен к разбивке.
- **Barrel-экспорты:** только на уровне слайса; внутри сегмента импорт напрямую из файлов.
- **Дискриминатор:** kalendari-таблицы распознаются ТОЛЬКО по `binding`, спец-пропа (`kalendariKind`) нет. Классификация ограничена карточкой Kalendari (ветка в `table-node.tsx`).
- **rowId новых строк:** нечисловой `tmp-*` (генерит `use-table-sync`). Числовой rowId = персистированная строка.
- **Реакция на расхождение контракта:** если реальный ответ `/api/view` отличается от контракта v2-back — остановиться и сообщить о расхождении, НЕ добавлять клиентский воркэраунд (прямое требование §Implementation gate спеки бэка).
- **Проверки:** не гонять `tsc`/`lint`/`build` после каждого шага. `npm run build` — только перед пушем (обязательно, tsc -b строже).
- **Тесты:** vitest ограничивать директорией через `--dir`, чтобы не поднимать весь прогон.

---

### Task 1: Enum — перенос формы `{id, code, presentation}` через session-state

**Проблема (п.1 спеки):** `enum-field-node.tsx` при выборе кладёт в session-state голую строку (`f.setValue(selectedValue)`), теряя `{id, presentation}`. При гидрации из полного объекта селект не находит значение (кастует `f.value` в строку). Change-событие уже шлёт полный объект — не трогаем.

**Files:**

- Create: `src/features/sdui/lib/utils/enum-value.ts`
- Test: `src/features/sdui/lib/utils/enum-value.test.ts`
- Modify: `src/features/sdui/ui/nodes/fields/enum-field-node.tsx`
- Modify: `src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx:37-49` (заменить локальный `resolveEnumValue` на общий — DRY)

**Interfaces:**

- Produces: `resolveEnumValue(value: unknown, options: EnumOption[]): string` и `type EnumOption = { value: string; label: string; id?: number; code?: string }` из `lib/utils/enum-value.ts`. Используется в `enum-field-node.tsx` (Task 1) и `kalendari-template-table.tsx` (Task 3, для чтения `code` режима).

- [ ] **Step 1: Написать падающий тест утилиты**

`src/features/sdui/lib/utils/enum-value.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { resolveEnumValue } from './enum-value'

const options = [
  { value: 'week', label: 'По неделям', id: 31, code: 'PoNedelyam' },
  {
    value: 'cycle',
    label: 'По циклам',
    id: 32,
    code: 'PoTsiklamProizvolnoyDliny',
  },
]

describe('resolveEnumValue', () => {
  it('строка-код возвращается как есть (совпадает с option.value)', () => {
    expect(resolveEnumValue('week', options)).toBe('week')
  })
  it('полный объект матчится по code', () => {
    expect(
      resolveEnumValue(
        {
          id: 32,
          code: 'PoTsiklamProizvolnoyDliny',
          presentation: 'По циклам',
        },
        options
      )
    ).toBe('cycle')
  })
  it('полный объект матчится по id, если code отсутствует', () => {
    expect(resolveEnumValue({ id: 31 }, options)).toBe('week')
  })
  it('null/undefined → пустая строка', () => {
    expect(resolveEnumValue(null, options)).toBe('')
    expect(resolveEnumValue(undefined, options)).toBe('')
  })
  it('нет совпадения → пустая строка', () => {
    expect(resolveEnumValue({ code: 'Unknown' }, options)).toBe('')
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui/lib/utils src/features/sdui/lib/utils/enum-value.test.ts`
Expected: FAIL — `resolveEnumValue` / модуль не найден.

- [ ] **Step 3: Реализовать утилиту**

`src/features/sdui/lib/utils/enum-value.ts`:

```ts
export interface EnumOption {
  value: string
  label: string
  id?: number
  code?: string
}

/** Текущее значение enum (строка-код или объект `{id, code, presentation}`) → строковый `value` опции. */
export function resolveEnumValue(
  value: unknown,
  options: EnumOption[]
): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { id?: unknown; code?: unknown }
    const match = options.find(
      (o) =>
        (v.id != null && o.id === v.id) || (v.code != null && o.code === v.code)
    )
    return match?.value ?? ''
  }
  return ''
}
```

- [ ] **Step 4: Прогнать — убедиться, что проходит**

Run: `npx vitest run --dir src/features/sdui/lib/utils src/features/sdui/lib/utils/enum-value.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Написать падающие тесты enum-field-node (гидрация + исходящий объект)**

Дописать в `src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx`. Опции нужны с `id`/`code`, и надо чистить `state` между тестами. Добавить блок:

```tsx
import { fireEvent, screen, within } from '@testing-library/react'

const richOptions = [
  { value: 'week', label: 'По неделям', id: 31, code: 'PoNedelyam' },
  {
    value: 'cycle',
    label: 'По циклам',
    id: 32,
    code: 'PoTsiklamProizvolnoyDliny',
  },
]
const richNode = (): ViewNode => ({
  id: 'field.sposob',
  type: 'ENUM_FIELD',
  binding: 'SposobZapolneniya',
  props: { label: 'Способ', options: richOptions },
  actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
})

describe('EnumFieldNode форма значения', () => {
  it('гидрация из полного объекта → выбран нужный пункт', () => {
    state.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
      presentation: 'По циклам',
    }
    render(<EnumFieldNode node={richNode()} />)
    expect(screen.getByText('По циклам')).toBeTruthy()
    delete state.SposobZapolneniya
  })

  it('гидрация из строки-кода → выбран нужный пункт', () => {
    state.SposobZapolneniya = 'week'
    render(<EnumFieldNode node={richNode()} />)
    expect(screen.getByText('По неделям')).toBeTruthy()
    delete state.SposobZapolneniya
  })

  it('после выбора в session-state лежит полный объект {id, code, presentation}', () => {
    delete state.SposobZapolneniya
    render(<EnumFieldNode node={richNode()} />)
    fireEvent.mouseDown(screen.getByRole('combobox'))
    const listbox = within(screen.getByRole('listbox'))
    fireEvent.click(listbox.getByText('По циклам'))
    expect(state.SposobZapolneniya).toEqual({
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
      presentation: 'По циклам',
    })
    delete state.SposobZapolneniya
  })
})
```

- [ ] **Step 6: Прогнать — убедиться, что новые тесты падают**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/fields src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx`
Expected: FAIL — «после выбора» видит строку `'cycle'`, а не объект; гидрация из объекта не находит пункт.

- [ ] **Step 7: Поправить enum-field-node**

В `src/features/sdui/ui/nodes/fields/enum-field-node.tsx`:

- Импортировать общий резолвер: `import { resolveEnumValue, type EnumOption } from '../../../lib/utils/enum-value'` и удалить локальный `interface EnumOption`.
- Заменить `const value = (f.value as string | undefined) ?? ''` на `const value = resolveEnumValue(f.value, options)`.
- В `onChange`: вычислять `enumValue` как сейчас, но перед `fireServerEvent` класть в session-state именно объект — заменить `f.setValue(selectedValue)` на `f.setValue(enumValue)` (вынести вычисление `enumValue` выше `f.setValue`).

Итоговый `onChange`:

```tsx
onChange={(e) => {
  const selectedValue = e.target.value
  const opt = options.find((o) => o.value === selectedValue)
  const enumValue = opt
    ? { id: opt.id ?? selectedValue, code: opt.code ?? opt.value, presentation: opt.label }
    : { id: selectedValue, code: selectedValue, presentation: selectedValue }
  f.setValue(enumValue)
  f.fireServerEvent('change', enumValue)
}}
```

- [ ] **Step 8: DRY — table-cell-editor использует общий резолвер**

В `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`: удалить локальные `interface EnumOption` (стр. 29-34) и `function resolveEnumValue` (стр. 36-49); добавить импорт `import { resolveEnumValue, type EnumOption } from '../../../lib/utils/enum-value'`.

- [ ] **Step 9: Прогнать все затронутые тесты**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/fields --dir src/features/sdui/ui/nodes/composite --dir src/features/sdui/lib/utils`
Expected: PASS (в т.ч. существующие readonly-тесты enum и table-cell-editor).

- [ ] **Step 10: Commit**

```bash
git add src/features/sdui/lib/utils/enum-value.ts src/features/sdui/lib/utils/enum-value.test.ts src/features/sdui/ui/nodes/fields/enum-field-node.tsx src/features/sdui/ui/nodes/fields/enum-field-node.test.tsx src/features/sdui/ui/nodes/composite/table-cell-editor.tsx
git commit -m "feat: enum-field переносит {id,code,presentation} через session-state (SCRUM-278 п.1)"
```

---

### Task 2: `use-table-sync` — метод `replaceRows` для полномассивной замены

**Зачем:** таблице шаблона (Task 3) нужна атомарная замена всего локального массива строк при смене «длины цикла» — «retain shared positions, drop tail, new unchecked `tmp-*` rows», с отправкой целиком через sync. Существующий API — построчный (`addRow`/`deleteRow`); добавляем один аддитивный метод.

**Files:**

- Modify: `src/features/sdui/lib/hooks/use-table-sync.ts` (интерфейс `UseTableSyncResult` + новый метод + возврат)
- Modify: `src/features/sdui/lib/hooks/use-table-sync.test.tsx`

**Interfaces:**

- Produces: `replaceRows(next: TableRow[]): void` в `UseTableSyncResult`. Ставит `next` локальным снимком, пишет в session-стор, шлёт полный EVENT (с учётом in-flight-коалесинга, как `addRow`). Потребитель — `kalendari-template-table.tsx` (Task 3).

- [ ] **Step 1: Написать падающий тест**

Дописать в `src/features/sdui/lib/hooks/use-table-sync.test.tsx`:

```tsx
it('replaceRows шлёт полный EVENT с новым массивом и обновляет rows', () => {
  sessionState.rows = [{ rowId: '1', DenVklyuchenVGrafik: true }]
  const { result } = renderHook(() => useTableSync(node, []))
  const next = [
    { rowId: '1', DenVklyuchenVGrafik: true },
    { rowId: 'tmp-2', DenVklyuchenVGrafik: false },
  ]
  act(() => {
    result.current.replaceRows(next)
  })
  expect(result.current.rows).toEqual(next)
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'EVENT',
    sourceNodeId: 'tbl',
    trigger: 'change',
    value: next,
    fullSnapshot: true,
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui/lib/hooks src/features/sdui/lib/hooks/use-table-sync.test.tsx`
Expected: FAIL — `result.current.replaceRows is not a function`.

- [ ] **Step 3: Реализовать `replaceRows`**

В `src/features/sdui/lib/hooks/use-table-sync.ts`:

Добавить в `interface UseTableSyncResult` строку:

```ts
  replaceRows: (next: TableRow[]) => void
```

Добавить метод рядом с `moveRow` (перед `flushPending`):

```ts
/**
 * Полная замена локального массива строк одним снимком (SCRUM-278: смена длины
 * цикла шаблона). Ведёт себя как структурная правка: canon-эхо о ней не знает,
 * поэтому при in-flight откладываем через needsCoalescedCommit, иначе шлём сразу.
 */
const replaceRows = (next: TableRow[]) => {
  setLocalRows(next)
  localRowsRef.current = next
  if (node.binding) setValue(node.binding, next)
  if (inFlightRef.current) {
    dirtyRef.current = new Map()
    needsCoalescedCommitRef.current = true
  } else {
    sendEvent(next)
  }
}
```

Добавить `replaceRows` в возвращаемый объект (рядом с `moveRow`).

- [ ] **Step 4: Прогнать — убедиться, что проходит (и остальные не сломаны)**

Run: `npx vitest run --dir src/features/sdui/lib/hooks src/features/sdui/lib/hooks/use-table-sync.test.tsx`
Expected: PASS (новый + все существующие).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/hooks/use-table-sync.ts src/features/sdui/lib/hooks/use-table-sync.test.tsx
git commit -m "feat: use-table-sync.replaceRows — полномассивная замена строк (SCRUM-278)"
```

---

### Task 3: `KalendariTemplateTable` — таблица шаблона заполнения

**Поведение (спека §Шаблон заполнения, v2-back §3, §5):**

- Единственная персистируемая колонка — `DenVklyuchenVGrafik` (BOOLEAN, `CHECKBOX_FIELD`). Номер/код дня НЕ хранится — позиция строки = 1C `LineNumber`.
- Режим читается из session-state поля `SposobZapolneniya` (`code`): `PoNedelyam` → 7 строк, подписи Пн…Вс (date-fns, ru, как в calendar-node); `PoTsiklamProizvolnoyDliny` → подписи «День 1…N».
- «Длина цикла» — фронтовая ячейка (число 1–366) только в циклическом режиме; выводится из числа строк; НИКОГДА не попадает в EVENT/EAV/save. Смена длины → `replaceRows`: общие позиции сохраняют чекбокс, хвост отбрасывается, новые строки unchecked с `tmp-*`.
- Смена режима недели↔циклы фронт сам НЕ синтезирует: enum шлёт своё change-событие, бэк возвращает новый набор строк канона; таблица лишь перерисовывает подписи по новому `code`. (Проверить на e2e — если бэк не пересобирает строки на смену режима, это расхождение контракта → сообщить, не воркэрадить.)

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/kalendari-template-table.tsx`
- Create: `src/features/sdui/ui/nodes/composite/kalendari-template-table.test.tsx`
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`

**Interfaces:**

- Consumes: `useTableSync` + `replaceRows` (Task 2); `resolveEnumValue` (Task 1); `useBindingValue` из `lib/sdui-session-context`; `nodeToTableColumnDef` из `lib/utils/build-column-defs`; `TableCellEditor` из `./table-cell-editor`.
- Produces: `export const KalendariTemplateTable: FC<NodeProps>`. Роутится из `table-node.tsx` по `binding === 'ShablonZapolneniya'` (Task 5).

- [ ] **Step 1: Добавить i18n-ключи**

`src/app/config/i18n/locales/ru/common.json` — в объект `sdui` добавить рядом с `calendar`:

```json
"kalendari": {
  "dayColumn": "День",
  "workingDay": "Рабочий день",
  "cycleLength": "Длина цикла",
  "dayN": "День {{n}}",
  "fillSchedule": "Заполнить расписание",
  "schedule": "Расписание"
}
```

`src/app/config/i18n/locales/kz/common.json` — тот же ключ `sdui.kalendari`:

```json
"kalendari": {
  "dayColumn": "Күн",
  "workingDay": "Жұмыс күні",
  "cycleLength": "Цикл ұзақтығы",
  "dayN": "{{n}}-күн",
  "fillSchedule": "Кестені толтыру",
  "schedule": "Кесте"
}
```

- [ ] **Step 2: Написать падающие тесты компонента**

`src/features/sdui/ui/nodes/composite/kalendari-template-table.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue(true),
}))
const sessionState: Record<string, unknown> = {}
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { n?: number }) => (o?.n != null ? `${k}:${o.n}` : k),
  }),
}))

import { KalendariTemplateTable } from './kalendari-template-table'

const checkboxCol: ViewNode = {
  id: 'dict.field.ShablonZapolneniya.col.DenVklyuchenVGrafik',
  type: 'TABLE_COLUMN',
  binding: 'DenVklyuchenVGrafik',
  props: { dataType: 'BOOLEAN', cellWidget: 'CHECKBOX_FIELD' },
}
const node = (): ViewNode => ({
  id: 'dict.field.ShablonZapolneniya',
  type: 'TABLE',
  binding: 'ShablonZapolneniya',
  props: { editable: true, allowAdd: true, allowDelete: true },
  children: [checkboxCol],
})

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    rowId: `r${i + 1}`,
    DenVklyuchenVGrafik: i < 5,
  }))

afterEach(() => {
  cleanup()
  for (const k of Object.keys(sessionState)) delete sessionState[k]
})
beforeEach(() => mockDispatch.mockClear())

describe('KalendariTemplateTable', () => {
  it('режим PoNedelyam → 7 строк с подписями дней недели, без ячейки длины цикла', () => {
    sessionState.SposobZapolneniya = 'PoNedelyam'
    sessionState.ShablonZapolneniya = rows(7)
    render(<KalendariTemplateTable node={node()} />)
    // 7 чекбоксов
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    // нет поля длины цикла
    expect(screen.queryByLabelText('sdui.kalendari.cycleLength')).toBeNull()
  })

  it('режим циклов → подписи «День N» и поле длины цикла', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3)
    render(<KalendariTemplateTable node={node()} />)
    expect(screen.getByText('sdui.kalendari.dayN:1')).toBeTruthy()
    expect(screen.getByText('sdui.kalendari.dayN:3')).toBeTruthy()
    expect(screen.getByLabelText('sdui.kalendari.cycleLength')).toBeTruthy()
  })

  it('увеличение длины цикла → replaceRows: общие позиции сохранены, новые unchecked tmp-*', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3) // r1,r2 checked; r3 unchecked
    render(<KalendariTemplateTable node={node()} />)
    fireEvent.change(screen.getByLabelText('sdui.kalendari.cycleLength'), {
      target: { value: '5' },
    })
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as {
      value: { rowId: string; DenVklyuchenVGrafik: boolean }[]
    }
    expect(sent.value).toHaveLength(5)
    expect(sent.value.slice(0, 3).map((r) => r.rowId)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
    expect(sent.value[3].DenVklyuchenVGrafik).toBe(false)
    expect(sent.value[3].rowId.startsWith('tmp-')).toBe(true)
  })

  it('уменьшение длины цикла → хвост отброшен', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(6)
    render(<KalendariTemplateTable node={node()} />)
    fireEvent.change(screen.getByLabelText('sdui.kalendari.cycleLength'), {
      target: { value: '2' },
    })
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as { value: unknown[] }
    expect(sent.value).toHaveLength(2)
  })

  it('чекбокс шлёт EVENT, длина цикла в строки не попадает', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3)
    render(<KalendariTemplateTable node={node()} />)
    fireEvent.click(screen.getAllByRole('checkbox')[2]) // включить r3
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as {
      value: Record<string, unknown>[]
    }
    expect(sent.value[2].DenVklyuchenVGrafik).toBe(true)
    expect(sent.value[0]).not.toHaveProperty('DlinaTsikla')
  })
})
```

- [ ] **Step 3: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/kalendari-template-table.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 4: Реализовать компонент**

`src/features/sdui/ui/nodes/composite/kalendari-template-table.tsx`:

```tsx
import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'

import { TextInput } from '@/shared/ui/inputs'
import type { NodeProps } from '../../../types/view'
import { useBindingValue } from '../../../lib/sdui-session-context'
import {
  useTableSync,
  type TableRow as SyncRow,
} from '../../../lib/hooks/use-table-sync'
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import { resolveEnumValue } from '../../../lib/utils/enum-value'
import { TableCellEditor } from './table-cell-editor'

const MODE_BINDING = 'SposobZapolneniya'
const CYCLIC_CODE = 'PoTsiklamProizvolnoyDliny'
// 2024-01-01 — понедельник: эталонная неделя для подписей Пн…Вс (как в calendar-node)
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)
const MIN_CYCLE = 1
const MAX_CYCLE = 366

export const KalendariTemplateTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const modeValue = useBindingValue(MODE_BINDING)
  // resolveEnumValue возвращает option.value; нам нужен code — читаем из объекта/строки напрямую
  const modeCode =
    typeof modeValue === 'string'
      ? modeValue
      : ((modeValue as { code?: string } | undefined)?.code ?? '')
  const cyclic = modeCode === CYCLIC_CODE

  const checkboxCol = (node.children ?? []).find(
    (c) => c.type === 'TABLE_COLUMN' && c.binding === 'DenVklyuchenVGrafik'
  )
  const col = checkboxCol ? nodeToTableColumnDef(checkboxCol) : undefined
  const columns = col ? [col] : []

  const sync = useTableSync(node, columns)

  const rowLabel = (index: number): string =>
    cyclic
      ? t('sdui.kalendari.dayN', { n: index + 1 })
      : (WEEKDAY_LABELS[index] ?? String(index + 1))

  const handleCycleLength = (raw: string) => {
    const n = Math.max(
      MIN_CYCLE,
      Math.min(MAX_CYCLE, Math.floor(Number(raw) || 0))
    )
    if (!Number.isFinite(n) || n < MIN_CYCLE) return
    const current = sync.rows
    const next: SyncRow[] = Array.from({ length: n }, (_, i) =>
      i < current.length
        ? current[i]
        : { rowId: `tmp-${crypto.randomUUID()}`, DenVklyuchenVGrafik: false }
    )
    sync.replaceRows(next)
  }

  if (!col) return null

  return (
    <div className="flex flex-col gap-2">
      {cyclic && (
        <TextInput
          label={t('sdui.kalendari.cycleLength')}
          value={String(sync.rows.length)}
          type="number"
          size="small"
          onChange={(e) => handleCycleLength(e.target.value)}
          sx={{ maxWidth: 160 }}
        />
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 160 }}>
                {t('sdui.kalendari.dayColumn')}
              </TableCell>
              <TableCell>
                {col.label || t('sdui.kalendari.workingDay')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sync.rows.map((row, index) => (
              <TableRow key={row.rowId}>
                <TableCell>{rowLabel(index)}</TableCell>
                <TableCell>
                  <TableCellEditor
                    cellWidget={col.cellWidget}
                    dataType={col.dataType}
                    value={row[col.binding]}
                    props={col.props}
                    onChange={(val) =>
                      sync.updateCell(row.rowId, col.binding, val)
                    }
                    onCommit={() => sync.commitCell()}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
```

Примечание: `TextInput` — из `@/shared/ui/inputs` (используется в `table-cell-editor.tsx`). Если у него нет пропа `type`/`label` в нужной форме — использовать MUI `TextField` напрямую с `label`, `type="number"`, `inputProps={{ min: 1, max: 366 }}` и `aria-label` = `t('sdui.kalendari.cycleLength')`. Ключевое для теста — доступность по `getByLabelText('sdui.kalendari.cycleLength')`.

- [ ] **Step 5: Прогнать — убедиться, что проходит**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/kalendari-template-table.test.tsx`
Expected: PASS (5 тестов). Если `getByLabelText` не находит инпут — переключить контрол на MUI `TextField` с явным `label`.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/kalendari-template-table.tsx src/features/sdui/ui/nodes/composite/kalendari-template-table.test.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: KalendariTemplateTable — шаблон заполнения (недели/циклы, длина цикла) (SCRUM-278 п.2)"
```

---

### Task 4: `KalendariScheduleTable` — раскрываемое расписание работы

**Поведение (спека §Расписание работы, v2-back §4):**

- Изначально свёрнуто. Раскрывается по кнопке «Заполнить расписание» (когда пусто) или по клику на саммари уже заполненного времени.
- Внутри — стандартная редактируемая таблица интервалов `{rowId, NomerDnya, VremyaNachala, VremyaOkonchaniya}` — переиспользуем `EditableTable` (add/delete/edit через тот же `use-table-sync`).
- Несколько интервалов на один `NomerDnya` валидны; в саммари их часы суммируются. `NomerDnya: 0` (предпраздничный) фронт сам не удаляет — бэк чистит при сохранении.

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.ts` (чистая функция суммирования)
- Create: `src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.test.ts`
- Create: `src/features/sdui/ui/nodes/composite/kalendari-schedule-table.tsx`
- Create: `src/features/sdui/ui/nodes/composite/kalendari-schedule-table.test.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx` (экспортировать `extractEditableColumns`)

**Interfaces:**

- Consumes: `EditableTable` из `./editable-table`; `extractEditableColumns` из `./table-node` (сделать экспортируемой); `useBindingValue`.
- Produces: `export const KalendariScheduleTable: FC<NodeProps>` (роутится из `table-node.tsx` по `binding === 'RaspisanieRaboty'`, Task 5); `summarizeSchedule(rows): { totalHours: number; dayCount: number }`.

- [ ] **Step 1: Написать падающий тест суммирования**

`src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { summarizeSchedule } from './kalendari-schedule-summary'

describe('summarizeSchedule', () => {
  it('суммирует часы всех интервалов', () => {
    const rows = [
      {
        rowId: '1',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T18:00:00',
      },
      {
        rowId: '2',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T19:00:00',
        VremyaOkonchaniya: '2000-01-01T21:00:00',
      },
    ]
    expect(summarizeSchedule(rows).totalHours).toBe(11)
  })
  it('пустой список → 0 часов, 0 дней', () => {
    expect(summarizeSchedule([])).toEqual({ totalHours: 0, dayCount: 0 })
  })
  it('считает уникальные NomerDnya', () => {
    const rows = [
      {
        rowId: '1',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T10:00:00',
      },
      {
        rowId: '2',
        NomerDnya: 2,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T10:00:00',
      },
    ]
    expect(summarizeSchedule(rows).dayCount).toBe(2)
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать суммирование**

`src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.ts`:

```ts
interface ScheduleRow {
  rowId: string
  NomerDnya?: number
  VremyaNachala?: unknown
  VremyaOkonchaniya?: unknown
}

const MS_PER_HOUR = 3_600_000

/** Часы интервала (конец−начало); неполные/битые интервалы дают 0. */
function intervalHours(start: unknown, end: unknown): number {
  if (typeof start !== 'string' || typeof end !== 'string') return 0
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0
  return (b - a) / MS_PER_HOUR
}

/** Саммари расписания: суммарные часы всех интервалов и число уникальных дней. */
export function summarizeSchedule(rows: ScheduleRow[]): {
  totalHours: number
  dayCount: number
} {
  let totalHours = 0
  const days = new Set<number>()
  for (const r of rows) {
    totalHours += intervalHours(r.VremyaNachala, r.VremyaOkonchaniya)
    if (typeof r.NomerDnya === 'number') days.add(r.NomerDnya)
  }
  return { totalHours, dayCount: days.size }
}
```

- [ ] **Step 4: Прогнать — убедиться, что проходит**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Экспортировать `extractEditableColumns` из table-node**

В `src/features/sdui/ui/nodes/composite/table-node.tsx` заменить `function extractEditableColumns(` на `export function extractEditableColumns(` (стр. 122).

- [ ] **Step 6: Написать падающие тесты компонента**

`src/features/sdui/ui/nodes/composite/kalendari-schedule-table.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const sessionState: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
// EditableTable-стаб: маркер раскрытой таблицы, без глубоких зависимостей
vi.mock('./editable-table', () => ({
  EditableTable: () => <div data-testid="editable-table" />,
}))

import { KalendariScheduleTable } from './kalendari-schedule-table'

const node = (): ViewNode => ({
  id: 'dict.field.RaspisanieRaboty',
  type: 'TABLE',
  binding: 'RaspisanieRaboty',
  props: { editable: true, allowAdd: true, allowDelete: true },
  children: [
    {
      id: 'c1',
      type: 'TABLE_COLUMN',
      binding: 'NomerDnya',
      props: { dataType: 'INTEGER', cellWidget: 'NUMBER_FIELD' },
    },
    {
      id: 'c2',
      type: 'TABLE_COLUMN',
      binding: 'VremyaNachala',
      props: { dataType: 'DATETIME', cellWidget: 'DATETIME_FIELD' },
    },
    {
      id: 'c3',
      type: 'TABLE_COLUMN',
      binding: 'VremyaOkonchaniya',
      props: { dataType: 'DATETIME', cellWidget: 'DATETIME_FIELD' },
    },
  ],
})

afterEach(() => {
  cleanup()
  for (const k of Object.keys(sessionState)) delete sessionState[k]
})

describe('KalendariScheduleTable', () => {
  it('свёрнуто по умолчанию: таблицы нет, есть кнопка «Заполнить расписание»', () => {
    sessionState.RaspisanieRaboty = []
    render(<KalendariScheduleTable node={node()} />)
    expect(screen.queryByTestId('editable-table')).toBeNull()
    expect(screen.getByText('sdui.kalendari.fillSchedule')).toBeTruthy()
  })

  it('клик по кнопке раскрывает таблицу', () => {
    sessionState.RaspisanieRaboty = []
    render(<KalendariScheduleTable node={node()} />)
    fireEvent.click(screen.getByText('sdui.kalendari.fillSchedule'))
    expect(screen.getByTestId('editable-table')).toBeTruthy()
  })

  it('есть заполненное время → показывает саммари; клик по нему раскрывает', () => {
    sessionState.RaspisanieRaboty = [
      {
        rowId: '1',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T18:00:00',
      },
    ]
    render(<KalendariScheduleTable node={node()} />)
    const summary = screen.getByRole('button', {
      name: /sdui\.kalendari\.schedule/,
    })
    expect(summary).toBeTruthy()
    fireEvent.click(summary)
    expect(screen.getByTestId('editable-table')).toBeTruthy()
  })
})
```

- [ ] **Step 7: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/kalendari-schedule-table.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 8: Реализовать компонент**

`src/features/sdui/ui/nodes/composite/kalendari-schedule-table.tsx`:

```tsx
import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useBindingValue } from '../../../lib/sdui-session-context'
import type { TableRow } from '../../../lib/hooks/use-table-sync'
import { EditableTable } from './editable-table'
import { extractEditableColumns } from './table-node'
import { summarizeSchedule } from './kalendari-schedule-summary'

export const KalendariScheduleTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const rows = (useBindingValue(node.binding) as TableRow[] | undefined) ?? []
  const summary = summarizeSchedule(rows)
  const hasSchedule = rows.length > 0

  if (expanded) {
    const columns = extractEditableColumns(node.children)
    return <EditableTable node={node} columns={columns} />
  }

  if (!hasSchedule) {
    return (
      <Button variant="outlined" size="small" onClick={() => setExpanded(true)}>
        {t('sdui.kalendari.fillSchedule')}
      </Button>
    )
  }

  return (
    <Button variant="text" size="small" onClick={() => setExpanded(true)}>
      {`${t('sdui.kalendari.schedule')}: ${summary.totalHours} ч`}
    </Button>
  )
}
```

- [ ] **Step 9: Прогнать — убедиться, что проходит**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/kalendari-schedule-table.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 10: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.ts src/features/sdui/ui/nodes/composite/kalendari-schedule-summary.test.ts src/features/sdui/ui/nodes/composite/kalendari-schedule-table.tsx src/features/sdui/ui/nodes/composite/kalendari-schedule-table.test.tsx src/features/sdui/ui/nodes/composite/table-node.tsx
git commit -m "feat: KalendariScheduleTable — раскрываемое расписание работы (SCRUM-278 п.3)"
```

---

### Task 5: `table-node.tsx` — ветка роутинга по binding-дискриминатору

**Поведение (v2-back §1):** внутри `editable`-ветки, ДО роутинга на `ComplexEditableTable`/`EditableTable`, распознать kalendari-таблицы по `node.binding`: `ShablonZapolneniya` → `KalendariTemplateTable`, `RaspisanieRaboty` → `KalendariScheduleTable`. Никаких спец-пропов.

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/table-node.test.ts`

**Interfaces:**

- Consumes: `KalendariTemplateTable` (Task 3), `KalendariScheduleTable` (Task 4).

- [ ] **Step 1: Написать падающий тест роутинга**

Дописать в `src/features/sdui/ui/nodes/composite/table-node.test.ts`. Тест проверяет чистую функцию-дискриминатор (без рендера MUI-дерева):

```ts
import { describe, expect, it } from 'vitest'

import { kalendariTableKind } from './table-node'

describe('kalendariTableKind', () => {
  it('binding ShablonZapolneniya → template', () => {
    expect(kalendariTableKind('ShablonZapolneniya')).toBe('template')
  })
  it('binding RaspisanieRaboty → schedule', () => {
    expect(kalendariTableKind('RaspisanieRaboty')).toBe('schedule')
  })
  it('прочие binding → null', () => {
    expect(kalendariTableKind('SomeOtherTable')).toBeNull()
    expect(kalendariTableKind(undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: FAIL — `kalendariTableKind` не экспортирована.

- [ ] **Step 3: Реализовать дискриминатор и ветку роутинга**

В `src/features/sdui/ui/nodes/composite/table-node.tsx`:

Добавить импорты:

```tsx
import { KalendariTemplateTable } from './kalendari-template-table'
import { KalendariScheduleTable } from './kalendari-schedule-table'
```

Добавить функцию-дискриминатор (рядом с `extractEditableColumns`):

```tsx
/**
 * Дискриминатор kalendari-таблиц по binding (v2-back §1). Спец-пропа нет —
 * классификация намеренно ограничена карточкой Kalendari (реестр §9, D-10).
 */
export function kalendariTableKind(
  binding: string | undefined
): 'template' | 'schedule' | null {
  if (binding === 'ShablonZapolneniya') return 'template'
  if (binding === 'RaspisanieRaboty') return 'schedule'
  return null
}
```

В `TableNode`, внутри `if (editable) {` — ПЕРВОЙ проверкой (до hasGroups/hasMasterDetail):

```tsx
  if (editable) {
    const kalendariKind = kalendariTableKind(node.binding)
    if (kalendariKind === 'template') return <KalendariTemplateTable node={node} />
    if (kalendariKind === 'schedule') return <KalendariScheduleTable node={node} />

    // Route to complex table if COLUMN_GROUP children exist or master-detail props present
    const hasGroups = node.children?.some((c) => c.type === 'COLUMN_GROUP')
    ...
```

- [ ] **Step 4: Прогнать — убедиться, что проходит (и старые тесты table-node живы)**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/composite src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/table-node.test.ts
git commit -m "feat: table-node роутит kalendari-таблицы по binding-дискриминатору (SCRUM-278)"
```

---

### Task 6: `calendar-node` — строго read-only календарь результата

**Поведение (спека §Календарь результата, п.4):** удалить путь `kalendari.den.toggle` целиком вместе с одноразовым тостом «Изменения применяются сразу» (бэк отвергает toggle). Остаётся только `kalendari.god.change`. Дни всегда disabled/некликабельны. Начальный `god` приходит с бэка — фронт не вычисляет (уже так).

**Files:**

- Modify: `src/features/sdui/ui/nodes/calendar/calendar-node.tsx`
- Modify: `src/features/sdui/ui/nodes/calendar/calendar-node.test.tsx`
- Modify: `src/features/sdui/ui/nodes/calendar/month-grid.tsx`
- Modify: `src/features/sdui/ui/nodes/calendar/month-grid.test.tsx`
- Modify: `src/features/sdui/ui/nodes/calendar/calendar-day-cell.tsx`
- Modify: `src/features/sdui/ui/nodes/calendar/calendar-day-cell.test.tsx`
- Modify: `src/app/config/i18n/locales/ru/common.json` (удалить `sdui.calendar.applyImmediately`)
- Modify: `src/app/config/i18n/locales/kz/common.json` (удалить `sdui.calendar.applyImmediately`)

**Interfaces:**

- `MonthGrid` и `CalendarDayCell` теряют пропы `editable`/`onToggle` — становятся чисто отображающими. `CalendarDayCell` рендерит `<button type="button" disabled>` всегда (данные-атрибуты `data-working`/`data-manual` сохраняются для стилей/тестов).

- [ ] **Step 1: Обновить тесты calendar-node (toggle-путь удалён)**

В `src/features/sdui/ui/nodes/calendar/calendar-node.test.tsx`:

- Удалить `showToast` из `vi.hoisted`, `vi.mock('@/shared/ui/toast/show-toast', ...)`.
- Из стаба `MonthGrid` убрать `onToggle` (стаб становится `({ month }) => <span>m{month}</span>`).
- Удалить тесты «клик по дню шлёт COMMAND kalendari.den.toggle…», «первый тоггл показывает toast…», «отклонённый тоггл…».
- Оставить/адаптировать: «рендерит 12 месяцев», «смена года шлёт COMMAND kalendari.god.change», «god отсутствует → ничего не рендерит».
- Добавить тест «клик по дню НЕ шлёт dispatch»:

```tsx
it('дни некликабельны: клик по ячейке не шлёт никакой dispatch', () => {
  render(<CalendarNode node={node(baseProps)} />)
  // в реальном DOM день — disabled button; убеждаемся, что toggle-команда невозможна
  const before = dispatch.mock.calls.length
  // никаких onToggle-стабов больше нет; проверяем, что смена года — единственный dispatch-путь
  fireEvent.click(screen.getByText('year'))
  expect(dispatch).toHaveBeenCalledTimes(before + 1)
  expect(
    dispatch.mock.calls.every(([a]) => a.command !== 'kalendari.den.toggle')
  ).toBe(true)
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/calendar src/features/sdui/ui/nodes/calendar/calendar-node.test.tsx`
Expected: FAIL — компонент ещё импортирует toast/шлёт toggle; удалённые моки ломают компиляцию.

- [ ] **Step 3: Переписать calendar-node в read-only**

`src/features/sdui/ui/nodes/calendar/calendar-node.tsx` — убрать `useRef`, `showToast`, `t`-использование для applyImmediately, `handleToggle`, `editable`. Итог:

```tsx
import { type FC } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import type {
  CalendarDay,
  CalendarNodeProps,
} from '../../../lib/calendar/calendar-types'
import { MonthGrid } from './month-grid'
import { YearSelector } from './year-selector'
import { CalendarLegend } from './calendar-legend'

const MONTHS = Array.from({ length: 12 }, (_, i) => i)
const WEEKDAY_LABELS = MONTHS.slice(0, 7).map((i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)

export const CalendarNode: FC<NodeProps> = ({ node }) => {
  const p = node.props as CalendarNodeProps | undefined
  const dispatch = useSduiDispatch()

  const god = p?.god
  if (god == null) return null

  const daysByDate = new Map<string, CalendarDay>()
  for (const d of p?.dni ?? []) daysByDate.set(d.data, d)

  const monthLabel = (m: number) =>
    format(new Date(god, m, 1), 'LLLL', { locale: ru })
  const dayAriaLabel = (y: number, m: number, d: number) =>
    format(new Date(y, m, d), 'd MMMM yyyy', { locale: ru })

  const handleYearChange = (year: number) => {
    void dispatch({
      type: 'COMMAND',
      command: 'kalendari.god.change',
      value: year,
      sourceNodeId: node.id,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <YearSelector
          god={god}
          godMin={p?.godMin}
          godMax={p?.godMax}
          onChange={handleYearChange}
        />
        <CalendarLegend />
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-4 gap-4 min-w-[720px]">
          {MONTHS.map((m) => (
            <MonthGrid
              key={m}
              year={god}
              month={m}
              monthLabel={monthLabel(m)}
              weekdayLabels={WEEKDAY_LABELS}
              daysByDate={daysByDate}
              dayAriaLabel={dayAriaLabel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Упростить MonthGrid (убрать editable/onToggle)**

`src/features/sdui/ui/nodes/calendar/month-grid.tsx`: удалить из `MonthGridProps` поля `editable` и `onToggle`, убрать их из деструктуризации и из передачи в `CalendarDayCell`.

- [ ] **Step 5: Упростить CalendarDayCell (всегда disabled, без onToggle)**

`src/features/sdui/ui/nodes/calendar/calendar-day-cell.tsx`:

```tsx
import type { FC } from 'react'

import type { CalendarDay } from '../../../lib/calendar/calendar-types'

export interface CalendarDayCellProps {
  dayNumber: number
  day?: CalendarDay // нет в dni → трактуем как нерабочий
  ariaLabel: string
}

export const CalendarDayCell: FC<CalendarDayCellProps> = ({
  dayNumber,
  day,
  ariaLabel,
}) => {
  const vklyuchen = day?.vklyuchen ?? false
  const ruchnoy = day?.ruchnoy ?? false

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={vklyuchen}
      data-working={vklyuchen}
      data-manual={ruchnoy}
      disabled
      className={[
        'w-full h-7 text-sm rounded',
        vklyuchen ? 'text-[#2a75f4] font-semibold' : 'text-gray-400',
        ruchnoy ? 'bg-amber-100' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ cursor: 'default' }}
    >
      {dayNumber}
    </button>
  )
}
```

- [ ] **Step 6: Обновить тесты month-grid и calendar-day-cell**

В `calendar-day-cell.test.tsx`: убрать `editable`/`onToggle` из пропсов во всех рендерах; удалить тесты про клик/onToggle; добавить/оставить тест «кнопка всегда disabled»:

```tsx
it('день всегда disabled (read-only)', () => {
  render(
    <CalendarDayCell
      dayNumber={5}
      day={{ data: '2025-01-05', vklyuchen: true, ruchnoy: false }}
      ariaLabel="5"
    />
  )
  expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
})
```

В `month-grid.test.tsx`: убрать `editable`/`onToggle` из пропсов рендера; удалить проверки клика, если были.

- [ ] **Step 7: Удалить i18n-ключ applyImmediately**

Из `src/app/config/i18n/locales/ru/common.json` и `.../kz/common.json` удалить строку `"applyImmediately": ...` из объекта `sdui.calendar` (легенду оставить).

- [ ] **Step 8: Прогнать весь calendar-кластер**

Run: `npx vitest run --dir src/features/sdui/ui/nodes/calendar`
Expected: PASS (calendar-node, month-grid, calendar-day-cell, calendar-legend, year-selector).

- [ ] **Step 9: Commit**

```bash
git add src/features/sdui/ui/nodes/calendar/ src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: календарь результата строго read-only, kalendari.den.toggle удалён (SCRUM-278 п.4)"
```

---

### Task 7: Реестр отклонений §9 — актуализировать D-6, добавить D-10

**Зачем (процессное правило реестра, аудит §9 стр. 179-182):** нода/спека, вводящая новое знание протокола на фронт, обязана в том же PR обновить реестр. Здесь: `kalendari.den.toggle` удалён (D-6 частично закрыт), а binding-дискриминатор kalendari-таблиц — новое протокольное знание (D-10).

**Files:**

- Modify: `docs/superpowers/specs/2026-07-02-sdui-course-audit.md` (§9.2, таблица D-4…D-9)

- [ ] **Step 1: Обновить строку D-6**

В таблице §9.2 заменить строку D-6 на формулировку, отражающую удаление toggle:

```
| D-6 | Хардкод команды `kalendari.god.change` + транслит-пропсы CALENDAR (было также `kalendari.den.toggle` — **удалено SCRUM-278**: календарь результата read-only, toggle бэком отвергается) | `calendar-node.tsx`, `calendar-types.ts` | Команда в node.actions + generic-пропсы (B-2) |
```

- [ ] **Step 2: Добавить строку D-10**

Добавить в ту же таблицу новую строку:

```
| D-10 | Дискриминатор kalendari-таблиц по `binding` (`ShablonZapolneniya`→шаблон, `RaspisanieRaboty`→расписание) + чтение режима из enum `SposobZapolneniya.code`; фронтовая «длина цикла» (`DlinaTsikla` не нода) | `table-node.tsx` (`kalendariTableKind`), `kalendari-template-table.tsx`, `kalendari-schedule-table.tsx` | Бэк присылает роль таблицы generic-пропом на TABLE-ноде (аналог B-1/B-2), либо kalendari-карточки уходят из SDUI |
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-02-sdui-course-audit.md
git commit -m "docs: реестр §9 — D-6 (den.toggle удалён), D-10 (binding-дискриминатор kalendari) (SCRUM-278)"
```

---

## E2e-приёмка (после реализации, на dev-api)

Бэк влит в main; ноды приходят обычной `/api/view`-сессией. Прогнать чек-лист спеки v1 (7 пунктов, `description` тикета) на карточках графиков «01» Пятидневка-36 и «03» Семидневка, годы 2021–2027, + новая незаписанная карточка:

1. По умолчанию способ заполнения = «по неделям».
2. Результат заполнения соответствует году начала периода (`god` с бэка).
3. Циклический режим — есть ячейка «длина цикла»; недельный — нет.
4. Недели → дни недели в таблице; циклы → номера дней. Расписание раскрывается по «Заполнить расписание» / по клику на заполненное время.
5. Запись изменений проходит без ошибки; при ошибке клиентское состояние сохраняется, сырой SQL/500 не рендерится.
6. Календарь под «результат заполнения» некликабелен.
7. Enum-значение способа заполнения сохраняет форму (`{id, code, presentation}`) — режим корректен после перезагрузки карточки.

**Важно:** любое расхождение реального ответа с контрактом v2-back — остановиться и сообщить в Jira, НЕ добавлять клиентский воркэраунд.

## Self-Review

- **Spec coverage:** п.1 enum → Task 1; п.2 шаблон → Task 3 (+ Task 2 replaceRows); п.3 расписание → Task 4; п.4 read-only календарь → Task 6; binding-дискриминатор → Task 5; реестр §9 → Task 7; i18n ru/kz → Tasks 3,6; тесты — в каждой. E2e → отдельный раздел. Всё покрыто.
- **Type consistency:** `resolveEnumValue`/`EnumOption` (Task 1) едины в enum-field-node/table-cell-editor/template-table. `replaceRows(next: TableRow[])` (Task 2) вызывается в Task 3. `extractEditableColumns` экспортируется в Task 4 (step 5) и используется в Task 4 (step 8) и остаётся в Task 5. `kalendariTableKind` (Task 5) — единственный дискриминатор. `summarizeSchedule` возвращает `{ totalHours, dayCount }` — согласовано в тесте и компоненте.
- **Placeholder scan:** без TBD/TODO; весь код и тесты приведены дословно. Одна отмеченная развилка — контрол «длины цикла» (TextInput vs MUI TextField) с явным критерием выбора по `getByLabelText`.
