# SCRUM-302: доменные кнопки командной панели ТЧ — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рендер доменных кнопок ТЧ из `props.tableCommands` + паритет командной панели с 1С (меню «Ещё», перенос «Удалить», клиентский поиск, хоткеи).

**Architecture:** Всё внутри слайса `features/sdui`. `TableToolbar` — единственная точка сборки панели (ряд + поиск + «Ещё»); меню — отдельный локальный компонент на MUI `Menu` с колбэками (не ViewNode-пайплайн); поиск и хоткеи — чистые хуки/утилиты. Диспатч команд — существующий `useSduiDispatch`, `behavior` только из дескриптора.

**Tech Stack:** React 19, TypeScript 5.9, MUI, TanStack Table, Zustand (не трогаем), vitest + @testing-library/react.

**Спека:** `docs/superpowers/specs/2026-08-03-scrum-302-table-commands-design.md`

## Global Constraints

- Только SDUI-зона (`src/features/sdui/`). Легаси не трогать. `shared/` не трогать.
- Тексты — через `useTranslation` и ключи в `src/app/config/i18n/locales/{ru,kz}/common.json`. Исключение: подписи хоткеев (`Ins`, `F9`, `Ctrl+Q`…) — непереводимые константы.
- Не парсить имя команды и не выводить из него поведение: `behavior` только из дескриптора (§6.6 спеки бэка).
- Никаких `useMemo`/`useCallback` без явной перф-причины (существующие мемоизации колонок таблиц — не трогать, они защищают фокус инпутов).
- Цель ~200 строк на файл, файл >300 строк разбить.
- Не запускать `tsc --noEmit`/`npm run lint`/`npm run build` — только точечные `npx vitest run <файл>`.
- Формат коммитов: `feat|fix|add|refactor: описание` (commit-msg hook). Футер:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Дескрипторы `tableCommands` в сторы не дублировать — читаются из дерева на каждый рендер.

---

### Task 1: Тип `TableCommandDescriptor` + доменные кнопки в `TableToolbar`

**Files:**
- Modify: `src/features/sdui/types/view.ts` (после `ViewNodeAction`, ~строка 31)
- Modify: `src/features/sdui/ui/nodes/composite/table-toolbar.tsx`
- Test: `src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx` (создать)

**Interfaces:**
- Consumes: `ActionBehavior` из `types/view.ts`, `useSduiDispatch` из `lib/dispatch.ts`, `Button` из `@/shared/ui/buttons`.
- Produces:
  - тип `TableCommandDescriptor` (экспорт из `types/view.ts`) — используется всеми последующими тасками;
  - `TableToolbar` принимает новый проп `commands?: TableCommandDescriptor[]`.

- [ ] **Step 1: Добавить тип в `types/view.ts`**

После интерфейса `ViewNodeAction` вставить:

```ts
// SCRUM-302: дескриптор доменной кнопки командной панели ТЧ (props.tableCommands
// TABLE-узла). command — непрозрачная строка, фронт её не разбирает; behavior —
// единственный источник поведения (никаких списков мутирующих команд).
export interface TableCommandDescriptor {
  command: string
  label: string
  labelKz?: string | null
  enabled: boolean
  disabledReason?: string | null
  behavior: ActionBehavior
  column?: string | null // служебное поле бэка, фронт не использует
  inMoreMenu?: boolean // true ⇒ продублировать пункт в меню «Ещё»
}
```

- [ ] **Step 2: Написать падающий тест**

Создать `src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx`:

```tsx
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TableCommandDescriptor } from '../../../types/view'
import { TableToolbar } from './table-toolbar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
}))

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const noop = () => undefined

const baseProps = {
  onAdd: noop,
  onMoveUp: noop,
  onMoveDown: noop,
  onRemove: noop,
  canMoveUp: false,
  canMoveDown: false,
  canRemove: false,
}

const podbor: TableCommandDescriptor = {
  command: 'table.podbor:VychetyIPN',
  label: 'Подбор',
  labelKz: 'Іріктеу',
  enabled: true,
  disabledReason: null,
  behavior: { flushPendingTables: false, resetsDirty: false, closeAfter: false },
  inMoreMenu: true,
}

const raschet: TableCommandDescriptor = {
  command: 'table.rasschitatOklad:Nachisleniya',
  label: 'Рассчитать оклад',
  enabled: false,
  disabledReason: 'Нет строк для расчёта',
  behavior: { flushPendingTables: true, resetsDirty: false, closeAfter: false },
}

describe('TableToolbar: доменные кнопки из tableCommands (SCRUM-302)', () => {
  beforeEach(() => {
    cleanup()
    mockDispatch.mockClear()
  })

  it('рендерит кнопки в порядке массива после встроенных', () => {
    render(<TableToolbar {...baseProps} commands={[podbor, raschet]} />)
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
    const iPodbor = labels.indexOf('Подбор')
    const iRaschet = labels.indexOf('Рассчитать оклад')
    expect(iPodbor).toBeGreaterThan(-1)
    expect(iRaschet).toBeGreaterThan(iPodbor)
  })

  it('клик диспатчит COMMAND с behavior из дескриптора', () => {
    render(<TableToolbar {...baseProps} commands={[podbor]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Подбор' }))
    expect(mockDispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'table.podbor:VychetyIPN' },
      { flushPendingTables: false, resetsDirty: false, closeAfter: false },
    )
  })

  it('enabled:false — кнопка disabled, tooltip = disabledReason', async () => {
    render(<TableToolbar {...baseProps} commands={[raschet]} />)
    const btn = screen.getByRole('button', { name: 'Рассчитать оклад' })
    expect(btn).toHaveProperty('disabled', true)
    fireEvent.click(btn)
    expect(mockDispatch).not.toHaveBeenCalled()
    fireEvent.mouseOver(btn.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  it('без commands рендерится как раньше', () => {
    render(<TableToolbar {...baseProps} />)
    expect(screen.getByRole('button', { name: 'table.add' })).toBeTruthy()
  })
})
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx`
Expected: FAIL — `TableToolbar` не принимает `commands`, кнопок «Подбор» нет.

