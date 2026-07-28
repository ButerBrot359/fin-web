# SDUI CALENDAR Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отрендерить новый SDUI-узел `CALENDAR` (годовой календарь графика работы) и обработать две команды — клик по дню и смену года.

**Architecture:** Узел рендерит из `node.props` (своего состояния данных нет). Клик/смена года шлют COMMAND через `useSduiDispatch()`; сервер отвечает патчем `replaceNode`, который перерисовывает узел через существующий пайплайн `dispatch → applyTreePatches`. Кастомная сетка на date-fns, декомпозиция на мелкие компоненты + чистый хелпер раскладки недель.

**Tech Stack:** React 19, TypeScript, TailwindCSS, MUI, date-fns v4, react-i18next, Vitest + @testing-library/react.

**Спека-первоисточник:** `docs/superpowers/specs/2026-07-29-sdui-calendar-node-design.md` и `specs-local/scrum-278-grafiki-raboty/231-kalendari-e4b-front-peredacha.md`.

## Global Constraints

- Зона строго **SDUI** (`src/features/sdui/`). Прямые импорты в/из легаси запрещены.
- Тексты — только через `useTranslation` из `react-i18next`, ключи в `common.json` (ru + kz). Не хардкодить строки.
- Никаких `useMemo`/`useCallback` без явной причины перфа.
- Цель ~200 строк/файл. Barrel-файлы (`index.ts`) — только на уровне слайса, внутри сегмента не создаём. Импорты — из конкретных файлов.
- Дублировать серверные бизнес-правила на клиенте нельзя — источник истины сервер.
- Контракт патча: op называется **`replaceNode`** (camelCase) — уже поддержан в `patch-applier.ts`, спец-обработки в ноде не требуется.
- Команды: `{ type: 'COMMAND', command, value, sourceNodeId }`.
- Формат коммитов: `feat|fix|add|refactor: описание`.
- Тест-раннер: `npx vitest run <path>`.

---

## Файловая структура

```
src/features/sdui/
  lib/calendar/
    calendar-types.ts        # CalendarDay, CalendarNodeProps, WeekCell (Task 1)
    build-month-weeks.ts     # чистая раскладка месяца по неделям, пн-первый (Task 1)
  ui/nodes/calendar/
    calendar-day-cell.tsx    # ячейка дня: 3 состояния, клик через onToggle (Task 2)
    month-grid.tsx           # один месяц: заголовок, дни недели, недели (Task 3)
    year-selector.tsx        # стрелки + дропдаун года (Task 4)
    calendar-legend.tsx      # легенда 3 состояний (Task 5)
    calendar-node.tsx        # входная нода: сборка, dispatch, одноразовый toast (Task 6)
  lib/component-registry.ts  # +CALENDAR (Task 6)
  types/node-types.ts        # +'CALENDAR' в union NodeType (Task 6)
src/app/config/i18n/locales/{ru,kz}/common.json  # sdui.calendar.* (Task 5, Task 6)
```

---

### Task 1: Типы и чистая раскладка месяца

**Files:**
- Create: `src/features/sdui/lib/calendar/calendar-types.ts`
- Create: `src/features/sdui/lib/calendar/build-month-weeks.ts`
- Test: `src/features/sdui/lib/calendar/build-month-weeks.test.ts`

**Interfaces:**
- Produces:
  - `interface CalendarDay { data: string; vklyuchen: boolean; ruchnoy: boolean }`
  - `interface CalendarNodeProps { god?: number; godMin?: number | null; godMax?: number | null; redaktiruemyy?: boolean; dni?: CalendarDay[] }`
  - `type WeekCell = number | null`
  - `function buildMonthWeeks(year: number, month: number): WeekCell[][]` — `month` 0-индексный (0=январь); `null` = пустая ячейка-заполнитель.

- [ ] **Step 1: Написать типы**

Создать `calendar-types.ts`:

