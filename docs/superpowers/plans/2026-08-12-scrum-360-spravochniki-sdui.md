# SCRUM-360: перевод справочников на SDUI — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Снять явные легаси-роуты (задача 9 SCRUM-290) двумя этапами, добавить `cellKind="HIERARCHY"` в SDUI-список и запрещающий дефолт `allowCreate` в ячейке ТЧ — чтобы списки и карточки справочников открывались через server-driven catch-all.

**Architecture:** Все URL доезжают до `<Route path="*">` → `SduiCatchAllPage` → OPEN: 200 = SDUI-дерево, 422 SCREEN_NOT_SDUI = легаси-страница по `KIND_TO_LEGACY`, 404 = NotFound. Этап A снимает 12 списковых/регистровых/отчётных роутов (карта kind уже полная), этап B — карточные + плоские редиректы (D-1), дополняя карту карточными kind и пробрасывая tabsApi в catch-all.

**Tech Stack:** React 19 + TS 5.9, react-router 6, vitest 4 + testing-library, zustand.

**Спека:** `docs/superpowers/specs/2026-08-12-scrum-360-spravochniki-sdui-design.md`. Ветка: `feature/SCRUM-360-spravochniki-sdui` (уже создана, работаем в ней).

**Отклонение от спеки (выяснено при планировании):** пункт блока А «добавить тест-инварианты на undefined для allowOpen/allowCopy» уже покрыт существующими тестами `reference-field-node.test.tsx:96-269` (undefined → кнопки нет, `=== true` → есть). Отдельной таски нет; остаток блока А — только F-21 (Task 5).

## Global Constraints

- Коммиты: формат `feat|fix|add|refactor: описание` (commit-msg hook), в конце `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- НЕ запускать `tsc --noEmit`/`npm run lint`/`npm run build` после каждого изменения — только на verification-тасках (6 и 12). Перед пушем ВСЕГДА `npm run build`.
- vitest в ходе тасок гонять точечно по файлам (`npx vitest run <files>`), полный прогон — на verification-тасках.
- Тексты в JSX — только через `useTranslation`/ключи `common.json`; текстовые элементы — `<Typography>`.
- Без `useMemo`/`useCallback` без явной перф-причины.
- Новые файлы ≤ 200 строк; легаси-файлы под лимит не рефакторим.
- Гейт между этапами: Task 7+ (этап B) начинать ТОЛЬКО после регресса этапа A на dev и ответов Алишера на Q-1/Q-4 (см. `specs-local/scrum-360-srez-spravochnikov/SCRUM-360-spec-v1-2026-08-12-front.md` §4).

---

## Этап A: списки + HIERARCHY + аффордансы

### Task 1: Deep-импорт иконок в sidebar-node (лечит EMFILE тест-сетки catch-all)

Тесты catch-all — главная страховочная сетка этапа A, но два файла стабильно падают на импорте: баррель `@mui/icons-material` (тысячи модулей в vitest без tree-shaking) течёт через цепочку `sdui-catch-all-page.test.tsx → @/features/sdui (barrel) → SduiScreen → node-renderer → component-registry → sidebar-node`.

**Files:**

- Modify: `src/features/sdui/ui/nodes/shell/sidebar-node.tsx:3`
- Test (существующие, чинятся этим фиксом): `src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx`, `src/app/providers/workspace-tab-binding.test.ts`

**Interfaces:**

- Produces: ничего нового — `SidebarNode` не меняет поведение, меняется только форма импорта.

- [ ] **Step 1: Убедиться, что тесты падают именно на EMFILE**

Run: `npx vitest run src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx src/app/providers/workspace-tab-binding.test.ts`
Expected: FAIL, `Error: EMFILE: too many open files ... @mui/icons-material/esm/...`

- [ ] **Step 2: Заменить баррель-импорт на deep-импорты**

В `src/features/sdui/ui/nodes/shell/sidebar-node.tsx` строка 3:

```tsx
// Было:
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
// Стало (deep-импорт: vitest не тянет баррель на тысячи модулей — EMFILE):
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
```

- [ ] **Step 3: Прогнать оба теста + тесты сайдбара**

Run: `npx vitest run src/pages/sdui-catch-all src/app/providers/workspace-tab-binding.test.ts src/features/sdui/ui/shell-sidebar-host.test.tsx`
Expected: PASS все.

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/nodes/shell/sidebar-node.tsx
git commit -m "fix: deep-импорт иконок в sidebar-node — EMFILE тестов catch-all на барреле mui-icons (SCRUM-360)"
```

### Task 2: Снять 12 списковых роутов из App.tsx (grep-инвариант + удаление)

**Files:**

- Create: `src/pages/sdui-catch-all/lib/no-duplicate-routes.test.ts`
- Modify: `src/app/App.tsx` (Route-блоки в 158-279 и lazy-импорты снимаемых страниц)