- [ ] **Step 4: Реализовать в `table-toolbar.tsx`**

Полная новая версия файла:

```tsx
import { useTranslation } from 'react-i18next'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { Tooltip } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import type { TableCommandDescriptor } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

interface TableToolbarProps {
  onAdd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canAdd?: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
  commands?: TableCommandDescriptor[]
}

export const TableToolbar = ({
  onAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
  canAdd = true,
  canMoveUp,
  canMoveDown,
  canRemove,
  allowAdd = true,
  allowReorder = true,
  allowDelete = true,
  commands = [],
}: TableToolbarProps) => {
  const { t, i18n } = useTranslation()
  const dispatch = useSduiDispatch()

  const commandLabel = (cmd: TableCommandDescriptor) =>
    i18n.language.startsWith('kz') ? (cmd.labelKz ?? cmd.label) : cmd.label

  const runCommand = (cmd: TableCommandDescriptor) => {
    void dispatch({ type: 'COMMAND', command: cmd.command }, cmd.behavior)
  }

  return (
    <div className="flex items-center gap-2">
      {allowAdd && (
        <Button variant="primary" disabled={!canAdd} onClick={onAdd}>
          {t('table.add')}
        </Button>
      )}
      {allowDelete && (
        <Button
          variant="secondary"
          disabled={!canRemove}
          onClick={onRemove}
          startIcon={<DeleteOutlineIcon sx={{ fontSize: 20 }} />}
        />
      )}
      {allowReorder && (
        <>
          <Button
            variant="secondary"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            startIcon={<KeyboardArrowUpIcon sx={{ fontSize: 20 }} />}
          />
          <Button
            variant="secondary"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            startIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
          />
        </>
      )}
      {commands.map((cmd) => {
        const btn = (
          <Button
            variant="secondary"
            disabled={!cmd.enabled}
            onClick={() => runCommand(cmd)}
          >
            {commandLabel(cmd)}
          </Button>
        )
        return !cmd.enabled && cmd.disabledReason ? (
          // span-обёртка обязательна: без неё tooltip не работает на disabled-кнопке
          <Tooltip key={cmd.command} title={cmd.disabledReason}>
            <span style={{ display: 'inline-flex' }}>{btn}</span>
          </Tooltip>
        ) : (
          <span key={cmd.command} style={{ display: 'inline-flex' }}>
            {btn}
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Прогнать тесты**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/types/view.ts src/features/sdui/ui/nodes/composite/table-toolbar.tsx src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx
git commit -m "feat: доменные кнопки ТЧ из tableCommands в TableToolbar (SCRUM-302)"
```

---

### Task 2: Прокинуть `tableCommands` из обеих таблиц

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx` (проп в `<TableToolbar>`, ~строка 115)
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx` (проп в `<TableToolbar>`, ~строка 194)
- Test: `src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx` (дополнить)

**Interfaces:**
- Consumes: `TableCommandDescriptor` (Task 1), `TableToolbar.commands` (Task 1).
- Produces: обе таблицы читают `node.props?.tableCommands` и передают в тулбар.

- [ ] **Step 1: Написать падающий тест**

В `complex-editable-table.test.tsx` добавить describe-блок (моки уже есть в файле — `react-i18next`, `dispatch`, `sdui-session-context`; `detailNode` определён выше):

```tsx
describe('ComplexEditableTable: tableCommands (SCRUM-302)', () => {
  it('рендерит доменную кнопку из props.tableCommands', () => {
    const nodeWithCommands = {
      ...detailNode,
      props: {
        ...detailNode.props,
        tableCommands: [
          {
            command: 'table.podbor:VychetyIPN',
            label: 'Подбор',
            enabled: true,
            behavior: { flushPendingTables: false },
            inMoreMenu: true,
          },
        ],
      },
    } as ViewNode
    render(<ComplexEditableTable node={nodeWithCommands} />)
    expect(screen.getByRole('button', { name: 'Подбор' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx`
Expected: FAIL — кнопки «Подбор» нет.

- [ ] **Step 3: Реализовать прокидывание**

В `complex-editable-table.tsx` рядом с чтением `allowAdd` (~строка 50):

```ts
const tableCommands = node.props?.tableCommands as
  | TableCommandDescriptor[]
  | undefined
```

импорт: `import type { ViewNode, TableCommandDescriptor } from '../../../types/view'`.
В JSX тулбара добавить `commands={tableCommands}`.

То же самое в `editable-table.tsx`: чтение рядом с `allowAdd` (~строка 36), импорт типа (`import type { ViewNode, TableCommandDescriptor } from '../../../types/view'` — заменить существующий импорт `ViewNode`), `commands={tableCommands}` в `<TableToolbar>`.

- [ ] **Step 4: Прогнать тесты обеих таблиц**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx src/features/sdui/ui/nodes/composite/table-toolbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/editable-table.tsx src/features/sdui/ui/nodes/composite/complex-editable-table.tsx src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx
git commit -m "feat: прокидывание tableCommands в тулбар обеих ТЧ-таблиц (SCRUM-302)"
```

---

### Task 3: Спека-v2-front для бэка

**Files:**
- Create: `specs-local/scrum-302-masshtabirovanie-knopok-2/SCRUM-302-spec-v2-2026-08-03-front.md` (папка в `.gitignore` — НЕ коммитить)

**Interfaces:**
- Consumes: расхождения из §2.2 дизайн-спеки.
- Produces: файл спеки для передачи бэку. Отправка в Jira (вложение + комментарий + перенос) — НЕ в этом плане, её делает основная сессия после подтверждения пользователя.

- [ ] **Step 1: Создать файл спеки**

Содержимое:

```markdown
# SCRUM-302-spec-v2-2026-08-03-front.md