```ts
// Один день года из props узла CALENDAR
export interface CalendarDay {
  data: string // 'YYYY-MM-DD'
  vklyuchen: boolean // рабочий день
  ruchnoy: boolean // изменён вручную
}

// props узла CALENDAR (см. контракт в спеке)
export interface CalendarNodeProps {
  god?: number
  godMin?: number | null
  godMax?: number | null
  redaktiruemyy?: boolean
  dni?: CalendarDay[]
}

// Ячейка недельной сетки: номер дня месяца (1..31) или null для добивки
export type WeekCell = number | null
```

- [ ] **Step 2: Написать падающий тест**

Создать `build-month-weeks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildMonthWeeks } from './build-month-weeks'

describe('buildMonthWeeks: раскладка месяца, понедельник — первый', () => {
  it('январь 2025 (01.01 — среда): 2 пустых в начале, 31 день, 5 недель', () => {
    const weeks = buildMonthWeeks(2025, 0)
    expect(weeks[0]).toEqual([null, null, 1, 2, 3, 4, 5])
    expect(weeks).toHaveLength(5)
    const days = weeks.flat().filter((c) => c !== null)
    expect(days).toHaveLength(31)
    expect(days[days.length - 1]).toBe(31)
  })

  it('февраль 2024 (високосный): 29 дней, нет 30-го', () => {
    const weeks = buildMonthWeeks(2024, 1)
    const days = weeks.flat().filter((c) => c !== null)
    expect(days).toHaveLength(29)
    expect(days).toContain(29)
    expect(days).not.toContain(30)
  })

  it('каждая неделя ровно 7 ячеек', () => {
    const weeks = buildMonthWeeks(2025, 5)
    for (const w of weeks) expect(w).toHaveLength(7)
  })
})
```

- [ ] **Step 3: Прогнать тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/lib/calendar/build-month-weeks.test.ts`
Expected: FAIL — `buildMonthWeeks is not a function` / модуль не найден.

- [ ] **Step 4: Реализовать раскладку**

Создать `build-month-weeks.ts`:

```ts
import { getDay, getDaysInMonth } from 'date-fns'

import type { WeekCell } from './calendar-types'