**Interfaces:**

- Consumes: `KIND_TO_LEGACY` пути (kind-to-legacy.tsx:73-122).
- Produces: инвариант «списковый путь из карты не имеет явного Route» — Task 10 расширит список путей.

- [ ] **Step 1: Написать падающий grep-инвариант**

`src/pages/sdui-catch-all/lib/no-duplicate-routes.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Задача 9 SCRUM-290 / SCRUM-360 этап A: каждый путь, покрытый KIND_TO_LEGACY,
// обслуживается catch-all-фолбэком (200→SDUI / 422→легаси). Явный <Route> в
// App.tsx перехватил бы URL раньше catch-all — SDUI-экран стал бы недостижим.
const appTsx = readFileSync(
  fileURLToPath(new URL('../../../app/App.tsx', import.meta.url)),
  'utf8'
)

// Точное совпадение с атрибутом path="..." (карточные пути с доп. сегментами
// /new | /:entryId под это выражение не попадают — они остаются до этапа B).
const REMOVED_LIST_PATHS = [
  '/modules/:pageCode/document/:moduleCode',
  '/modules/:pageCode/document/:moduleCode/:entryId/movements',
  '/modules/:pageCode/dictionary/:moduleCode',
  '/modules/:pageCode/informationregister/:moduleCode',
  '/modules/:pageCode/accumulationregister/:moduleCode',
  '/modules/:pageCode/accountingregister/:moduleCode',
  '/modules/:pageCode/accountplan/:moduleCode',
  '/modules/:pageCode/accountingreport/:moduleCode',
  '/modules/:pageCode/report/:moduleCode',
  '/modules/:pageCode/reportalt/:moduleCode',
  '/modules/:pageCode/dataprocessor/:moduleCode',
  '/modules/:pageCode/calculationplan/:moduleCode',
]

describe('App.tsx не дублирует KIND_TO_LEGACY явными Route (SCRUM-360 этап A)', () => {
  it.each(REMOVED_LIST_PATHS)('нет явного Route path="%s"', (p) => {
    expect(appTsx.includes(`path="${p}"`)).toBe(false)
  })
})
```

- [ ] **Step 2: Убедиться, что инвариант падает (12 путей ещё в App.tsx)**

Run: `npx vitest run src/pages/sdui-catch-all/lib/no-duplicate-routes.test.ts`
Expected: FAIL 12/12.

- [ ] **Step 3: Удалить 12 Route-блоков из App.tsx**

В `src/app/App.tsx` удалить `<Route>` для всех 12 путей из списка выше (строки 158-161, 170-173, 200-203, 212-227, 236-240, 246-250, 251-260, 261-269, 270-278 в текущей нумерации) вместе с их поясняющими комментариями (ОСВ/Обработка/CalculationPlan/Report/ReportAlt). НЕ трогать: `/`, `/treasury-export`, `/modules/:pageCode`, карточные document/dictionary/accountplan (`/new`, `/:entryId`), плоские `/documents/*` и `/dictionaries/*` (редиректы D-1), `/modules/:pageCode/account-card`, `<Route path="*">`.

- [ ] **Step 4: Удалить осиротевшие lazy-импорты**

Там же удалить lazy-константы, чьим единственным потребителем были снятые Route (проверить каждую grep-ом по App.tsx перед удалением): `DocumentPage`, `DocumentMovementsPage`, `DictionaryPage`, `InformationRegisterPage`, `AccumulationRegisterPage`, `AccountingRegisterPage`, `AccountPlanPage`, `OsvReportPage`, `ReportPage`, `ReportAltPage`, `FinancingPlanUploadPage`, `UniversalDomainPage`. Остаются: `DocumentEntryPage`, `DictionaryEntryPage`, `AccountPlanEntryPage`, `AccountCardPage`, `ModulePage`, `MainPage`, `TreasuryExportPage`, `DocumentRedirect`, `DictionaryRedirect`, `SduiCatchAllPage`.

- [ ] **Step 5: Инвариант зелёный + смоук**