Ответ на spec-v1-back. Контракт `tableCommands` принят как есть, фронт рендерит
дескрипторы и берёт `behavior` только из данных. Три уточнения по панели подбора —
ваша спека писалась против фронта до мержа SCRUM-284 Δ4 (28.07), и §6.2–6.3
уже неактуальны: `needsSelectedRow` и `refCommandField` удалены, фронт читает
всё с action-дескрипторов.

## 1. Δ4-поля на action, не в props ⚠ (блокер сценария «Подбор»)

Фронт активирует кнопку «Выбрать» и связывает её со списком ТОЛЬКО через поля
click-action (SCRUM-284 Δ4). `props.requiresSelectedRow` / `props.selectionKey`
фронт не читает вообще.

Нужно в панели подбора (`panel.choice.table.<tableCode>`):

- кнопке «Выбрать» — на её click-action:
  `"requiresSelectedRow": true, "selectionField": "table.<tableCode>"`
- LIST'у — на его select-action (trigger `rowSelect`/аналогичный, как у полей):
  `"selectionField": "table.<tableCode>"`

Имя поля именно `selectionField` (не `selectionKey`). Значение с префиксом
`table.` — как у вас и задумано, тут расхождения нет.

## 2. Формат value на `table.podborSelect`

Фронт шлёт выбор объектом — единый формат всех пикеров после Δ4:

    { "action": { "type": "COMMAND", "command": "table.podborSelect:VychetyIPN",
                  "value": { "id": 3325 } } }

В вашем §3 шаг 2 — голое число `"value": 3325`. Просьба принимать объект `{id}`.

## 3. `labelKz` — необязательный (не блокер)

Язык фиксируется на OPEN, при смене языка форма переоткрывается — можно
локализовать `label` сервером, как остальные подписи, и `labelKz` не слать.
Фронт при этом поддерживает `labelKz` фолбэком, так что текущий контракт тоже
работает. На ваше усмотрение.

## Статус фронта

- Рендер `tableCommands` + диспатч с behavior — готово (фаза 1).
- Меню «Ещё», перенос «Удалить», поиск, хоткеи (§6.4–6.5) — фаза 2, в работе.
- Сквозная проверка «Подбора» — после пуша/деплоя вашей ветки и правки п.1.
```

- [ ] **Step 2: Проверить, что файл не попадает в git**

Run: `git status --short specs-local/ | head -3`
Expected: пусто (папка в `.gitignore`).

Коммита в этой таске нет.

---

### Task 4: Меню «Ещё» + новый layout ряда

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/table-more-menu.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/table-toolbar.tsx`
- Modify: `src/app/config/i18n/locales/ru/common.json` (секция `"table"`, ~строка 171)
- Modify: `src/app/config/i18n/locales/kz/common.json` (секция `"table"`)
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx`, `complex-editable-table.tsx` (новые пропсы тулбара)
- Test: `src/features/sdui/ui/nodes/composite/table-more-menu.test.tsx` (создать), `table-toolbar.test.tsx` (дополнить), правки упавших ожиданий в тестах таблиц

**Interfaces:**
- Consumes: `TableCommandDescriptor` (Task 1).
- Produces:
  - компонент `TableMoreMenu` (см. пропсы в коде ниже; в Task 5–6 добавятся `onCopy`/`canCopy` уже здесь, а `hasQuery`/`onFind`/`onClearSearch` — в Task 6);
  - `TableToolbar` больше НЕ рендерит «Удалить» в ряду; новые пропсы `onCopy: () => void`, `canCopy: boolean`.

**Целевой layout ряда:**

```
[Добавить] [↑] [↓] [доменные…]  ←распорка→  [Ещё ▾]      (поле поиска добавит Task 6)
```

- [ ] **Step 1: Добавить i18n-ключи**

В `ru/common.json`, секция `"table"`, добавить:

```json
"more": "Ещё",
"copyRow": "Скопировать",
"deleteRow": "Удалить",
"moveUp": "Переместить вверх",
"moveDown": "Переместить вниз"
```

В `kz/common.json`, та же секция:

```json
"more": "Тағы",
"copyRow": "Көшіру",
"deleteRow": "Жою",
"moveUp": "Жоғары жылжыту",
"moveDown": "Төмен жылжыту"
```

- [ ] **Step 2: Написать падающий тест меню**

Создать `src/features/sdui/ui/nodes/composite/table-more-menu.test.tsx`:

```tsx
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TableCommandDescriptor } from '../../../types/view'
import { TableMoreMenu } from './table-more-menu'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
}))

const podbor: TableCommandDescriptor = {
  command: 'table.podbor:VychetyIPN',
  label: 'Подбор',
  enabled: true,
  behavior: { flushPendingTables: false },
  inMoreMenu: true,
}

const hidden: TableCommandDescriptor = {
  command: 'table.x:T',
  label: 'Не в меню',
  enabled: true,
  behavior: {},
  inMoreMenu: false,
}

const makeProps = () => ({
  anchorEl: document.body,
  onClose: vi.fn(),
  allowAdd: true,
  allowDelete: true,
  allowReorder: true,
  canAdd: true,
  canCopy: true,
  canRemove: true,
  canMoveUp: false,
  canMoveDown: true,
  onAdd: vi.fn(),
  onCopy: vi.fn(),
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  commands: [podbor, hidden],
  commandLabel: (cmd: TableCommandDescriptor) => cmd.label,
  onCommand: vi.fn(),
})