// month — 0-индексный (0 = январь). Понедельник — первый день недели.
export function buildMonthWeeks(year: number, month: number): WeekCell[][] {
  const first = new Date(year, month, 1)
  const daysInMonth = getDaysInMonth(first)
  // getDay: 0=вс..6=сб → приводим к пн-первому: 0=пн..6=вс
  const leading = (getDay(first) + 6) % 7

  const cells: WeekCell[] = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: WeekCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
```

- [ ] **Step 5: Прогнать тест — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/lib/calendar/build-month-weeks.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/lib/calendar/
git commit -m "feat: раскладка месяца по неделям + типы календаря (SCRUM-278)"
```

---

### Task 2: Ячейка дня

**Files:**
- Create: `src/features/sdui/ui/nodes/calendar/calendar-day-cell.tsx`
- Test: `src/features/sdui/ui/nodes/calendar/calendar-day-cell.test.tsx`

**Interfaces:**
- Consumes: `CalendarDay` из `../../../lib/calendar/calendar-types`.
- Produces:
  - `interface CalendarDayCellProps { dayNumber: number; day?: CalendarDay; editable: boolean; onToggle: (data: string) => void; ariaLabel: string }`
  - `const CalendarDayCell: FC<CalendarDayCellProps>` — кликабельна только при `editable && day != null`; тестовые атрибуты `data-working`, `data-manual`.

- [ ] **Step 1: Написать падающий тест**

Создать `calendar-day-cell.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CalendarDayCell } from './calendar-day-cell'

afterEach(cleanup)

const day = (over: Partial<{ vklyuchen: boolean; ruchnoy: boolean }> = {}) => ({
  data: '2025-03-15',
  vklyuchen: over.vklyuchen ?? false,
  ruchnoy: over.ruchnoy ?? false,
})

describe('CalendarDayCell', () => {
  it('рабочий день помечен data-working=true', () => {
    render(
      <CalendarDayCell
        dayNumber={15}
        day={day({ vklyuchen: true })}
        editable
        onToggle={vi.fn()}
        ariaLabel="15 марта 2025"
      />,
    )
    const btn = screen.getByRole('button', { name: '15 марта 2025' })
    expect(btn.getAttribute('data-working')).toBe('true')
  })

  it('ручной день помечен data-manual=true', () => {
    render(
      <CalendarDayCell
        dayNumber={15}
        day={day({ ruchnoy: true })}
        editable
        onToggle={vi.fn()}
        ariaLabel="d"
      />,
    )
    expect(screen.getByRole('button').getAttribute('data-manual')).toBe('true')
  })

  it('editable=true: клик шлёт onToggle с датой', () => {
    const onToggle = vi.fn()
    render(
      <CalendarDayCell dayNumber={15} day={day()} editable onToggle={onToggle} ariaLabel="d" />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('2025-03-15')
  })

  it('editable=false: кнопка disabled, клик молчит', () => {
    const onToggle = vi.fn()
    render(
      <CalendarDayCell dayNumber={15} day={day()} editable={false} onToggle={onToggle} ariaLabel="d" />,
    )
    const btn = screen.getByRole('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onToggle).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/calendar-day-cell.test.tsx`
Expected: FAIL — модуль `./calendar-day-cell` не найден.

- [ ] **Step 3: Реализовать ячейку**

Создать `calendar-day-cell.tsx`:

```tsx
import type { FC } from 'react'

import type { CalendarDay } from '../../../lib/calendar/calendar-types'

export interface CalendarDayCellProps {
  dayNumber: number
  day?: CalendarDay // нет в dni → трактуем как нерабочий
  editable: boolean
  onToggle: (data: string) => void
  ariaLabel: string
}

export const CalendarDayCell: FC<CalendarDayCellProps> = ({
  dayNumber,
  day,
  editable,
  onToggle,
  ariaLabel,
}) => {
  const vklyuchen = day?.vklyuchen ?? false
  const ruchnoy = day?.ruchnoy ?? false
  const clickable = editable && day != null

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={vklyuchen}
      data-working={vklyuchen}
      data-manual={ruchnoy}
      disabled={!clickable}
      onClick={() => {
        if (clickable) onToggle(day.data)
      }}
      className={[
        'w-full h-7 text-sm rounded',
        vklyuchen ? 'text-[#2a75f4] font-semibold' : 'text-gray-400',
        ruchnoy ? 'bg-amber-100' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      {dayNumber}
    </button>
  )
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/calendar-day-cell.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/calendar/calendar-day-cell.tsx src/features/sdui/ui/nodes/calendar/calendar-day-cell.test.tsx
git commit -m "feat: ячейка дня календаря — 3 состояния, клик-гард (SCRUM-278)"
```

---

### Task 3: Сетка месяца

**Files:**
- Create: `src/features/sdui/ui/nodes/calendar/month-grid.tsx`
- Test: `src/features/sdui/ui/nodes/calendar/month-grid.test.tsx`

**Interfaces:**
- Consumes: `buildMonthWeeks`, `CalendarDay`, `CalendarDayCell`.
- Produces:
  - `interface MonthGridProps { year: number; month: number; monthLabel: string; weekdayLabels: string[]; daysByDate: Map<string, CalendarDay>; editable: boolean; onToggle: (data: string) => void; dayAriaLabel: (year: number, month: number, day: number) => string }`
  - `const MonthGrid: FC<MonthGridProps>` — рендерит заголовок месяца, строку `weekdayLabels`, недели из `buildMonthWeeks`; ISO-дата ячейки собирается как `` `${year}-${pad(month+1)}-${pad(day)}` ``.

- [ ] **Step 1: Написать падающий тест**

Создать `month-grid.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CalendarDay } from '../../../lib/calendar/calendar-types'
import { MonthGrid } from './month-grid'

afterEach(cleanup)

const base = {
  year: 2025,
  month: 0,
  monthLabel: 'январь',
  weekdayLabels: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
  editable: true,
  dayAriaLabel: (_y: number, _m: number, d: number) => `день ${d}`,
}

describe('MonthGrid', () => {
  it('рендерит заголовок месяца и 7 подписей дней недели', () => {
    render(
      <MonthGrid {...base} daysByDate={new Map()} onToggle={vi.fn()} />,
    )
    expect(screen.getByText('январь')).toBeTruthy()
    for (const w of base.weekdayLabels) expect(screen.getByText(w)).toBeTruthy()
  })

  it('рендерит все дни месяца (1..31 для января)', () => {
    render(<MonthGrid {...base} daysByDate={new Map()} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'день 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'день 31' })).toBeTruthy()
  })

  it('клик по дню шлёт onToggle с ISO-датой (0-паддинг)', () => {
    const onToggle = vi.fn()
    const days = new Map<string, CalendarDay>([
      ['2025-01-05', { data: '2025-01-05', vklyuchen: true, ruchnoy: false }],
    ])
    render(<MonthGrid {...base} daysByDate={days} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'день 5' }))
    expect(onToggle).toHaveBeenCalledWith('2025-01-05')
  })
})
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/month-grid.test.tsx`
Expected: FAIL — модуль `./month-grid` не найден.

- [ ] **Step 3: Реализовать сетку месяца**

Создать `month-grid.tsx`:

```tsx
import type { FC } from 'react'

import { buildMonthWeeks } from '../../../lib/calendar/build-month-weeks'
import type { CalendarDay } from '../../../lib/calendar/calendar-types'
import { CalendarDayCell } from './calendar-day-cell'

export interface MonthGridProps {
  year: number
  month: number // 0-индексный
  monthLabel: string
  weekdayLabels: string[]
  daysByDate: Map<string, CalendarDay>
  editable: boolean
  onToggle: (data: string) => void
  dayAriaLabel: (year: number, month: number, day: number) => string
}

const pad = (n: number) => String(n).padStart(2, '0')

export const MonthGrid: FC<MonthGridProps> = ({
  year,
  month,
  monthLabel,
  weekdayLabels,
  daysByDate,
  editable,
  onToggle,
  dayAriaLabel,
}) => {
  const weeks = buildMonthWeeks(year, month)

  return (
    <div className="flex flex-col gap-1">
      <div className="font-semibold capitalize">{monthLabel}</div>
      <div className="grid grid-cols-7 text-xs text-gray-500">
        {weekdayLabels.map((w, i) => (
          <span key={i} className="text-center">
            {w}
          </span>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((cell, ci) => {
            if (cell == null) return <span key={ci} />
            const iso = `${year}-${pad(month + 1)}-${pad(cell)}`
            return (
              <CalendarDayCell
                key={ci}
                dayNumber={cell}
                day={daysByDate.get(iso)}
                editable={editable}
                onToggle={onToggle}
                ariaLabel={dayAriaLabel(year, month, cell)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/month-grid.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/calendar/month-grid.tsx src/features/sdui/ui/nodes/calendar/month-grid.test.tsx
git commit -m "feat: сетка месяца календаря (SCRUM-278)"
```

---

### Task 4: Селектор года

**Files:**
- Create: `src/features/sdui/ui/nodes/calendar/year-selector.tsx`
- Test: `src/features/sdui/ui/nodes/calendar/year-selector.test.tsx`

**Interfaces:**
- Produces:
  - `interface YearSelectorProps { god: number; godMin?: number | null; godMax?: number | null; onChange: (year: number) => void }`
  - `const YearSelector: FC<YearSelectorProps>` — стрелка «назад» disabled при `god <= godMin`; «вперёд» disabled при `god >= godMax`; `godMax == null` = вперёд без ограничения. Кнопки: `aria-label="prev-year"` / `"next-year"`. Дропдаун диапазона `godMin..godMax` (при `null` — окно `god±5`).

- [ ] **Step 1: Написать падающий тест**

Создать `year-selector.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { YearSelector } from './year-selector'

afterEach(cleanup)

describe('YearSelector', () => {
  it('стрелка «назад» шлёт god-1', () => {
    const onChange = vi.fn()
    render(<YearSelector god={2025} godMin={2021} godMax={2027} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('prev-year'))
    expect(onChange).toHaveBeenCalledWith(2024)
  })

  it('на нижней границе «назад» disabled', () => {
    render(<YearSelector god={2021} godMin={2021} godMax={2027} onChange={vi.fn()} />)
    expect((screen.getByLabelText('prev-year') as HTMLButtonElement).disabled).toBe(true)
  })

  it('godMax=null: «вперёд» активна', () => {
    render(<YearSelector god={2027} godMin={2021} godMax={null} onChange={vi.fn()} />)
    expect((screen.getByLabelText('next-year') as HTMLButtonElement).disabled).toBe(false)
  })
})
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/year-selector.test.tsx`
Expected: FAIL — модуль `./year-selector` не найден.

- [ ] **Step 3: Реализовать селектор**

Создать `year-selector.tsx`:

```tsx
import type { FC } from 'react'
import { IconButton, MenuItem, Select } from '@mui/material'

const FORWARD_SPAN = 5 // при godMax=null окно дропдауна вперёд

export interface YearSelectorProps {
  god: number
  godMin?: number | null
  godMax?: number | null
  onChange: (year: number) => void
}

export const YearSelector: FC<YearSelectorProps> = ({ god, godMin, godMax, onChange }) => {
  const min = godMin ?? god - FORWARD_SPAN
  const max = godMax ?? god + FORWARD_SPAN
  const years: number[] = []
  for (let y = min; y <= max; y++) years.push(y)

  const canPrev = godMin == null || god > godMin
  const canNext = godMax == null || god < godMax

  return (
    <div className="flex items-center gap-2">
      <IconButton
        size="small"
        aria-label="prev-year"
        disabled={!canPrev}
        onClick={() => onChange(god - 1)}
      >
        ‹
      </IconButton>
      <Select
        size="small"
        value={god}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {years.map((y) => (
          <MenuItem key={y} value={y}>
            {y}
          </MenuItem>
        ))}
      </Select>
      <IconButton
        size="small"
        aria-label="next-year"
        disabled={!canNext}
        onClick={() => onChange(god + 1)}
      >
        ›
      </IconButton>
    </div>
  )
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/year-selector.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/calendar/year-selector.tsx src/features/sdui/ui/nodes/calendar/year-selector.test.tsx
git commit -m "feat: селектор года календаря (SCRUM-278)"
```

---

### Task 5: Легенда + i18n-ключи

**Files:**
- Create: `src/features/sdui/ui/nodes/calendar/calendar-legend.tsx`
- Test: `src/features/sdui/ui/nodes/calendar/calendar-legend.test.tsx`
- Modify: `src/app/config/i18n/locales/ru/common.json` (добавить `sdui.calendar`)
- Modify: `src/app/config/i18n/locales/kz/common.json` (добавить `sdui.calendar`)

**Interfaces:**
- Produces: `const CalendarLegend: FC` — три подписи через `t('sdui.calendar.legend.working'|'nonWorking'|'manual')`.

- [ ] **Step 1: Добавить i18n-ключи (ru)**

В `src/app/config/i18n/locales/ru/common.json` внутри объекта `"sdui"` добавить ключ `calendar` (рядом с существующими ключами `sdui`):

```json
"calendar": {
  "applyImmediately": "Изменения применяются сразу",
  "legend": {
    "working": "Рабочий",
    "nonWorking": "Нерабочий",
    "manual": "Изменён вручную"
  }
}
```

- [ ] **Step 2: Добавить i18n-ключи (kz)**

В `src/app/config/i18n/locales/kz/common.json` внутри объекта `"sdui"` добавить:

```json
"calendar": {
  "applyImmediately": "Өзгерістер бірден қолданылады",
  "legend": {
    "working": "Жұмыс күні",
    "nonWorking": "Жұмыс емес",
    "manual": "Қолмен өзгертілген"
  }
}
```

(Формулировки kz при необходимости уточнит аналитик — ключи и структура важнее.)

- [ ] **Step 3: Написать падающий тест**

Создать `calendar-legend.test.tsx` (i18n мокаем — `t` возвращает ключ):

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { CalendarLegend } from './calendar-legend'

afterEach(cleanup)

describe('CalendarLegend', () => {
  it('рендерит три подписи состояний', () => {
    render(<CalendarLegend />)
    expect(screen.getByText('sdui.calendar.legend.working')).toBeTruthy()
    expect(screen.getByText('sdui.calendar.legend.nonWorking')).toBeTruthy()
    expect(screen.getByText('sdui.calendar.legend.manual')).toBeTruthy()
  })
})
```

- [ ] **Step 4: Прогнать тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/calendar-legend.test.tsx`
Expected: FAIL — модуль `./calendar-legend` не найден.

- [ ] **Step 5: Реализовать легенду**

Создать `calendar-legend.tsx`:

```tsx
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const CalendarLegend: FC = () => {
  const { t } = useTranslation()

  const items = [
    { key: 'working', swatch: 'text-[#2a75f4]', label: t('sdui.calendar.legend.working') },
    { key: 'nonWorking', swatch: 'text-gray-400', label: t('sdui.calendar.legend.nonWorking') },
    { key: 'manual', swatch: 'bg-amber-100', label: t('sdui.calendar.legend.manual') },
  ]

  return (
    <div className="flex items-center gap-4 text-sm">
      {items.map((it) => (
        <span key={it.key} className="flex items-center gap-1">
          <span className={`inline-block w-3 h-3 rounded-sm ${it.swatch}`}>■</span>
          {it.label}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Прогнать тест — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/calendar-legend.test.tsx`
Expected: PASS (1 тест).

- [ ] **Step 7: Коммит**

```bash
git add src/features/sdui/ui/nodes/calendar/calendar-legend.tsx src/features/sdui/ui/nodes/calendar/calendar-legend.test.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: легенда календаря + i18n-ключи (SCRUM-278)"
```

---

### Task 6: Узел CALENDAR — сборка, диспатч, регистрация

**Files:**
- Create: `src/features/sdui/ui/nodes/calendar/calendar-node.tsx`
- Test: `src/features/sdui/ui/nodes/calendar/calendar-node.test.tsx`
- Modify: `src/features/sdui/lib/component-registry.ts` (импорт + запись `CALENDAR`)
- Modify: `src/features/sdui/types/node-types.ts` (добавить `'CALENDAR'` в union `NodeType`)

**Interfaces:**
- Consumes: `MonthGrid`, `YearSelector`, `CalendarLegend`, `CalendarNodeProps`, `useSduiDispatch`, `showToast`.
- Produces: `const CalendarNode: FC<NodeProps>` — читает `node.props`, строит `Map<string, CalendarDay>` из `dni`, рендерит 12 `MonthGrid` в сетке 4 колонки (обёртка `overflow-x-auto`, `min-w`), диспатчит `kalendari.den.toggle` (value=дата) и `kalendari.god.change` (value=год), одноразовый toast на первом тоггле.

- [ ] **Step 1: Написать падающий тест**

Создать `calendar-node.test.tsx` (мокаем dispatch, toast, i18n и дочерние компоненты, чтобы дёргать колбэки):

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const dispatch = vi.fn()
const showToast = vi.fn()

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('./calendar-legend', () => ({ CalendarLegend: () => null }))
// YearSelector-стаб: кнопка, дёргающая onChange(2026)
vi.mock('./year-selector', () => ({
  YearSelector: ({ onChange }: { onChange: (y: number) => void }) => (
    <button onClick={() => onChange(2026)}>year</button>
  ),
}))
// MonthGrid-стаб: одна кнопка на месяц, дёргает onToggle фикс-датой
vi.mock('./month-grid', () => ({
  MonthGrid: ({ month, onToggle }: { month: number; onToggle: (d: string) => void }) => (
    <button onClick={() => onToggle(`2025-0${month + 1}-01`)}>m{month}</button>
  ),
}))

import { CalendarNode } from './calendar-node'

const node = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'kalendari.rezultatZapolneniya', type: 'CALENDAR', props }) as ViewNode