Run: `npx vitest run src/pages/sdui-catch-all src/app`
Expected: PASS (инвариант 12/12 + существующие тесты catch-all и провайдеров).

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/pages/sdui-catch-all/lib/no-duplicate-routes.test.ts
git commit -m "feat: снять 12 списковых легаси-роутов — URL доезжает до catch-all (SCRUM-360 этап A, задача 9 SCRUM-290)"
```

### Task 3: Полнота карты и проброс kind — параметризованные тесты

**Files:**

- Modify: `src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx`
- Modify: `src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx`

**Interfaces:**

- Consumes: `resolveLegacyEntry(kind)` (kind-to-legacy.tsx:124), мок-инфраструктура `window.__catchAllCase` из существующего теста.
- Produces: таблица `LIST_KINDS` (12 kind → path) — Task 8 расширит до 16.

- [ ] **Step 1: Дописать в kind-to-legacy.test.tsx параметризованную полноту 12 списковых kind**

```tsx
const LIST_KINDS: Array<[string, string]> = [
  ['DOCUMENT_LIST', '/modules/:pageCode/document/:moduleCode'],
  [
    'DOCUMENT_MOVEMENTS',
    '/modules/:pageCode/document/:moduleCode/:entryId/movements',
  ],
  ['DICTIONARY_LIST', '/modules/:pageCode/dictionary/:moduleCode'],
  ['REGISTER', '/modules/:pageCode/informationregister/:moduleCode'],
  [
    'ACCUMULATION_REGISTER',
    '/modules/:pageCode/accumulationregister/:moduleCode',
  ],
  ['ACCOUNTING_REGISTER', '/modules/:pageCode/accountingregister/:moduleCode'],
  ['ACCOUNT_PLAN', '/modules/:pageCode/accountplan/:moduleCode'],
  ['ACCOUNTING_REPORT', '/modules/:pageCode/accountingreport/:moduleCode'],
  ['REPORT', '/modules/:pageCode/report/:moduleCode'],
  ['REPORT_ALT', '/modules/:pageCode/reportalt/:moduleCode'],
  ['DATA_PROCESSOR', '/modules/:pageCode/dataprocessor/:moduleCode'],
  ['CALCULATION_PLAN', '/modules/:pageCode/calculationplan/:moduleCode'],
]

describe('полнота списковых kind (SCRUM-360 этап A)', () => {
  it.each(LIST_KINDS)('%s → %s c элементом', (kind, path) => {
    const e = resolveLegacyEntry(kind)
    expect(e?.path).toBe(path)
    expect(e?.element).toBeTruthy()
  })
})
```

- [ ] **Step 2: Дописать в sdui-catch-all-page.test.tsx проброс любого kind в LegacyFallback**

Мок SduiScreen уже читает `window.__catchAllCase`; параметризовать kind через второе поле:

```tsx
// в моке SduiScreen заменить ветку '422' на:
if (c === '422')
  props.onOpenFailed?.({
    kind: (window as unknown as { __catchAllKind?: string }).__catchAllKind,
  })
```

```tsx
it.each(['DICTIONARY_LIST', 'REGISTER', 'ACCOUNT_PLAN', 'REPORT_ALT'])(
  '422 с kind=%s → LegacyFallback получает kind',
  (kind) => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase = '422'
    ;(window as never as { __catchAllKind?: string }).__catchAllKind = kind
    renderAt('/modules/x/whatever/y')
    expect(screen.getByText(`ЛЕГАСИ:${kind}`)).toBeTruthy()
  }
)
```

(В существующем тесте «422 → LegacyFallback с kind» выставить `__catchAllKind = 'DOCUMENT_LIST'`, чтобы он не зависел от захардкоженного значения в моке.)

- [ ] **Step 3: Прогнать**

Run: `npx vitest run src/pages/sdui-catch-all`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx
git commit -m "add: параметризованные тесты полноты kind-to-legacy и проброса kind в 422-фолбэк (SCRUM-360)"
```

### Task 4: `cellKind="HIERARCHY"` в списке

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/list-column-defs.test.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/list-column-defs.tsx:169-187` (ветвление cell)

**Interfaces:**

- Consumes: `buildListColumns(args)` (list-column-defs.tsx:58), `getCellIcon(name)` (cell-icon-registry.tsx), `ListRow` (индекс-сигнатура `[key: string]: unknown`).
- Produces: рендер ячейки для `TABLE_COLUMN.props.cellKind === 'HIERARCHY'`. Контракт данных (Q-2, до подтверждения бэком — фолбэки): строка несёт `_level: number` (0 = корень, отступ) и `_isGroup: boolean` (ключ `iconMap`, как у ICON: `{"true":"folder","false":"listElement"}`). Нет `_level` → 0; нет `_isGroup`/маппинга → без глифа. Если бэк в ответе на Q-2 выберет другие имена — правится только деструктуризация.

- [ ] **Step 1: Написать падающие тесты**

`src/features/sdui/ui/nodes/composite/list-column-defs.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode, RefObject } from 'react'

import type { ViewNode } from '../../../types/view'
import { buildListColumns, type ListRow } from './list-column-defs'