describe('TableMoreMenu (SCRUM-302)', () => {
  beforeEach(cleanup)

  it('стандартные пункты + доменные с inMoreMenu после разделителя', () => {
    render(<TableMoreMenu {...makeProps()} />)
    for (const key of [
      'table.add',
      'table.copyRow',
      'table.deleteRow',
      'table.moveUp',
      'table.moveDown',
    ]) {
      expect(screen.getByText(key)).toBeTruthy()
    }
    expect(screen.getByText('Подбор')).toBeTruthy()
    expect(screen.queryByText('Не в меню')).toBeNull()
    expect(screen.getByRole('separator')).toBeTruthy()
  })

  it('неактивность по правилам: moveUp disabled, moveDown активен', () => {
    render(<TableMoreMenu {...makeProps()} />)
    expect(
      screen.getByText('table.moveUp').closest('li')?.getAttribute('aria-disabled'),
    ).toBe('true')
    expect(
      screen.getByText('table.moveDown').closest('li')?.getAttribute('aria-disabled'),
    ).toBeNull()
  })

  it('клик по доменному пункту зовёт onCommand и закрывает меню', () => {
    const props = makeProps()
    render(<TableMoreMenu {...props} />)
    fireEvent.click(screen.getByText('Подбор'))
    expect(props.onCommand).toHaveBeenCalledWith(podbor)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('пункт удаления зовёт onRemove', () => {
    const props = makeProps()
    render(<TableMoreMenu {...props} />)
    fireEvent.click(screen.getByText('table.deleteRow'))
    expect(props.onRemove).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-more-menu.test.tsx`
Expected: FAIL — модуля `table-more-menu` нет.

- [ ] **Step 4: Реализовать `table-more-menu.tsx`**

```tsx
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Divider, ListItemText, Menu, MenuItem, Typography } from '@mui/material'

import type { TableCommandDescriptor } from '../../../types/view'

// Подписи хоткеев — непереводимые обозначения клавиш, не текст интерфейса
const HOTKEYS = {
  add: 'Ins',
  copy: 'F9',
  remove: 'Del',
  moveUp: 'Ctrl+Shift+↑',
  moveDown: 'Ctrl+Shift+↓',
}

export interface TableMoreMenuProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  allowAdd: boolean
  allowDelete: boolean
  allowReorder: boolean
  canAdd: boolean
  canCopy: boolean
  canRemove: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onAdd: () => void
  onCopy: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  commands: TableCommandDescriptor[]
  commandLabel: (cmd: TableCommandDescriptor) => string
  onCommand: (cmd: TableCommandDescriptor) => void
}

export const TableMoreMenu = ({
  anchorEl,
  onClose,
  allowAdd,
  allowDelete,
  allowReorder,
  canAdd,
  canCopy,
  canRemove,
  canMoveUp,
  canMoveDown,
  onAdd,
  onCopy,
  onRemove,
  onMoveUp,
  onMoveDown,
  commands,
  commandLabel,
  onCommand,
}: TableMoreMenuProps) => {
  const { t } = useTranslation()
  const menuCommands = commands.filter((cmd) => cmd.inMoreMenu === true)

  const item = (
    key: string,
    label: ReactNode,
    hotkey: string | null,
    disabled: boolean,
    onClick: () => void,
  ) => (
    <MenuItem
      key={key}
      disabled={disabled}
      onClick={() => {
        onClose()
        onClick()
      }}
    >
      <ListItemText>{label}</ListItemText>
      {hotkey && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
          {hotkey}
        </Typography>
      )}
    </MenuItem>
  )

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {item('add', t('table.add'), HOTKEYS.add, !allowAdd || !canAdd, onAdd)}
      {item('copy', t('table.copyRow'), HOTKEYS.copy, !allowAdd || !canCopy, onCopy)}
      {item('remove', t('table.deleteRow'), HOTKEYS.remove, !allowDelete || !canRemove, onRemove)}
      {item('moveUp', t('table.moveUp'), HOTKEYS.moveUp, !allowReorder || !canMoveUp, onMoveUp)}
      {item('moveDown', t('table.moveDown'), HOTKEYS.moveDown, !allowReorder || !canMoveDown, onMoveDown)}
      {menuCommands.length > 0 && <Divider />}
      {menuCommands.map((cmd) =>
        item(cmd.command, commandLabel(cmd), null, !cmd.enabled, () => onCommand(cmd)),
      )}
    </Menu>
  )
}
```

Примечание: `onCopy`/`canCopy` до Task 5 будут приходить заглушками из тулбара — это ок, меню самодостаточно.

- [ ] **Step 5: Прогнать тест меню**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/table-more-menu.test.tsx`
Expected: PASS.

- [ ] **Step 6: Перестроить `table-toolbar.tsx`**

Изменения относительно версии из Task 1:

1. Удалить блок `{allowDelete && (<Button … DeleteOutlineIcon …/>)}` и импорт `DeleteOutlineIcon`.
2. Новые пропсы: `onCopy?: () => void` (по умолчанию `() => undefined`), `canCopy?: boolean` (по умолчанию `false`).
3. После доменных кнопок — распорка и кнопка «Ещё» с состоянием якоря:

```tsx
import { useState } from 'react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown' // уже импортирован

// внутри компонента:
const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)

// в JSX после {commands.map(…)}:
<div className="flex-1" />
<Button
  variant="secondary"
  onClick={(e: React.MouseEvent<HTMLButtonElement>) => setMoreAnchor(e.currentTarget)}
  endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
>
  {t('table.more')}
</Button>
<TableMoreMenu
  anchorEl={moreAnchor}
  onClose={() => setMoreAnchor(null)}
  allowAdd={allowAdd}
  allowDelete={allowDelete}
  allowReorder={allowReorder}
  canAdd={canAdd}
  canCopy={canCopy}
  canRemove={canRemove}
  canMoveUp={canMoveUp}
  canMoveDown={canMoveDown}
  onAdd={onAdd}
  onCopy={onCopy}
  onRemove={onRemove}
  onMoveUp={onMoveUp}
  onMoveDown={onMoveDown}
  commands={commands}
  commandLabel={commandLabel}
  onCommand={runCommand}
/>
```

`Button` из `@/shared/ui/buttons` поддерживает `endIcon` (проверено в `src/shared/ui/buttons/button.tsx`). `DropdownButton` оттуда не подходит — его `onClick` не отдаёт элемент для `anchorEl`.

4. В `table-toolbar.test.tsx` добавить тесты:

```tsx
it('«Удалить» в ряду отсутствует, «Ещё» присутствует всегда', () => {
  render(<TableToolbar {...baseProps} />)
  // иконочной кнопки удаления больше нет: между «Добавить» и «Ещё» только ↑/↓
  expect(screen.getByRole('button', { name: 'table.more' })).toBeTruthy()
})

it('пункт удаления в «Ещё» зовёт onRemove', () => {
  const onRemove = vi.fn()
  render(
    <TableToolbar {...baseProps} onRemove={onRemove} canRemove={true} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
  fireEvent.click(screen.getByText('table.deleteRow'))
  expect(onRemove).toHaveBeenCalled()
})

it('доменная кнопка с inMoreMenu продублирована в «Ещё» и зовёт тот же dispatch', () => {
  render(<TableToolbar {...baseProps} commands={[podbor]} />)
  fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
  const items = screen.getAllByText('Подбор')
  // одна в ряду, одна в меню
  expect(items.length).toBe(2)
  fireEvent.click(items[1])
  expect(mockDispatch).toHaveBeenCalledWith(
    { type: 'COMMAND', command: 'table.podbor:VychetyIPN' },
    { flushPendingTables: false, resetsDirty: false, closeAfter: false },
  )
})
```

- [ ] **Step 7: Прогнать все тесты composite и починить упавшие ожидания**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: тесты, кликавшие иконочную кнопку «Удалить» в ряду (в `complex-editable-table.test.tsx` и др.), упадут. Починить их: удаление теперь через `fireEvent.click(screen.getByRole('button', { name: 'table.more' }))` → `fireEvent.click(screen.getByText('table.deleteRow'))`. Логику самих проверок не менять.

Re-run до PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/ src/app/config/i18n/locales/
git commit -m "feat: меню «Ещё» у ТЧ, перенос «Удалить» из ряда (SCRUM-302)"
```

---

### Task 5: «Скопировать» строку

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`
- Test: `src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx` (дополнить)

**Interfaces:**
- Consumes: `sync.addRow(columns, presetValues)` из `use-table-sync.ts` (существующий), пропсы `onCopy`/`canCopy` тулбара (Task 4).
- Produces: рабочий пункт «Скопировать» в обеих таблицах. `use-table-sync.ts` НЕ меняется.

- [ ] **Step 1: Написать падающий тест**

В `complex-editable-table.test.tsx`:

```tsx
describe('ComplexEditableTable: копирование строки (SCRUM-302)', () => {
  it('«Скопировать» добавляет строку со значениями выбранной, без rowId', () => {
    state['VychetyIPN.__selectedRowId'] = 'm1'
    render(<ComplexEditableTable node={detailNode} />)
    // выбрать строку dA1
    fireEvent.click(screen.getByText('Row dA1'))
    fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
    fireEvent.click(screen.getByText('table.copyRow'))
    // addRow шлёт EVENT полным снимком: последняя строка — копия dA1
    const call = mockDispatch.mock.calls.at(-1)?.[0] as {
      type: string
      value: { rowId: string; label?: unknown }[]
    }
    expect(call.type).toBe('EVENT')
    const added = call.value.at(-1)
    expect(added?.label).toBe('Row dA1')
    expect(added?.rowId).not.toBe('dA1')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx`
Expected: FAIL — пункт `table.copyRow` задизейблен (canCopy не прокинут) либо onCopy — заглушка.

- [ ] **Step 3: Реализовать обработчики**

`complex-editable-table.tsx`, рядом с `handleRemove`:

```ts
// Копия строки: существующий addRow с пресетами из выбранной строки (без rowId —
// buildEmptyRow сгенерирует новый tmp-id). Ссылочные ячейки {id, presentation}
// копируются как есть.
const handleCopy = () => {
  if (selectedRowId === null) return
  const src = sync.rows.find((r) => r.rowId === selectedRowId)
  if (!src) return
  const { rowId: _rowId, ...values } = src
  sync.addRow(flatColumns, values)
}
```

В `<TableToolbar>` добавить `onCopy={handleCopy}` и `canCopy={selectedRowId !== null}`.

`editable-table.tsx`, аналогично рядом с `handleRemove`:

```ts
const handleCopy = () => {
  if (selectedIndex === null) return
  const src = sync.rows[selectedIndex]
  if (!src) return
  const { rowId: _rowId, ...values } = src
  sync.addRow(columns, values)
}
```

В `<TableToolbar>`: `onCopy={handleCopy}`, `canCopy={selectedIndex !== null}`.

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/
git commit -m "feat: «Скопировать» строку ТЧ через addRow с пресетами (SCRUM-302)"
```

---

### Task 6: Клиентский поиск по ТЧ

**Files:**
- Create: `src/features/sdui/lib/hooks/use-table-search.ts`
- Create: `src/features/sdui/lib/hooks/use-table-search.test.ts`
- Modify: `src/features/sdui/ui/nodes/composite/table-toolbar.tsx` (поле поиска)
- Modify: `src/features/sdui/ui/nodes/composite/table-more-menu.tsx` (пункты «Найти»/«Отменить поиск»)
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx`, `complex-editable-table.tsx` (хук + подсветка + скролл)
- Modify: `src/app/config/i18n/locales/{ru,kz}/common.json`

**Interfaces:**
- Consumes: `TableRow` из `use-table-sync.ts`.
- Produces:

```ts
export interface TableSearchColumn { id: string; binding: string }
export interface TableSearchMatch { rowId: string; columnId: string }
export interface TableSearchApi {
  query: string
  setQuery: (q: string) => void
  matches: TableSearchMatch[]
  current: TableSearchMatch | null // подсвечиваемая ячейка
  next: () => void                 // Enter — следующее совпадение по кругу
  clear: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  focusInput: () => void
}
export function useTableSearch(rows: TableRow[], columns: TableSearchColumn[]): TableSearchApi
```

  - `TableToolbar` получает новый обязательный проп `search: TableSearchApi`;
  - `TableMoreMenu` получает `hasQuery: boolean`, `onFind: () => void`, `onClearSearch: () => void`.

**Ключевое требование (§6.5 спеки бэка): поиск НЕ фильтрует строки** — только подсветка найденной ячейки и скролл к ней.

- [ ] **Step 1: i18n-ключи**

`ru/common.json` секция `"table"`: `"find": "Найти"`, `"cancelSearch": "Отменить поиск"`, `"searchPlaceholder": "Поиск"`.
`kz/common.json`: `"find": "Табу"`, `"cancelSearch": "Іздеуді болдырмау"`, `"searchPlaceholder": "Іздеу"`.

- [ ] **Step 2: Написать падающий тест хука**

`src/features/sdui/lib/hooks/use-table-search.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTableSearch, type TableSearchColumn } from './use-table-search'

const columns: TableSearchColumn[] = [
  { id: 'col-name', binding: 'Name' },
  { id: 'col-ref', binding: 'VychetIPN' },
]

const rows = [
  { rowId: 'r1', Name: 'Оклад', VychetIPN: { id: 1, presentation: 'Вычет на обучение' } },
  { rowId: 'r2', Name: 'Надбавка', VychetIPN: { id: 2, presentation: 'Стандартный вычет' } },
  { rowId: 'r3', Name: 'надбавка за стаж', VychetIPN: null },
]

describe('useTableSearch (SCRUM-302)', () => {
  it('пустой запрос — нет совпадений и подсветки', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    expect(result.current.matches).toEqual([])
    expect(result.current.current).toBeNull()
  })

  it('матчит без регистра и по presentation ссылочной ячейки', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    act(() => result.current.setQuery('вычет'))
    expect(result.current.matches).toEqual([
      { rowId: 'r1', columnId: 'col-ref' },
      { rowId: 'r2', columnId: 'col-ref' },
    ])
    expect(result.current.current).toEqual({ rowId: 'r1', columnId: 'col-ref' })
  })

  it('next циклит по совпадениям', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    act(() => result.current.setQuery('надбавка'))
    expect(result.current.current?.rowId).toBe('r2')
    act(() => result.current.next())
    expect(result.current.current?.rowId).toBe('r3')
    act(() => result.current.next())
    expect(result.current.current?.rowId).toBe('r2')
  })

  it('смена запроса сбрасывает позицию, clear убирает всё', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    act(() => result.current.setQuery('надбавка'))
    act(() => result.current.next())
    act(() => result.current.setQuery('оклад'))
    expect(result.current.current).toEqual({ rowId: 'r1', columnId: 'col-name' })
    act(() => result.current.clear())
    expect(result.current.query).toBe('')
    expect(result.current.current).toBeNull()
  })
})
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/hooks/use-table-search.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Step 4: Реализовать `use-table-search.ts`**

```ts
import { useRef, useState } from 'react'

import type { TableRow } from './use-table-sync'

export interface TableSearchColumn {
  id: string
  binding: string
}

export interface TableSearchMatch {
  rowId: string
  columnId: string
}

export interface TableSearchApi {
  query: string
  setQuery: (q: string) => void
  matches: TableSearchMatch[]
  current: TableSearchMatch | null
  next: () => void
  clear: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  focusInput: () => void
}

// Текст ячейки для матчинга: ссылочные значения ({id, presentation}) — по
// presentation, остальное — строкой. Поиск 1С не фильтрует строки (§6.5),
// поэтому результат — координаты ячеек, а не отобранные строки.
function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    const presentation = (value as { presentation?: unknown }).presentation
    return presentation == null ? '' : String(presentation)
  }
  return String(value)
}