const baseProps = { god: 2025, godMin: 2021, godMax: 2027, redaktiruemyy: true, dni: [] }

describe('CalendarNode', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('рендерит 12 месяцев', () => {
    render(<CalendarNode node={node(baseProps)} />)
    expect(screen.getAllByText(/^m\d+$/)).toHaveLength(12)
  })

  it('клик по дню шлёт COMMAND kalendari.den.toggle с датой', () => {
    render(<CalendarNode node={node(baseProps)} />)
    fireEvent.click(screen.getByText('m0'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'kalendari.den.toggle',
      value: '2025-01-01',
      sourceNodeId: 'kalendari.rezultatZapolneniya',
    })
  })

  it('первый тоггл показывает toast один раз, второй — нет', () => {
    render(<CalendarNode node={node(baseProps)} />)
    fireEvent.click(screen.getByText('m0'))
    fireEvent.click(screen.getByText('m1'))
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('info', 'sdui.calendar.applyImmediately')
  })

  it('смена года шлёт COMMAND kalendari.god.change', () => {
    render(<CalendarNode node={node(baseProps)} />)
    fireEvent.click(screen.getByText('year'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'kalendari.god.change',
      value: 2026,
      sourceNodeId: 'kalendari.rezultatZapolneniya',
    })
  })

  it('god отсутствует → ничего не рендерит', () => {
    const { container } = render(<CalendarNode node={node({})} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/calendar-node.test.tsx`
Expected: FAIL — модуль `./calendar-node` не найден.

- [ ] **Step 3: Реализовать узел**

Создать `calendar-node.tsx`:

```tsx
import { useRef, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import type { CalendarDay, CalendarNodeProps } from '../../../lib/calendar/calendar-types'
import { MonthGrid } from './month-grid'
import { YearSelector } from './year-selector'
import { CalendarLegend } from './calendar-legend'

const MONTHS = Array.from({ length: 12 }, (_, i) => i)
// 2024-01-01 — понедельник: эталонная неделя для подписей пн..вс
const WEEKDAY_LABELS = MONTHS.slice(0, 7).map((i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru }),
)

export const CalendarNode: FC<NodeProps> = ({ node }) => {
  const p = node.props as CalendarNodeProps | undefined
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()
  const noticeShown = useRef(false)

  const god = p?.god
  if (god == null) return null

  const editable = p?.redaktiruemyy ?? false
  const daysByDate = new Map<string, CalendarDay>()
  for (const d of p?.dni ?? []) daysByDate.set(d.data, d)

  const monthLabel = (m: number) => format(new Date(god, m, 1), 'LLLL', { locale: ru })
  const dayAriaLabel = (y: number, m: number, d: number) =>
    format(new Date(y, m, d), 'd MMMM yyyy', { locale: ru })

  const handleToggle = (data: string) => {
    void dispatch({
      type: 'COMMAND',
      command: 'kalendari.den.toggle',
      value: data,
      sourceNodeId: node.id,
    })
    if (!noticeShown.current) {
      noticeShown.current = true
      showToast('info', t('sdui.calendar.applyImmediately'))
    }
  }

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
        <YearSelector god={god} godMin={p?.godMin} godMax={p?.godMax} onChange={handleYearChange} />
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
              editable={editable}
              onToggle={handleToggle}
              dayAriaLabel={dayAriaLabel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Зарегистрировать тип в union**

В `src/features/sdui/types/node-types.ts` найти union `NodeType` (строковые литералы типов нод) и добавить `'CALENDAR'` (например рядом с composite-типами `'TABLE'`/`'LIST'`).

- [ ] **Step 5: Зарегистрировать компонент в реестре**

В `src/features/sdui/lib/component-registry.ts`:
1. Добавить импорт рядом с composite-блоком:
   ```ts
   import { CalendarNode } from '../ui/nodes/calendar/calendar-node'
   ```
2. Добавить запись в объект `registry`:
   ```ts
   CALENDAR: CalendarNode,
   ```

- [ ] **Step 6: Прогнать тест узла — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/calendar/calendar-node.test.tsx`
Expected: PASS (5 тестов).

- [ ] **Step 7: Прогнать все тесты календаря — регрессия**

Run: `npx vitest run src/features/sdui/lib/calendar src/features/sdui/ui/nodes/calendar`
Expected: PASS (все файлы: build-month-weeks, day-cell, month-grid, year-selector, legend, node).

- [ ] **Step 8: Коммит**

```bash
git add src/features/sdui/ui/nodes/calendar/calendar-node.tsx src/features/sdui/ui/nodes/calendar/calendar-node.test.tsx src/features/sdui/lib/component-registry.ts src/features/sdui/types/node-types.ts
git commit -m "feat: узел CALENDAR — сборка, диспатч команд, регистрация (SCRUM-278)"
```

---

## Финальная проверка (после всех тасок)

- [ ] **Тайпчек + линт:**

```bash
npx tsc --noEmit
npm run lint
```
Expected: без ошибок в новых файлах.

- [ ] **Живая приёмка (после деплоя фронта; бэк на проде)** — по чек-листу из дизайн-дока §«Приёмка»:
  1. График «01» (Пятидневка-36) → «Результат заполнения»: 2025, 246 дней акцентным.
  2. Клик по рабочему дню → гаснет сразу + фон «ручной»; повторный клик — обратно, фон «ручной» остаётся.
  3. Годы 2026/2027 — данные; 2021–2024 — пустой год без ошибок.
  4. График «03» (Семидневка): все дни акцентные, включая 1 января.
  5. Новая (незаписанная) карточка: календарь виден, клики не уходят.

- [ ] **Пункт координации с бэком:** подтвердить, что сервер шлёт патч с op `replaceNode` (camelCase) и команды в форме `{type:'COMMAND', command, value}`. Если реальный ответ отличается — завести дельту (правка `patch-applier`/маппинга) отдельным шагом.

---

## Self-review заметки автора плана

- **Покрытие спеки:** раскладка 4×3 (Task 6) · легенда 3 состояний (Task 5) · пн-первый (Task 1/3) · клик-toggle + toast (Task 6) · смена года (Task 4/6) · `redaktiruemyy=false` гард (Task 2) · ошибки сервера через существующий `effect-handler` (кода не требуют, отражено в дизайн-доке) · пустой год = дни-нерабочие по умолчанию (Task 2 `day?` → `vklyuchen=false`).
- **Типы согласованы:** `CalendarDay`/`CalendarNodeProps`/`WeekCell` из Task 1 используются во всех задачах; `MonthGridProps`/`YearSelectorProps`/`CalendarDayCellProps` определены там, где создаются.
- **Плейсхолдеров нет:** все шаги содержат конкретный код/команды.