// Рендерим cell-функцию колонки напрямую (мимо таблицы): контракт TanStack —
// cell(info) с getValue() и row.original.
const renderHierarchyCell = (
  colProps: Record<string, unknown>,
  row: ListRow,
  value: unknown
) => {
  const [col] = buildListColumns({
    columnNodes: [
      { id: 'c1', type: 'TABLE_COLUMN', props: colProps } as ViewNode,
    ],
    sortState: undefined,
    typeCode: undefined,
    filterOpLabels: undefined,
    dispatch: vi.fn() as never,
    nodeId: 'list1',
    sortInFlightRef: { current: false } as RefObject<boolean>,
  })
  const cell = col.cell as (info: unknown) => ReactNode
  return render(<>{cell({ getValue: () => value, row: { original: row } })}</>)
}

const HIER_PROPS = {
  binding: 'name',
  cellKind: 'HIERARCHY',
  iconMap: { true: 'folder', false: 'listElement' },
}

describe('cellKind=HIERARCHY (SCRUM-360 блок H)', () => {
  it('уровень 2 → отступ 32px, текст рендерится', () => {
    const { container } = renderHierarchyCell(
      HIER_PROPS,
      { id: 1, _level: 2, _isGroup: false },
      'Оклады'
    )
    expect(screen.getByText('Оклады')).toBeTruthy()
    const wrap = container.querySelector('span[style]')
    expect(wrap?.getAttribute('style')).toContain('padding-left: 32px')
  })

  it('группа → глиф folder из iconMap', () => {
    const { container } = renderHierarchyCell(
      HIER_PROPS,
      { id: 2, _level: 0, _isGroup: true },
      'Начисления'
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('нет _level и _isGroup → отступ 0, без глифа, текст есть (фолбэк до Q-2)', () => {
    const { container } = renderHierarchyCell(HIER_PROPS, { id: 3 }, 'Плоский')
    expect(screen.getByText('Плоский')).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
    expect(
      container.querySelector('span[style]')?.getAttribute('style')
    ).toContain('padding-left: 0')
  })
})
```

- [ ] **Step 2: Убедиться, что падают**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/list-column-defs.test.tsx`
Expected: FAIL — HIERARCHY-ветки нет, рендерится дефолтная текстовая ячейка без span[style].

- [ ] **Step 3: Реализовать ветку HIERARCHY**

В `list-column-defs.tsx` — тернарная цепочка cell (строки 169-187) получает первую ветку:

```tsx
      cell:
        // SCRUM-360 блок H: колонка иерархии — глиф группа/элемент (iconMap,
        // ключ String(_isGroup) — тот же словарь, что у ICON) + отступ по
        // уровню вложенности _level. Контракт строки — Q-2 к бэку; фолбэки:
        // нет _level → 0 (плоско), нет глифа → только текст.
        col.props?.cellKind === 'HIERARCHY'
          ? (info: {
              getValue: () => unknown
              row: { original: ListRow }
            }) => {
              const iconMap = col.props?.iconMap as
                | Record<string, string>
                | undefined
              const { _level, _isGroup } = info.row.original
              const level =
                typeof _level === 'number' && _level > 0 ? _level : 0
              const Icon = getCellIcon(iconMap?.[String(_isGroup ?? '')])
              return (
                <span
                  className="flex items-center gap-1.5"
                  style={{ paddingLeft: level * 16 }}
                >
                  {Icon ? (
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  ) : null}
                  <Typography variant="body2" noWrap className="text-ui-06">
                    {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
                    {String(info.getValue() ?? '')}
                  </Typography>
                </span>
              )
            }
          : col.props?.cellKind === 'ICON'
            ? /* существующая ICON-ветка без изменений */
```

(ICON- и текстовая ветки сдвигаются на один уровень тернарника; их код не меняется. Сигнатура cell-инфо в ICON-ветке остаётся `{ getValue }` — row ей не нужен.)

- [ ] **Step 4: Прогнать тесты файла + соседей списка**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/list-column-defs.test.tsx src/features/sdui/ui/nodes/composite/list-node.test.tsx src/features/sdui/ui/nodes/composite/cell-icon-registry.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/list-column-defs.tsx src/features/sdui/ui/nodes/composite/list-column-defs.test.tsx
git commit -m "feat: cellKind=HIERARCHY — глиф группы/элемента и отступ по _level в SDUI-списке (SCRUM-360)"
```

### Task 5: Запрещающий дефолт `allowCreate` в ячейке-ссылке ТЧ (F-21)

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx:225`
- Modify: `src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx` (блок «футер пикера»)

**Interfaces:**

- Consumes: серверная асимметрия ReferenceAffordanceResolver (SCRUM-291 §18.2-18.3): create «закрыт, пока явно не true», showAll «открыт, пока явно не false».
- Produces: `onAdd` активен только при `allowCreate === true`; `allowShowAll ?? true` НЕ меняется.

- [ ] **Step 1: Падающий тест — allowCreate отсутствует → «Добавить» нет**

В describe «футер пикера» reference-cell-editor.test.tsx:

```tsx
it('allowCreate отсутствует → «Добавить» НЕТ (запрещающий дефолт, аудит F-21)', () => {
  render(
    <ReferenceCellEditor
      colProps={cellProps({})}
      value={null}
      onChange={vi.fn()}
      onCommit={vi.fn()}
    />
  )
  openDropdown()
  // Футер существует (allowShowAll ?? true), но кнопки создания в нём нет:
  expect(screen.getByRole('button', { name: showAllName })).toBeTruthy()
  expect(screen.queryByRole('button', { name: addName })).toBeNull()
})
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx`
Expected: FAIL нового кейса (кнопка «Добавить» рендерится из-за `?? true`).

- [ ] **Step 3: Флипнуть дефолт**

`reference-cell-editor.tsx:225`:

```tsx
        onAdd={
          // Запрещающий дефолт (канон п.5, аудит F-21): сервер закрывает create,
          // пока явно не пришлёт allowCreate: true (ReferenceAffordanceResolver) —
          // фронт зеркалит. allowShowAll ниже остаётся ?? true: серверный default true.
          openPicker && canCreate && allowCreate === true
            ? () => {
                openPicker('create')
              }
            : undefined
        }
```

- [ ] **Step 4: Прогнать файл целиком**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx`
Expected: PASS все (существующие кейсы `allowCreate: true` не задеты).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/reference-cell-editor.tsx src/features/sdui/ui/nodes/composite/reference-cell-editor.test.tsx
git commit -m "fix: allowCreate в ячейке-ссылке ТЧ — запрещающий дефолт === true, зеркало серверной асимметрии (SCRUM-360, аудит F-21)"
```

### Task 6: Верификация этапа A

**Files:** без правок кода (фиксы по результатам — отдельными коммитами в рамках таски).

- [ ] **Step 1: Полный прогон тестов**

Run: `npm test`
Expected: 0 упавших (EMFILE-файлы починены Task 1).

- [ ] **Step 2: Сборка**

Run: `npm run build`
Expected: успех (tsc -b строже noEmit — правило проекта перед пушем).

- [ ] **Step 3: e2e на dev-api (нужен Q-3 от Алишера — справочник в enabled-types)**

`npm run dev`, вручную или через playwright-MCP:

1. URL списка типа из enabled-types → SDUI-список (иерархический тип → глифы+отступы после Q-2).
2. URL соседнего непереведённого типа → легаси-страница без мигания ошибкой.
3. `/modules/x/unknown/y` → NotFound.
4. Списки регистров/отчётов (422-фолбэки) открываются как раньше, вкладки живут.
5. Ячейка-ссылка ТЧ на классификаторе: «Добавить» отсутствует; на обычном справочнике — есть.

- [ ] **Step 4: Push + коммент Алишеру**

`git push -u origin feature/SCRUM-360-spravochniki-sdui`. Комментарий в SCRUM-360 (REST v2, по-человечески, 1-2 предложения): этап A готов и проверен, ждём Q-1/Q-4 для этапа B.

---

## Этап B: карточки + снятие D-1

**ГЕЙТ: регресс этапа A пройден; Алишер ответил на Q-1 (гейт C1.4) и Q-4 (422 на ?copyFrom). Если Q-4 = «нет гарантии» — в Task 10 карточные роуты документов НЕ снимать, остальное таски не блокирует.**

### Task 7: LegacyFallback поддерживает несколько path

**Files:**

- Modify: `src/pages/sdui-catch-all/lib/kind-to-legacy.tsx:65-68` (тип LegacyEntry)
- Modify: `src/pages/sdui-catch-all/ui/legacy-fallback.tsx`
- Modify: `src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx`

**Interfaces:**

- Produces: `interface LegacyEntry { path: string | string[]; element: ReactElement }`; `LegacyFallback` рендерит `<Route>` на каждый путь. Task 8 использует массив для ACCOUNT_PLAN.

- [ ] **Step 1: Падающий тест — entry с массивом путей матчит оба URL**

В `legacy-fallback.test.tsx` (следовать существующему стилю моков файла):

```tsx
it('kind с массивом path матчит каждый из путей', () => {
  // мок resolveLegacyEntry возвращает { path: ['/a/:x', '/a/:x/new'], element: <div>Л</div> }
  // рендер LegacyFallback в MemoryRouter на '/a/1' и на '/a/1/new' → оба раза «Л»
})
```

(Точный код — по образцу существующих тестов файла: они уже мокают resolveLegacyEntry; добавить кейс с массивом и двумя initialEntries.)

- [ ] **Step 2: Реализация**

`legacy-fallback.tsx`:

```tsx
export const LegacyFallback: FC<{ kind: string | null }> = ({ kind }) => {
  const entry = kind ? resolveLegacyEntry(kind) : null
  if (!entry) return <NotFound />
  const paths = Array.isArray(entry.path) ? entry.path : [entry.path]
  return (
    <Routes>
      {paths.map((p) => (
        <Route key={p} path={p} element={entry.element} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Прогнать + commit**

Run: `npx vitest run src/pages/sdui-catch-all`

```bash
git add src/pages/sdui-catch-all
git commit -m "feat: LegacyFallback принимает массив path — подготовка карточных kind (SCRUM-360 этап B)"
```

### Task 8: KIND_TO_LEGACY — карточные kind (фикс F-27)

**Files:**

- Modify: `src/pages/sdui-catch-all/lib/kind-to-legacy.tsx`
- Modify: `src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx`

**Interfaces:**

- Consumes: `LegacyEntry.path: string | string[]` (Task 7); закрытый серверный enum 16 kind (спека SCRUM-290 §2: 12 списковых + DOCUMENT, DOCUMENT_NEW, DICTIONARY, DICTIONARY_NEW).
- Produces: `resolveLegacyEntry` покрывает 16/16; комментарий «обязана быть полной» становится правдой.

- [ ] **Step 1: Падающий тест полноты 16/16**

В kind-to-legacy.test.tsx добавить к `LIST_KINDS` (Task 3):

```tsx
const CARD_KINDS: Array<[string, string | string[]]> = [
  ['DOCUMENT', '/modules/:pageCode/document/:moduleCode/:entryId'],
  ['DOCUMENT_NEW', '/modules/:pageCode/document/:moduleCode/new'],
  ['DICTIONARY', '/modules/:pageCode/dictionary/:moduleCode/:entryId'],
  ['DICTIONARY_NEW', '/modules/:pageCode/dictionary/:moduleCode/new'],
]

it.each(CARD_KINDS)('%s → карточный путь', (kind, path) => {
  expect(resolveLegacyEntry(kind)?.path).toEqual(path)
})

it('ACCOUNT_PLAN покрывает список, создание и карточку', () => {
  expect(resolveLegacyEntry('ACCOUNT_PLAN')?.path).toEqual([
    '/modules/:pageCode/accountplan/:moduleCode',
    '/modules/:pageCode/accountplan/:moduleCode/new',
    '/modules/:pageCode/accountplan/:moduleCode/:entryId',
  ])
})
```

- [ ] **Step 2: Реализация — дополнить карту**

В kind-to-legacy.tsx добавить lazy-импорты карточных легаси-страниц (пути свериться с существующими импортами App.tsx перед удалением их оттуда в Task 10): `LegacyDocumentEntryPage` (из `@/pages/documents/documents-entry` — легаси-ветка), `LegacyDictionaryEntryPage` (из `@/pages/dictionaries/dictionary-entry`), `AccountPlanEntryPage`. Записи:

```tsx
  DOCUMENT: {
    path: '/modules/:pageCode/document/:moduleCode/:entryId',
    element: <DocumentEntryPage />,
  },
  DOCUMENT_NEW: {
    path: '/modules/:pageCode/document/:moduleCode/new',
    element: <DocumentEntryPage />,
  },
  DICTIONARY: {
    path: '/modules/:pageCode/dictionary/:moduleCode/:entryId',
    element: <DictionaryEntryPage />,
  },
  DICTIONARY_NEW: {
    path: '/modules/:pageCode/dictionary/:moduleCode/new',
    element: <DictionaryEntryPage />,
  },
  ACCOUNT_PLAN: {
    path: [
      '/modules/:pageCode/accountplan/:moduleCode',
      '/modules/:pageCode/accountplan/:moduleCode/new',
      '/modules/:pageCode/accountplan/:moduleCode/:entryId',
    ],
    element: <AccountPlanPage />, // список; new/:entryId — <AccountPlanEntryPage/> см. примечание
  },
```

Примечание для ACCOUNT_PLAN: список и карточка — РАЗНЫЕ элементы; массив path с одним element не годится. Расширить `LegacyEntry` до `Array<{path: string; element: ReactElement}>` ИЛИ (проще, выбрать это) — оставить у ACCOUNT_PLAN только списковый path, а карточные accountplan-роуты в App.tsx НЕ снимать в Task 10 до отдельного kind ACCOUNT_PLAN_ENTRY на бэке (записать вопросом Q-5 Алишеру). Реализатор: выбрать второй вариант, зафиксировать комментарием в карте и НЕ заводить массив-элементы; тест ACCOUNT_PLAN из Step 1 скорректировать на списковый path (Task 7 остаётся полезным для будущих kind).

Обновить шапочный комментарий карты: таблица активна (не «дремлет»), карточные kind рендерят легаси-карточки для типов с newView=false.

- [ ] **Step 3: Прогнать + commit**

Run: `npx vitest run src/pages/sdui-catch-all`

```bash
git add src/pages/sdui-catch-all/lib
git commit -m "feat: карточные kind в KIND_TO_LEGACY — DOCUMENT/DICTIONARY[/NEW] (SCRUM-360 этап B, аудит F-27)"
```

### Task 9: tabsApi в catch-all через общий хук

**Files:**

- Create: `src/features/workspace-tabs/lib/hooks/use-sdui-tab-binding.ts`
- Create: `src/features/workspace-tabs/lib/hooks/use-sdui-tab-binding.test.ts`
- Modify: `src/pages/documents/documents-entry/ui/sdui-document-page.tsx:35-122` (переход на хук)
- Modify: `src/pages/sdui-catch-all/ui/sdui-catch-all-page.tsx` (передать tabsApi в SduiScreen)
- Modify: `src/features/workspace-tabs/index.ts` (экспорт хука)

**Interfaces:**

- Consumes: `useWorkspaceTabsStore` (tabs, closeTab), `useFormCacheStore` (setDirty, consumePendingAction, removeTab) — уже в слайсе.
- Produces: `useSduiTabBinding(): { shouldPersistSession(route: string): boolean; onDirtyChange(route: string, dirty: boolean): void; consumePendingAction(route: string): string | null; onCloseAfter(route: string, didNavigate?: boolean): void }` + экспорт `navigateToNeighborTab(navigate: NavigateFunction): void`. Сигнатуры колбэков = пропсы SduiScreen (sdui-screen.tsx:23-47).

- [ ] **Step 1: Падающий тест хука**

`use-sdui-tab-binding.test.ts` — renderHook из @testing-library/react, MemoryRouter-обёртка (хук зовёт useNavigate):

```ts
// кейсы:
// 1) shouldPersistSession: route есть в tabs → true, нет → false
// 2) onDirtyChange проставляет dirty в useFormCacheStore
// 3) onCloseAfter(route, false) → закрывает вкладку и навигирует на соседа
//    (assert через useWorkspaceTabsStore.getState().tabs)
// 4) onCloseAfter(route, true) → только закрывает, без навигации
// Стор-инициализация — напрямую setState зустанд-сторов, как в
// workspace-tab-binding.test.ts (образец мокинга в этом слайсе).
```

- [ ] **Step 2: Реализация — перенос кода из sdui-document-page**

`use-sdui-tab-binding.ts`: функции `navigateToNeighborTab` (дословно из sdui-document-page.tsx:35-43) и объект tabsApi (дословно 101-122, включая обоснованный useMemo со стабильными колбэками). sdui-document-page переводится на импорт хука (локальные копии удаляются); `<SduiScreen {...tabsApi} onTitleChange={setTabTitle} />` не меняется.

- [ ] **Step 3: Подключить в catch-all**

`sdui-catch-all-page.tsx`:

```tsx
  const tabsApi = useSduiTabBinding()
  ...
  return (
    <SduiScreen
      {...tabsApi}
      onTab={authorTab}
      onOpenFailed={...}
      onRouteUnknown={...}
    />
  )
```

Дополнить существующий тест catch-all кейсом: мок SduiScreen получает пропсы shouldPersistSession/onCloseAfter (expect(props.shouldPersistSession).toBeTypeOf('function')).

- [ ] **Step 4: Прогнать + commit**

Run: `npx vitest run src/features/workspace-tabs src/pages/sdui-catch-all src/pages/documents`

```bash
git add src/features/workspace-tabs src/pages/sdui-catch-all/ui/sdui-catch-all-page.tsx src/pages/documents/documents-entry/ui/sdui-document-page.tsx
git commit -m "feat: tabsApi в catch-all через общий useSduiTabBinding — dirty-цикл форм на catch-all-пути (SCRUM-360 этап B)"
```

### Task 10: Снять карточные и плоские роуты, удалить redirect-страницы, снять D-1

**ГЕЙТ Q-4: если бэк НЕ гарантирует 422 на `?copyFrom` — карточные document-роуты (`/new`, `/:entryId`) оставить, снять только dictionary-карточные и плоские; зафиксировать остаток комментарием в App.tsx.**

**Files:**

- Modify: `src/app/App.tsx` (Route document/dictionary карточные + все `/documents/*`, `/dictionaries/*`)
- Delete: `src/pages/documents/document-redirect/**`, `src/pages/dictionaries/dictionary-redirect/**`
- Modify: `src/pages/sdui-catch-all/lib/no-duplicate-routes.test.ts` (расширить список путей)
- Modify: `docs/superpowers/specs/2026-07-02-sdui-course-audit.md` (§9: D-1 → снято)
- Modify: `CLAUDE.md` (карта границы: убрать document-redirect из SDUI-зоны, добавить sdui-catch-all — попутно фикс F-32)

**Interfaces:**

- Consumes: карточные kind из Task 8, tabsApi из Task 9.

- [ ] **Step 1: Расширить grep-инвариант**

В no-duplicate-routes.test.ts добавить массив `REMOVED_CARD_PATHS`:

```ts
const REMOVED_CARD_PATHS = [
  '/modules/:pageCode/document/:moduleCode/new',
  '/modules/:pageCode/document/:moduleCode/:entryId',
  '/modules/:pageCode/dictionary/:moduleCode/new',
  '/modules/:pageCode/dictionary/:moduleCode/:entryId',
  '/documents/:typeCode',
  '/documents/:typeCode/new',
  '/documents/:typeCode/:entryId',
  '/dictionaries/:typeCode',
  '/dictionaries/:typeCode/:entryId',
]
```

и `it.each` по нему. Run → FAIL.

- [ ] **Step 2: Снять роуты и удалить редиректы**

App.tsx: удалить перечисленные Route + lazy-импорты `DocumentRedirect`, `DictionaryRedirect`, `DocumentEntryPage`, `DictionaryEntryPage` (если единственным потребителем был App.tsx — карточки теперь монтирует kind-to-legacy). `git rm -r src/pages/documents/document-redirect src/pages/dictionaries/dictionary-redirect`. Проверить grep-ом отсутствие иных импортёров удаляемых страниц.

- [ ] **Step 3: Реестр отклонений + карта границы**

В `2026-07-02-sdui-course-audit.md` §9.1 строку D-1 обернуть `~~...~~` + «**СНЯТО <дата>** (SCRUM-360 этап B: catch-all + карточные kind; редирект-резолверы удалены)» — по образцу D-2. В §9.2 обновить строку статуса D-1. В CLAUDE.md обновить таблицу границы (убрать document-redirect, добавить `src/pages/sdui-catch-all/`).

- [ ] **Step 4: Прогнать + commit**

Run: `npx vitest run src/pages src/app`
Expected: PASS; тесты удалённых страниц удалены вместе с ними.

```bash
git add -A
git commit -m "feat: снять карточные и плоские роуты — развилку решает сервер, отклонение D-1 снято (SCRUM-360 этап B)"
```

### Task 11 (гейт Q-1 = «гейт C1.4 сдан»): снять props-only фолбэк allowCreate в шапке

**Files:**

- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx:221` (ветка `!createAction && (allowCreate ?? canBrowse)`)
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx` (кейсы легаси-фолбэка create)

- [ ] **Step 1: Падающий тест** — «нет createAction, canBrowse, allowCreate отсутствует → „Создать" НЕ показывается» (замена существующего кейса :292 «нет createAction, canBrowse → „Создать" открывает легаси-пикер create» на строгий).
- [ ] **Step 2:** ветка create в props-only фолбэке: `allowCreate === true` вместо `allowCreate ?? canBrowse` (легаси-пикер по-прежнему открывается, но только при явном разрешении сервера).
- [ ] **Step 3:** `npx vitest run src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx` → PASS.
- [ ] **Step 4: Commit** `fix: props-only фолбэк allowCreate — строгий === true после бэк-гейта C1.4 (SCRUM-360, Q-1)`.

### Task 12: Верификация этапа B

- [ ] **Step 1:** `npm test` → 0 упавших.
- [ ] **Step 2:** `npm run build` → успех.
- [ ] **Step 3:** e2e на dev-api: карточка документа newView=true и false по прямому URL (200 → SDUI / 422 → легаси-карточка); создание (/new); dirty-цикл через catch-all (правка → крестик вкладки → диалог → дозапись серверным дескриптором); плоская ссылка из related-docs (`/documents/:type/:id`) открывает документ; `?copyFrom` — по решению Q-4.
- [ ] **Step 4:** push; коммент Алишеру: этап B готов, D-1 снят; спека v2 при необходимости (изменения контрактов не было). Тикет — в «Готово к тестированию» (в «Готово» переносят только аналитики — правило проекта).

## Self-review (выполнен при написании)

- Покрытие спеки: блок Р-A → Tasks 1-3; H → Task 4; А → Task 5 (тест-инварианты шапки уже существуют — зафиксировано в шапке плана); Р-B → Tasks 7-10; гейт Q-1 → Task 11; верификация → Tasks 6, 12; блок О выполнен до плана.
- ACCOUNT_PLAN-карточки: обнаружен пробел «один element на массив path» — решение зафиксировано в Task 8 Step 2 (карточные accountplan-роуты остаются, вопрос Q-5 бэку).
- Типы согласованы: `LegacyEntry.path: string | string[]` (Task 7) ↔ ACCOUNT_PLAN-примечание (Task 8); tabsApi-сигнатуры (Task 9) ↔ пропсы SduiScreen.