export function useTableSearch(
  rows: TableRow[],
  columns: TableSearchColumn[],
): TableSearchApi {
  const [query, setQueryState] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Пересчёт на каждый рендер сознательно: ТЧ — десятки строк, мемоизация
  // не окупается.
  const q = query.trim().toLowerCase()
  const matches: TableSearchMatch[] = []
  if (q) {
    for (const row of rows) {
      for (const col of columns) {
        if (cellText(row[col.binding]).toLowerCase().includes(q)) {
          matches.push({ rowId: row.rowId, columnId: col.id })
        }
      }
    }
  }

  const current = matches.length > 0 ? matches[index % matches.length] : null

  const setQuery = (next: string) => {
    setQueryState(next)
    setIndex(0)
  }

  return {
    query,
    setQuery,
    matches,
    current,
    next: () => setIndex((i) => i + 1),
    clear: () => {
      setQueryState('')
      setIndex(0)
    },
    inputRef,
    focusInput: () => inputRef.current?.focus(),
  }
}
```

- [ ] **Step 5: Прогнать тест хука**

Run: `npx vitest run src/features/sdui/lib/hooks/use-table-search.test.ts`
Expected: PASS.

- [ ] **Step 6: Поле поиска в `table-toolbar.tsx` + пункты в меню**

Тулбар: новый проп `search: TableSearchApi`. Между распоркой и «Ещё»:

```tsx
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

<TextField
  size="small"
  placeholder={t('table.searchPlaceholder')}
  value={search.query}
  inputRef={search.inputRef}
  onChange={(e) => search.setQuery(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') search.next()
    if (e.key === 'Escape') search.clear()
  }}
  sx={{ width: 200 }}
  InputProps={{
    endAdornment: search.query ? (
      <InputAdornment position="end">
        <IconButton size="small" onClick={search.clear}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </InputAdornment>
    ) : undefined,
  }}
/>
```

(Если в проекте MUI v6+ и `InputProps` deprecated — использовать `slotProps={{ input: { endAdornment: … } }}`.)

В `TableMoreMenu` добавить пропсы `hasQuery: boolean`, `onFind: () => void`, `onClearSearch: () => void` и два пункта между «Удалить» и «Переместить вверх»:

```tsx
{item('find', t('table.find'), 'Ctrl+Alt+F', false, onFind)}
{item('cancelSearch', t('table.cancelSearch'), 'Ctrl+Q', !hasQuery, onClearSearch)}
```

(добавить `find: 'Ctrl+Alt+F'`, `cancelSearch: 'Ctrl+Q'` в `HOTKEYS`).
Из тулбара: `hasQuery={Boolean(search.query)}`, `onFind={search.focusInput}`, `onClearSearch={search.clear}`.

- [ ] **Step 7: Подключить в обеих таблицах: хук, подсветка, скролл**

`editable-table.tsx`:

```tsx
import { useTableSearch } from '../../../lib/hooks/use-table-search'

// после useTableSync:
const search = useTableSearch(
  sync.rows,
  columns.map((c) => ({ id: c.id, binding: c.binding })),
)
const containerRef = useRef<HTMLDivElement | null>(null)

// скролл к текущему совпадению
useEffect(() => {
  if (!search.current) return
  containerRef.current
    ?.querySelector('[data-search-hit="true"]')
    ?.scrollIntoView({ block: 'nearest' })
}, [search.current?.rowId, search.current?.columnId])
```

`<TableToolbar … search={search} />`; на `<TableContainer component={Paper} ref={containerRef}>`.

В рендере ячеек (`row.getVisibleCells().map(…)`):

```tsx
{row.getVisibleCells().map((cell) => {
  const isHit =
    search.current?.rowId === row.original.rowId &&
    search.current?.columnId === cell.column.id
  return (
    <TableCell
      key={cell.id}
      data-search-hit={isHit || undefined}
      sx={{ p: 0, bgcolor: isHit ? 'action.focus' : undefined }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  )
})}
```

`complex-editable-table.tsx` — то же самое: хук на `visibleRows` (поиск по видимым строкам при master-detail) и `flatColumns.map((c) => ({ id: c.id, binding: c.binding }))`; подсветка в рендере ячеек идентична (`row.original.rowId` доступен так же).

Существующая мемоизация колонок не трогается — подсветка живёт на `TableCell`-обёртке, вне memoized cell-функций (иначе сбросится фокус инпутов).

- [ ] **Step 8: Компонентный тест «не фильтрует»**

В `complex-editable-table.test.tsx`:

```tsx
describe('ComplexEditableTable: поиск (SCRUM-302)', () => {
  it('поиск подсвечивает, но НЕ фильтрует строки', () => {
    state['VychetyIPN.__selectedRowId'] = 'm1'
    render(<ComplexEditableTable node={detailNode} />)
    fireEvent.change(screen.getByPlaceholderText('table.searchPlaceholder'), {
      target: { value: 'dA2' },
    })
    // обе видимые строки на месте — включая несовпадающую
    expect(screen.getByText('Row dA1')).toBeTruthy()
    expect(screen.getByText('Row dA2')).toBeTruthy()
  })
})
```

- [ ] **Step 9: Прогнать все затронутые тесты**

Run: `npx vitest run src/features/sdui/lib/hooks/use-table-search.test.ts src/features/sdui/ui/nodes/composite/`
Expected: PASS (тесты Task 1/4, падающие из-за нового обязательного пропа `search`, починить: передавать `search` — самый простой способ, обёртка-хелпер в тесте с реальным `useTableSearch([], [])` через компонент-обёртку, либо объект-заглушка `{ query: '', setQuery: noop, matches: [], current: null, next: noop, clear: noop, inputRef: { current: null }, focusInput: noop }`).

- [ ] **Step 10: Commit**

```bash
git add src/features/sdui/ src/app/config/i18n/locales/
git commit -m "feat: клиентский поиск по ТЧ — подсветка без фильтрации (SCRUM-302)"
```

---

### Task 7: Хоткеи ТЧ

**Files:**
- Create: `src/features/sdui/lib/utils/table-hotkeys.ts`
- Create: `src/features/sdui/lib/utils/table-hotkeys.test.ts`
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx`, `complex-editable-table.tsx` (обёртка с onKeyDown)

**Interfaces:**
- Consumes: обработчики таблиц (`handleAdd`, `handleCopy`, `handleRemove`, `handleMoveUp`, `handleMoveDown`), `search.focusInput`/`search.clear` (Task 6).
- Produces:

```ts
export interface TableHotkeyHandlers {
  onAdd: () => void
  onCopy: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onFocusSearch: () => void
  onClearSearch: () => void
}
export function createTableHotkeysHandler(
  handlers: TableHotkeyHandlers,
): (e: React.KeyboardEvent<HTMLElement>) => void
```

- [ ] **Step 1: Написать падающий тест**

`src/features/sdui/lib/utils/table-hotkeys.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createTableHotkeysHandler, type TableHotkeyHandlers } from './table-hotkeys'

function makeHandlers(): TableHotkeyHandlers {
  return {
    onAdd: vi.fn(),
    onCopy: vi.fn(),
    onRemove: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onFocusSearch: vi.fn(),
    onClearSearch: vi.fn(),
  }
}

function keyEvent(
  init: Partial<{
    key: string
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
    targetTag: string
  }>,
) {
  const target = document.createElement(init.targetTag ?? 'div')
  return {
    key: init.key ?? '',
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
    target,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLElement>
}

describe('createTableHotkeysHandler (SCRUM-302)', () => {
  it('Insert/F9/Delete зовут add/copy/remove вне инпута', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'Insert' }))
    onKeyDown(keyEvent({ key: 'F9' }))
    onKeyDown(keyEvent({ key: 'Delete' }))
    expect(h.onAdd).toHaveBeenCalled()
    expect(h.onCopy).toHaveBeenCalled()
    expect(h.onRemove).toHaveBeenCalled()
  })

  it('в инпуте ячейки Insert/F9/Delete игнорируются', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'Delete', targetTag: 'input' }))
    onKeyDown(keyEvent({ key: 'Insert', targetTag: 'input' }))
    onKeyDown(keyEvent({ key: 'F9', targetTag: 'textarea' }))
    expect(h.onRemove).not.toHaveBeenCalled()
    expect(h.onAdd).not.toHaveBeenCalled()
    expect(h.onCopy).not.toHaveBeenCalled()
  })

  it('Ctrl+Shift+стрелки двигают строку (и в инпуте тоже)', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'ArrowUp', ctrlKey: true, shiftKey: true, targetTag: 'input' }))
    onKeyDown(keyEvent({ key: 'ArrowDown', ctrlKey: true, shiftKey: true }))
    expect(h.onMoveUp).toHaveBeenCalled()
    expect(h.onMoveDown).toHaveBeenCalled()
  })

  it('Ctrl+F, Cmd+F и Ctrl+Alt+F фокусируют поиск с preventDefault', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    const e1 = keyEvent({ key: 'f', ctrlKey: true })
    const e2 = keyEvent({ key: 'f', metaKey: true })
    const e3 = keyEvent({ key: 'F', ctrlKey: true, altKey: true })
    onKeyDown(e1)
    onKeyDown(e2)
    onKeyDown(e3)
    expect(h.onFocusSearch).toHaveBeenCalledTimes(3)
    expect(e1.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+Q сбрасывает поиск', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'q', ctrlKey: true }))
    expect(h.onClearSearch).toHaveBeenCalled()
  })

  it('обычные клавиши не трогают ничего', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'a' }))
    onKeyDown(keyEvent({ key: 'Enter', targetTag: 'input' }))
    for (const fn of Object.values(h)) expect(fn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/utils/table-hotkeys.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `table-hotkeys.ts`**

```ts
// Хоткеи командной панели ТЧ (SCRUM-302, эталон — меню «Ещё» в 1С).
// Слушается на контейнере конкретной таблицы, НЕ на document: на форме
// несколько ТЧ, работает та, в которой фокус. Cmd на mac = Ctrl (кроме
// Cmd+Q — его перехватить нельзя, для сброса поиска только Ctrl+Q).

export interface TableHotkeyHandlers {
  onAdd: () => void
  onCopy: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onFocusSearch: () => void
  onClearSearch: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export function createTableHotkeysHandler(
  handlers: TableHotkeyHandlers,
): (e: React.KeyboardEvent<HTMLElement>) => void {
  return (e) => {
    const ctrl = e.ctrlKey || e.metaKey

    if (ctrl && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      handlers.onFocusSearch()
      return
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'q') {
      e.preventDefault()
      handlers.onClearSearch()
      return
    }
    if (ctrl && e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault()
      handlers.onMoveUp()
      return
    }
    if (ctrl && e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault()
      handlers.onMoveDown()
      return
    }

    // Клавиши без модификаторов не должны срабатывать, пока пользователь
    // печатает в ячейке
    if (isEditableTarget(e.target)) return
    if (e.key === 'Insert') {
      e.preventDefault()
      handlers.onAdd()
      return
    }
    if (e.key === 'F9') {
      e.preventDefault()
      handlers.onCopy()
      return
    }
    if (e.key === 'Delete') {
      e.preventDefault()
      handlers.onRemove()
    }
  }
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/features/sdui/lib/utils/table-hotkeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Подключить в обеих таблицах**

В `editable-table.tsx` и `complex-editable-table.tsx` корневой `<div>` компонента заменить на:

```tsx
const handleKeyDown = createTableHotkeysHandler({
  onAdd: handleAdd,
  onCopy: handleCopy,
  onRemove: handleRemove,
  onMoveUp: handleMoveUp,
  onMoveDown: handleMoveDown,
  onFocusSearch: search.focusInput,
  onClearSearch: search.clear,
})

return (
  // tabIndex=-1: контейнер получает фокус по клику внутрь — иначе keydown
  // с нефокусируемых строк не долетает
  <div tabIndex={-1} style={{ outline: 'none' }} onKeyDown={handleKeyDown}>
```

импорт: `import { createTableHotkeysHandler } from '../../../lib/utils/table-hotkeys'`.
Обработчики зовутся как есть — гейты (`selectedIndex !== null` и т.п.) уже внутри них.

- [ ] **Step 6: Прогнать все тесты SDUI-таблиц**

Run: `npx vitest run src/features/sdui/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/
git commit -m "feat: хоткеи командной панели ТЧ (SCRUM-302)"
```

---

### Task 8: Финальная сверка с критериями приёмки

**Files:**
- Никаких новых. Прогон тестов + ручная сверка по чеклисту.

- [ ] **Step 1: Полный прогон тестов слайса**

Run: `npx vitest run src/features/sdui/`
Expected: PASS, ноль упавших.

- [ ] **Step 2: Сверка с критериями §6.4.5 спеки бэка**

Пройтись по коду и подтвердить каждый пункт (файл:строка):

1. В ряду — Добавить · ↑ · ↓ · доменные; «Удалить» в ряду нет.
2. «Ещё» рендерится и при пустом `tableCommands`.
3. «Удалить» в «Ещё» неактивен без выбранной строки (`!canRemove`).
4. Доменная команда с `inMoreMenu` присутствует и в ряду, и в меню, оба пути зовут один `runCommand`.
5. Ctrl+Shift+↑/↓ работают; на первой/последней строке — no-op (гейты в `handleMoveUp/Down`).

Если какой-то пункт не подтверждается — исправить до PASS.

- [ ] **Step 3: Commit (если были правки)**

```bash
git add src/features/sdui/
git commit -m "fix: доводка панели ТЧ по критериям приёмки (SCRUM-302)"
```

---

## Вне плана (основная сессия, после Task 3)

- Отправка спеки-v2 бэку: вложение через `curl` + комментарий с меншоном Alisher Abdraimov (черновик — в чат пользователю на подтверждение), перенос тикета по workflow.
- Сквозная проверка «Подбора» на dev-стенде — после пуша/деплоя ветки бэка `talgat/SCRUM-302` и правки п.1 спеки-v2 (это внешняя зависимость, не гейт для мержа фронтовой части).
