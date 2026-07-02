# SDUI Frontend Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить бизнес-логику и знание протокола/эндпоинтов из SDUI-фронта согласно ревизии `docs/superpowers/specs/2026-07-02-sdui-course-audit.md` и handoff-спеке `docs/superpowers/specs/2026-07-02-sdui-backend-handoff.md`.

**Architecture:** Две фазы. Фаза 1 (задачи 1–2) — независимые фиксы, можно мержить сразу. Фаза 2 (задачи 3–10) — фронтовая сторона контрактных фиксов A1–A7 из handoff-спеки: код пишется и тестируется сейчас, **деплой строго синхронно с соответствующим пунктом бэка** (иначе сломаются текущие экраны). Каждая задача Фазы 2 помечена своим A-пунктом.

**Tech Stack:** React 19, TypeScript 5.9, Zustand, TanStack Query/Table, vitest, react-i18next.

## Global Constraints

- Тексты — только через `useTranslation` / `i18n.t` и ключи из `common.json` (ru И kz). Не хардкодить строки в JSX.
- НЕ добавлять `useMemo`/`useCallback` без явной перф-причины (правило проекта).
- Barrel-файлы (`index.ts`) только на уровне FSD-слайсов, не внутри сегментов.
- Формат коммитов: `feat|fix|add|refactor: описание` (husky commit-msg).
- НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build` после каждого изменения — только точечные `npx vitest run <файл>`. Полный build — один раз в конце, если пользователь попросит.
- Задачи Фазы 2 (3–10): код мержится в ветку, но релиз возможен только вместе с бэком (пункт A-N handoff-спеки указан в каждой задаче).
- Пути импортов: алиас `@/*` → `src/*`.

## Не входит в план (отдельные планы после появления бэк-контракта)

- Shell server-driven (sidebar/topbar/вкладки как SDUI-ноды), один catch-all роут, удаление `resolve-page-type.ts` — B1/B2 handoff-спеки.
- `sdui-document-page.tsx`: склейка `layoutCode`, `getDocumentListPath`, navigate на `/` — B1.
- LIST_FORM (B3), CHOICE_FORM и удаление dict-sidebar (B4), auth (B5).
- Master-detail фильтрация — легализована решением 2026-07-02, не трогаем.
- Двойная логика `allowShowAll`/`allowCreate`/`canBrowse` в reference-field-node (находка 3.5 ревизии) — устраняется целиком при переходе на CHOICE_FORM (B4), до этого кнопки легаси-пикера остаются.
- `dialog-host.tsx` инлайновые цветовые токены (LOW, косметика) — при случайном касании файла.
- Легаси (`features/form-renderer` и др.) — карта удаления в отчёте ревизии, не трогаем.

---

## Фаза 1 — независимые фиксы (деплой не связан с бэком)

### Task 1: i18n для захардкоженных строк SDUI

**Files:**
- Modify: `src/app/config/i18n/locales/ru/common.json` (секция `"sdui"`, строки 445–456)
- Modify: `src/app/config/i18n/locales/kz/common.json` (секция `"sdui"`)
- Modify: `src/features/sdui/lib/effect-handler.ts:49-51`
- Modify: `src/features/sdui/ui/unknown-node.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/object-field-node.tsx`
- Modify: `src/features/sdui/ui/nodes/layout/tabs-node.tsx:42-50`
- Test: `src/features/sdui/lib/sdui-i18n-keys.test.ts` (новый)

**Interfaces:**
- Consumes: существующие ключи `sdui.unknownNode`, `sdui.error` в `common.json`.
- Produces: новые ключи `sdui.downloadFailed`, `sdui.objectFieldStub`, `sdui.tabFallback` в обеих локалях.

- [ ] **Step 1: Написать падающий тест на наличие ключей в обеих локалях**

```ts
// src/features/sdui/lib/sdui-i18n-keys.test.ts
import { describe, it, expect } from 'vitest'

import ru from '@/app/config/i18n/locales/ru/common.json'
import kz from '@/app/config/i18n/locales/kz/common.json'

// Ключи, на которые ссылается код SDUI. Тест ловит забытую локаль (обычно kz).
const REQUIRED_FLAT_KEYS = [
  'unknownNode',
  'requestError',
  'tableFlushFailed',
  'refSelectStale',
  'error',
  'downloadFailed',
  'objectFieldStub',
  'tabFallback',
]

describe('sdui i18n keys', () => {
  it.each(REQUIRED_FLAT_KEYS)('ключ sdui.%s есть в ru и kz', (key) => {
    expect((ru.sdui as Record<string, unknown>)[key], `ru sdui.${key}`).toBeTypeOf('string')
    expect((kz.sdui as Record<string, unknown>)[key], `kz sdui.${key}`).toBeTypeOf('string')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/sdui-i18n-keys.test.ts`
Expected: FAIL на `downloadFailed`, `objectFieldStub`, `tabFallback` (и, возможно, на отсутствующих kz-ключах).

- [ ] **Step 3: Добавить ключи в обе локали**

В `src/app/config/i18n/locales/ru/common.json`, в объект `"sdui"` (после `"error": "Ошибка"` добавить запятую и):

```json
    "downloadFailed": "Не удалось скачать файл",
    "objectFieldStub": "Поле-объект пока не поддерживается (id: {{id}})",
    "tabFallback": "Вкладка {{index}}"
```

В `src/app/config/i18n/locales/kz/common.json`, в объект `"sdui"` (создать недостающие ключи по аналогии с ru; если каких-то из REQUIRED_FLAT_KEYS нет — добавить и их):

```json
    "downloadFailed": "Файлды жүктеу мүмкін болмады",
    "objectFieldStub": "Объект өрісі әзірге қолдау көрсетілмейді (id: {{id}})",
    "tabFallback": "Қойынды {{index}}"
```

- [ ] **Step 4: Прогнать тест — зелёный**

Run: `npx vitest run src/features/sdui/lib/sdui-i18n-keys.test.ts`
Expected: PASS (8 кейсов).

- [ ] **Step 5: effect-handler.ts — убрать хардкод**

Добавить импорт вверху файла:

```ts
import i18n from 'i18next'
```

Заменить строки 49–51:

```ts
          .catch(() =>
            showToast('error', 'Не удалось сформировать печатную форму'),
          )
```

на:

```ts
          .catch(() => showToast('error', i18n.t('sdui.downloadFailed')))
```

- [ ] **Step 6: unknown-node.tsx — использовать существующий ключ**

Заменить весь файл `src/features/sdui/ui/unknown-node.tsx` на:

```tsx
import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { NodeProps } from '../types/view'

export const UnknownNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        padding: 8,
        border: '1px dashed #f0a000',
        background: '#fff8e1',
        borderRadius: 4,
      }}
    >
      <Typography variant="caption">
        {t('sdui.unknownNode', { type: node.type })} (id: {node.id})
      </Typography>
    </div>
  )
}
```

- [ ] **Step 7: object-field-node.tsx — заглушка через i18n**

Заменить весь файл `src/features/sdui/ui/nodes/composite/object-field-node.tsx` на:

```tsx
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { NodeProps } from '../../../types/view'

export const ObjectFieldNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const visible = (node.props?.visible as boolean | undefined) ?? true

  if (!visible) return null

  return (
    <div
      style={{
        border: '2px dashed #bdbdbd',
        borderRadius: 4,
        padding: 12,
        color: '#9e9e9e',
        fontSize: 13,
      }}
    >
      {t('sdui.objectFieldStub', { id: node.id })}
    </div>
  )
}
```

- [ ] **Step 8: tabs-node.tsx — fallback-заголовок через i18n**

В `src/features/sdui/ui/nodes/layout/tabs-node.tsx` добавить импорт:

```ts
import { useTranslation } from 'react-i18next'
```

В начало компонента (после `const [activeIndex, setActiveIndex] = useState(0)`):

```ts
  const { t } = useTranslation()
```

Заменить label вкладки (строки 45–49):

```tsx
            label={
              (tab.props?.title as string | undefined) ??
              (tab.props?.label as string | undefined) ??
              `Tab ${idx + 1}`
            }
```

на:

```tsx
            label={
              (tab.props?.title as string | undefined) ??
              (tab.props?.label as string | undefined) ??
              t('sdui.tabFallback', { index: idx + 1 })
            }
```

- [ ] **Step 9: Прогнать все тесты sdui и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json src/features/sdui/lib/effect-handler.ts src/features/sdui/ui/unknown-node.tsx src/features/sdui/ui/nodes/composite/object-field-node.tsx src/features/sdui/ui/nodes/layout/tabs-node.tsx src/features/sdui/lib/sdui-i18n-keys.test.ts
git commit -m "fix: i18n для захардкоженных строк SDUI (ревизия 2026-07-02, LOW)"
```

### Task 2: icon-node — fallback-иконка вместо null (решение A9)

**Files:**
- Modify: `src/features/sdui/ui/nodes/display/icon-node.tsx`
- Test: `src/features/sdui/ui/nodes/display/icon-node.test.ts` (новый)

**Interfaces:**
- Produces: экспорт `resolveIcon(name: string)` и `FALLBACK_ICON` из `icon-node.tsx` (используются только тестом).

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/ui/nodes/display/icon-node.test.ts
import { describe, it, expect } from 'vitest'
import AddIcon from '@mui/icons-material/Add'

import { resolveIcon, FALLBACK_ICON } from './icon-node'

describe('resolveIcon', () => {
  it('известное имя → иконка из реестра', () => {
    expect(resolveIcon('Add')).toBe(AddIcon)
  })

  it('неизвестное имя → fallback (решение A9: не терять ноду молча)', () => {
    expect(resolveIcon('NoSuchIcon')).toBe(FALLBACK_ICON)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/display/icon-node.test.ts`
Expected: FAIL — `resolveIcon` не экспортируется.

- [ ] **Step 3: Реализация**

Заменить весь файл `src/features/sdui/ui/nodes/display/icon-node.tsx` на:

```tsx
import type { FC } from 'react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

import type { NodeProps } from '../../../types/view'

// Реестр имён согласован с бэком (handoff-спека A9). SVG живут на фронте,
// бэк присылает только имя строкой.
const ICON_MAP: Record<string, typeof AddIcon> = {
  Add: AddIcon,
  Close: CloseIcon,
  Delete: DeleteIcon,
  DeleteOutline: DeleteOutlineIcon,
  HelpOutline: HelpOutlineIcon,
}

export const FALLBACK_ICON = HelpOutlineIcon

export function resolveIcon(name: string): typeof AddIcon {
  return ICON_MAP[name] ?? FALLBACK_ICON
}

export const IconNode: FC<NodeProps> = ({ node }) => {
  const name = (node.props?.name as string | undefined) ?? ''
  if (!name) return null

  const Icon = resolveIcon(name)
  return <Icon />
}
```

- [ ] **Step 4: Прогнать тест — зелёный**

Run: `npx vitest run src/features/sdui/ui/nodes/display/icon-node.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/display/icon-node.tsx src/features/sdui/ui/nodes/display/icon-node.test.ts
git commit -m "fix: fallback-иконка для неизвестного имени в IconNode (решение A9)"
```

---

## Фаза 2 — фронтовая сторона контрактных фиксов (деплой синхронно с бэком)

### Task 3: Метаданные действий вместо SAVE_COMMANDS (A1)

**Files:**
- Create: `src/features/sdui/lib/action-meta.ts`
- Modify: `src/features/sdui/types/view.ts:19-26` (интерфейс `ViewAction`)
- Modify: `src/features/sdui/lib/dispatch.ts:18,76,115`
- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx`
- Modify: `src/features/sdui/ui/nodes/action/menu-item-node.tsx`
- Test: `src/features/sdui/lib/action-meta.test.ts` (новый)

**Interfaces:**
- Produces: `extractActionMeta(props: Record<string, unknown> | undefined): ActionMeta`, где `ActionMeta = { flushPendingTables: boolean; resetsDirty: boolean; requiresSelectedRow: boolean; selectionScope: string | null }`. Поля `ViewAction`: `flushPendingTables?: boolean`, `resetsDirty?: boolean`. Task 4 и Task 6 зависят от этого.
- Контракт бэка: BUTTON/MENU_ITEM-ноды получают пропсы `flushPendingTables`, `resetsDirty`, `requiresSelectedRow`, `selectionScope` (handoff A1/A3). Поле `closeAfter` из A1 фронтом НЕ читается — закрытие бэк выражает effects (`closeDialog`/`navigate`).

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/action-meta.test.ts
import { describe, it, expect } from 'vitest'

import { extractActionMeta } from './action-meta'

describe('extractActionMeta', () => {
  it('отсутствие пропсов → всё запрещено (запрещающие дефолты, решение A7)', () => {
    expect(extractActionMeta(undefined)).toEqual({
      flushPendingTables: false,
      resetsDirty: false,
      requiresSelectedRow: false,
      selectionScope: null,
    })
    expect(extractActionMeta({})).toEqual({
      flushPendingTables: false,
      resetsDirty: false,
      requiresSelectedRow: false,
      selectionScope: null,
    })
  })

  it('только строгий boolean true включает флаг', () => {
    expect(
      extractActionMeta({
        flushPendingTables: true,
        resetsDirty: 'yes',
        requiresSelectedRow: 1,
        selectionScope: 'Kontragent',
      }),
    ).toEqual({
      flushPendingTables: true,
      resetsDirty: false,
      requiresSelectedRow: false,
      selectionScope: 'Kontragent',
    })
  })

  it('не-строковый selectionScope → null', () => {
    expect(extractActionMeta({ selectionScope: 42 }).selectionScope).toBeNull()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/action-meta.test.ts`
Expected: FAIL — модуль `./action-meta` не существует.

- [ ] **Step 3: Реализация extractActionMeta**

```ts
// src/features/sdui/lib/action-meta.ts

/**
 * Декларативные метаданные действия (handoff-спека A1/A3).
 * Фронт не знает имён команд — поведение описывает бэк пропсами ноды.
 * Дефолты запрещающие (решение A7): отсутствие пропа = false.
 */
export interface ActionMeta {
  /** Перед отправкой слить несохранённые строки таблиц в state. */
  flushPendingTables: boolean
  /** После успешного ответа снять признак dirty. */
  resetsDirty: boolean
  /** Кнопка активна только при выделенной строке списка. */
  requiresSelectedRow: boolean
  /** Область выделения (какой список публикует строку), непрозрачная строка. */
  selectionScope: string | null
}

export function extractActionMeta(
  props: Record<string, unknown> | undefined,
): ActionMeta {
  return {
    flushPendingTables: props?.flushPendingTables === true,
    resetsDirty: props?.resetsDirty === true,
    requiresSelectedRow: props?.requiresSelectedRow === true,
    selectionScope:
      typeof props?.selectionScope === 'string' ? props.selectionScope : null,
  }
}
```

- [ ] **Step 4: Прогнать тест — зелёный**

Run: `npx vitest run src/features/sdui/lib/action-meta.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Расширить ViewAction**

В `src/features/sdui/types/view.ts` заменить интерфейс `ViewAction` (строки 19–26) на:

```ts
export interface ViewAction {
  type: ActionType
  sourceNodeId?: string
  trigger?: string
  command?: string
  value?: unknown
  layoutCode?: string
  /** A1: слить несохранённые строки таблиц перед отправкой (метаданные от бэка). */
  flushPendingTables?: boolean
  /** A1: сбросить dirty после успеха (метаданные от бэка). */
  resetsDirty?: boolean
}
```

- [ ] **Step 6: dispatch.ts — заменить SAVE_COMMANDS на метаданные**

Удалить строку 18:

```ts
const SAVE_COMMANDS = ['save', 'saveAndClose', 'post', 'postAndClose']
```

Заменить строку 76:

```ts
        if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
```

на:

```ts
        if (action.flushPendingTables === true) {
```

Заменить строку 115:

```ts
          if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
```

на:

```ts
          if (action.resetsDirty === true) {
```

- [ ] **Step 7: button-node.tsx — передавать метаданные (без ref.select-парсинга — его убирает Task 6)**

На этом шаге меняем ТОЛЬКО обычную ветку dispatch (строка 47). Ветку `usesSelectedRow` не трогаем — её переделывает Task 6. Заменить:

```ts
      void dispatch({ type: 'COMMAND', command })
```

на:

```ts
      void dispatch({
        type: 'COMMAND',
        command,
        sourceNodeId: node.id,
        flushPendingTables: meta.flushPendingTables,
        resetsDirty: meta.resetsDirty,
      })
```

и добавить в начало компонента (после строки `const variantProp = ...`):

```ts
  const meta = extractActionMeta(node.props)
```

с импортом:

```ts
import { extractActionMeta } from '../../../lib/action-meta'
```

- [ ] **Step 8: menu-item-node.tsx — то же самое**

Заменить весь файл `src/features/sdui/ui/nodes/action/menu-item-node.tsx` на:

```tsx
import type { FC } from 'react'
import { MenuItem } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { extractActionMeta } from '../../../lib/action-meta'

export const MenuItemNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  const meta = extractActionMeta(node.props)

  const dispatch = useSduiDispatch()

  const handleClick = () => {
    if (command) {
      void dispatch({
        type: 'COMMAND',
        command,
        sourceNodeId: node.id,
        flushPendingTables: meta.flushPendingTables,
        resetsDirty: meta.resetsDirty,
      })
    }
  }

  return <MenuItem onClick={handleClick}>{label}</MenuItem>
}
```

- [ ] **Step 9: Прогнать все тесты sdui и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/lib/action-meta.ts src/features/sdui/lib/action-meta.test.ts src/features/sdui/types/view.ts src/features/sdui/lib/dispatch.ts src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/action/menu-item-node.tsx
git commit -m "refactor: метаданные действий вместо SAVE_COMMANDS (handoff A1)"
```

### Task 4: sdui-screen — dirtyCloseAction вместо хардкода 'save' (A1)

**Files:**
- Modify: `src/features/sdui/ui/sdui-screen.tsx:98-107`

**Interfaces:**
- Consumes: поля `flushPendingTables`/`resetsDirty` в `ViewAction` (Task 3).
- Контракт бэка: корневая нода дерева (в ответе OPEN) несёт `props.dirtyCloseAction: { command: string; flushPendingTables?: boolean; resetsDirty?: boolean }` — дескриптор «что выполнить при закрытии вкладки с несохранёнными изменениями» (handoff A1, `onDirtyClose`).

- [ ] **Step 1: Заменить эффект pending-действия**

В `src/features/sdui/ui/sdui-screen.tsx` заменить эффект (строки 98–107):

```ts
  useEffect(() => {
    const route = location.pathname
    const pending = consumePendingAction?.(route)
    if (pending === 'save-and-close') {
      void dispatch({ type: 'COMMAND', command: 'save' }).then((ok) => {
        if (!ok) return
        onSavedAndClosed?.(route)
      })
    }
  }, [location.pathname, dispatch, consumePendingAction, onSavedAndClosed])
```

на:

```ts
  useEffect(() => {
    const route = location.pathname
    const pending = consumePendingAction?.(route)
    if (pending === 'save-and-close') {
      // A1: дескриптор «сохранить при закрытии» присылает бэк в корне дерева —
      // фронт не знает имени сохраняющей команды.
      const dirtyClose = tree?.props?.dirtyCloseAction as
        | { command?: string; flushPendingTables?: boolean; resetsDirty?: boolean }
        | undefined
      if (!dirtyClose?.command) {
        console.warn('SDUI: в дереве нет props.dirtyCloseAction — сохранение при закрытии невозможно')
        return
      }
      void dispatch({
        type: 'COMMAND',
        command: dirtyClose.command,
        flushPendingTables: dirtyClose.flushPendingTables === true,
        resetsDirty: dirtyClose.resetsDirty === true,
      }).then((ok) => {
        if (!ok) return
        onSavedAndClosed?.(route)
      })
    }
  }, [location.pathname, dispatch, consumePendingAction, onSavedAndClosed, tree])
```

Примечание: строковый токен `'save-and-close'` между хостом вкладок и SduiScreen — внутренняя фронтовая механика (не протокол бэка), остаётся.

- [ ] **Step 2: Прогнать тесты и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/ui/sdui-screen.tsx
git commit -m "refactor: dirtyCloseAction от бэка вместо хардкода команды save (handoff A1)"
```

### Task 5: ReadOnlyTable — addRow/deleteRow из actions бэка (A2)

**Files:**
- Create: `src/features/sdui/lib/utils/action-template.ts`
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx:94-116,120-145,153,178-187`
- Test: `src/features/sdui/lib/utils/action-template.test.ts` (новый)

**Interfaces:**
- Produces: `substituteRowId(command: string, rowId: string): string`.
- Контракт бэка: TABLE-нода (read-only) несёт `actions: [{ trigger: 'addRow', actionId: 'command', command: '...' }, { trigger: 'deleteRow', actionId: 'command', command: '...{rowId}...' }]` (handoff A2). Кнопки рендерятся только при наличии action — пропсы `allowAdd`/`allowDelete` в read-only ветке больше не читаются.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/utils/action-template.test.ts
import { describe, it, expect } from 'vitest'

import { substituteRowId } from './action-template'

describe('substituteRowId', () => {
  it('подставляет rowId в шаблон {rowId} (механически, без знания семантики)', () => {
    expect(substituteRowId('deleteRow:PlanFinansirovaniya:{rowId}', 'r42')).toBe(
      'deleteRow:PlanFinansirovaniya:r42',
    )
  })

  it('шаблон без плейсхолдера возвращается как есть', () => {
    expect(substituteRowId('someCommand', 'r1')).toBe('someCommand')
  })

  it('несколько вхождений заменяются все', () => {
    expect(substituteRowId('{rowId}:{rowId}', 'x')).toBe('x:x')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/utils/action-template.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Реализация**

```ts
// src/features/sdui/lib/utils/action-template.ts

/**
 * Подстановка идентификатора строки в шаблон команды от бэка (handoff A2).
 * Фронт выполняет замену механически — семантику имени знает только бэк.
 */
export function substituteRowId(command: string, rowId: string): string {
  return command.replaceAll('{rowId}', rowId)
}
```

- [ ] **Step 4: Прогнать тест — зелёный**

Run: `npx vitest run src/features/sdui/lib/utils/action-template.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Переписать ReadOnlyTable на actions**

В `src/features/sdui/ui/nodes/composite/table-node.tsx`:

Добавить импорт:

```ts
import { substituteRowId } from '../../../lib/utils/action-template'
```

Заменить в компоненте `ReadOnlyTable` строки 96–116:

```ts
  const label = node.props?.label as string | undefined
  const allowAdd = node.props?.allowAdd as boolean | undefined
  const allowDelete = node.props?.allowDelete as boolean | undefined

  const { getValue } = useSduiSession()
  const rows =
    (getValue(node.binding) as SimpleTableRow[] | undefined) ?? []
  const dispatch = useSduiDispatch()

  const columns = extractReadOnlyColumns(node.children)

  const handleAdd = () => {
    void dispatch({ type: 'COMMAND', command: `addRow:${node.binding}` })
  }

  const handleDelete = (rowId: string) => {
    void dispatch({
      type: 'COMMAND',
      command: `deleteRow:${node.binding}:${rowId}`,
    })
  }
```

на:

```ts
  const label = node.props?.label as string | undefined

  // A2: имена команд присылает бэк в actions ноды — фронт их не конструирует.
  const addAction = node.actions?.find((a) => a.trigger === 'addRow')
  const deleteAction = node.actions?.find((a) => a.trigger === 'deleteRow')

  const { getValue } = useSduiSession()
  const rows =
    (getValue(node.binding) as SimpleTableRow[] | undefined) ?? []
  const dispatch = useSduiDispatch()

  const columns = extractReadOnlyColumns(node.children)

  const handleAdd = () => {
    if (!addAction?.command) return
    void dispatch({ type: 'COMMAND', command: addAction.command, sourceNodeId: node.id })
  }

  const handleDelete = (rowId: string) => {
    if (!deleteAction?.command) return
    void dispatch({
      type: 'COMMAND',
      command: substituteRowId(deleteAction.command, rowId),
      sourceNodeId: node.id,
    })
  }
```

Далее в JSX того же компонента заменить все проверки `allowAdd` на `addAction` и `allowDelete` на `deleteAction` (4 места):

- строка 120: `{(label || allowAdd) && (` → `{(label || addAction) && (`
- строка 134: `{allowAdd && (` → `{addAction && (`
- строка 153: `{allowDelete && <TableCell padding="checkbox" />}` → `{deleteAction && <TableCell padding="checkbox" />}`
- строка 160: `colSpan={columns.length + (allowDelete ? 1 : 0)}` → `colSpan={columns.length + (deleteAction ? 1 : 0)}`
- строка 178: `{allowDelete && (` → `{deleteAction && (`

- [ ] **Step 6: Прогнать тесты и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/lib/utils/action-template.ts src/features/sdui/lib/utils/action-template.test.ts src/features/sdui/ui/nodes/composite/table-node.tsx
git commit -m "refactor: addRow/deleteRow из actions бэка в ReadOnlyTable (handoff A2)"
```

### Task 6: selectionScope вместо парсинга ref.select: (A3)

**Files:**
- Modify: `src/features/sdui/lib/stores/ref-picker-selection-store.ts:23-36` (удалить `refCommandField`, `needsSelectedRow`)
- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx:19-22,122-132`
- Modify: `src/features/sdui/lib/relay-selection.ts:33-52`
- Modify: `src/features/sdui/types/view.ts:59-73` (интерфейс `ViewEffect`)
- Test: `src/features/sdui/lib/stores/ref-picker-selection-store.test.ts` (новый)

**Interfaces:**
- Consumes: `extractActionMeta` (Task 3) — поля `requiresSelectedRow`, `selectionScope`.
- Produces: store без `refCommandField`/`needsSelectedRow`; `ViewEffect.applyToParentCommand?: string`.
- Контракт бэка: LIST-нода несёт `props.selectionScope: string`; кнопки, работающие с выделенной строкой, несут `props.requiresSelectedRow: true` и `props.selectionScope` с тем же значением; effect `closeDialog` при выборе несёт `applyToParentCommand` — готовое имя команды ретрансляции (handoff A2/A3).

- [ ] **Step 1: Написать падающий тест на store (фиксирует поведение до чистки)**

```ts
// src/features/sdui/lib/stores/ref-picker-selection-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

import { useRefPickerSelectionStore } from './ref-picker-selection-store'

describe('ref-picker-selection-store', () => {
  beforeEach(() => {
    useRefPickerSelectionStore.setState({ selection: {} })
  })

  it('setSelection публикует строку в области (scope — непрозрачная строка от бэка)', () => {
    useRefPickerSelectionStore.getState().setSelection('scopeA', 5)
    expect(useRefPickerSelectionStore.getState().selection.scopeA).toBe(5)
  })

  it('clearSelection удаляет область, не трогая соседние', () => {
    const s = useRefPickerSelectionStore.getState()
    s.setSelection('scopeA', 5)
    s.setSelection('scopeB', 7)
    useRefPickerSelectionStore.getState().clearSelection('scopeA')
    expect(useRefPickerSelectionStore.getState().selection).toEqual({ scopeB: 7 })
  })
})
```

- [ ] **Step 2: Прогнать — тест зелёный (store уже так работает; тест страхует чистку)**

Run: `npx vitest run src/features/sdui/lib/stores/ref-picker-selection-store.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 3: Удалить парсеры команд из store**

В `src/features/sdui/lib/stores/ref-picker-selection-store.ts` удалить целиком функции `refCommandField` (строки 23–28) и `needsSelectedRow` (строки 30–36). `useRefPickerSelection` оставить.

- [ ] **Step 4: button-node.tsx — requiresSelectedRow/selectionScope из метаданных**

Заменить весь файл `src/features/sdui/ui/nodes/action/button-node.tsx` на:

```tsx
import { useState, type FC } from 'react'
import { Button, Menu } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { extractActionMeta } from '../../../lib/action-meta'
import { useRefPickerSelection } from '../../../lib/stores/ref-picker-selection-store'
import { NodeRenderer } from '../../node-renderer'

export const ButtonNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const variantProp = node.props?.variant as string | undefined
  // A3: «кнопке нужна выделенная строка» и область выделения — метаданные от
  // бэка, а не парсинг префикса имени команды.
  const meta = extractActionMeta(node.props)

  const dispatch = useSduiDispatch()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const selectedRowId = useRefPickerSelection(
    meta.requiresSelectedRow ? meta.selectionScope : null,
  )

  const isDropdown = variantProp === 'dropdown' && !!node.children?.length
  const muiVariant = variantProp === 'primary' ? 'contained' : 'outlined'
  const disabled = !enabled || (meta.requiresSelectedRow && selectedRowId == null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDropdown) {
      setMenuAnchor(e.currentTarget)
      return
    }
    if (!command) return
    if (meta.requiresSelectedRow) {
      if (selectedRowId == null) return
      void dispatch({
        type: 'COMMAND',
        command,
        value: { id: selectedRowId },
        sourceNodeId: node.id,
        flushPendingTables: meta.flushPendingTables,
        resetsDirty: meta.resetsDirty,
      })
      return
    }
    void dispatch({
      type: 'COMMAND',
      command,
      sourceNodeId: node.id,
      flushPendingTables: meta.flushPendingTables,
      resetsDirty: meta.resetsDirty,
    })
  }

  return (
    <>
      <Button
        variant={muiVariant}
        disabled={disabled}
        onClick={handleClick}
      >
        {label}
      </Button>
      {isDropdown && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
        </Menu>
      )}
    </>
  )
}
```

- [ ] **Step 5: list-node.tsx — публиковать выделение в selectionScope**

В `src/features/sdui/ui/nodes/composite/list-node.tsx`:

Импорт (строки 19–22) заменить:

```ts
import {
  refCommandField,
  useRefPickerSelectionStore,
} from '../../../lib/stores/ref-picker-selection-store'
```

на:

```ts
import { useRefPickerSelectionStore } from '../../../lib/stores/ref-picker-selection-store'
```

Строку 123:

```ts
  const selectField = refCommandField(selectAction?.command)
```

заменить на:

```ts
  // A3: область выделения — generic-проп от бэка, не парсинг имени команды.
  const selectField = (node.props?.selectionScope as string | undefined) ?? null
```

Остальной эффект публикации (строки 124–132) не меняется — `selectField` уже используется как непрозрачный ключ.

- [ ] **Step 6: ViewEffect.applyToParentCommand + relay-selection**

В `src/features/sdui/types/view.ts` в интерфейс `ViewEffect` после `applyToParentTargetNodeId?: string` добавить:

```ts
  /** A3: готовое имя команды ретрансляции выбора — фронт его не конструирует. */
  applyToParentCommand?: string
```

В `src/features/sdui/lib/relay-selection.ts` заменить (строки 39–52):

```ts
  if (!effect.applyToParentSessionId || !effect.applyToParentTargetNodeId || !effect.applyToParentValue) {
    return
  }
  const panels = usePanelStore.getState()
  const parentPanel = panels.findBySessionId(effect.applyToParentSessionId)
  const tree = useTreeStore.getState()
  const parentRevision = parentPanel?.session?.revision ?? tree.revision
  const parentPanelId = parentPanel?.panelId

  const action = {
    type: 'COMMAND' as const,
    command: `ref.select:${effect.applyToParentTargetNodeId}`,
    value: effect.applyToParentValue,
  }
```

на:

```ts
  if (!effect.applyToParentSessionId || !effect.applyToParentValue) {
    return
  }
  if (!effect.applyToParentCommand) {
    console.warn('SDUI: effect без applyToParentCommand — выбор не ретранслирован (handoff A3)')
    return
  }
  const panels = usePanelStore.getState()
  const parentPanel = panels.findBySessionId(effect.applyToParentSessionId)
  const tree = useTreeStore.getState()
  const parentRevision = parentPanel?.session?.revision ?? tree.revision
  const parentPanelId = parentPanel?.panelId

  const action = {
    type: 'COMMAND' as const,
    command: effect.applyToParentCommand,
    value: effect.applyToParentValue,
  }
```

(`applyToParentTargetNodeId` больше не участвует в построении команды; если он не используется нигде ещё — убрать из условия, как показано выше, но оставить в типе `ViewEffect`: бэк может продолжать его слать.)

- [ ] **Step 7: Проверить, что парсеры нигде не остались**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

Grep-проверка (не должно быть совпадений вне тестов/доков):

```bash
grep -rn "refCommandField\|needsSelectedRow\|ref\.select:" src/features/sdui/
```

Expected: пусто.

- [ ] **Step 8: Commit**

```bash
git add src/features/sdui/lib/stores/ref-picker-selection-store.ts src/features/sdui/lib/stores/ref-picker-selection-store.test.ts src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/composite/list-node.tsx src/features/sdui/lib/relay-selection.ts src/features/sdui/types/view.ts
git commit -m "refactor: selectionScope и applyToParentCommand от бэка вместо парсинга ref.select (handoff A3)"
```

### Task 7: reference-field-node — убрать DOMAIN_PATH_MAP и дефолт домена (A4 + A7)

**Files:**
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx:13-17,36,50-56,64-89,104`

**Interfaces:**
- Контракт бэка: каждое REFERENCE-поле несёт `props.optionsSource: { url, params? }` (A4) и явный `props.domain` (A7). Без `optionsSource` автодополнение не работает; без `domain` кнопки легаси-пикера не показываются.

- [ ] **Step 1: Удалить карту доменов и дефолт**

В `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`:

Удалить строки 13–17:

```ts
const DOMAIN_PATH_MAP: Record<string, string> = {
  DICTIONARY: 'dictionary-entries',
  DOCUMENT: 'document-entries',
  ACCOUNT_PLAN: 'account-plan',
}
```

Заменить строку 36:

```ts
  const domain = (node.props?.domain as string | undefined) ?? 'DICTIONARY'
```

на:

```ts
  // A7: домен обязателен — фронт не угадывает.
  const domain = node.props?.domain as string | undefined
```

- [ ] **Step 2: loadOptions только из optionsSource**

Удалить строку 66:

```ts
  const domainPath = DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'
```

Заменить `loadOptions` (строки 68–89) на:

```ts
  const loadOptions = (search?: string) => {
    // A4: URL источника опций всегда присылает бэк — фронт не строит эндпоинты.
    if (!optionsSource) return
    const seq = ++requestSeqRef.current
    setLoading(true)
    fetchReferenceOptions({ url: optionsSource.url, params: optionsSource.params, search })
      .then((opts) => {
        if (seq !== requestSeqRef.current) return // поздний ответ раннего запроса — игнор
        setOptions(opts)
      })
      .catch(() => {
        if (seq === requestSeqRef.current) setOptions([])
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setLoading(false)
      })
  }
```

Упростить `paramsKey` (строки 51–53):

```ts
  const paramsKey = optionsSource?.params
    ? JSON.stringify(optionsSource.params)
    : JSON.stringify(filter ?? null)
```

на:

```ts
  const paramsKey = JSON.stringify(optionsSource?.params ?? null)
```

- [ ] **Step 3: canBrowse требует явный домен**

Заменить строку 104:

```ts
  const canBrowse = !!targetTypeCode && !f.readonly && f.enabled
```

на:

```ts
  const canBrowse = !!domain && !!targetTypeCode && !f.readonly && f.enabled
```

В вызовах `openReferencePicker` (openDictList, openDictCreate, endAction edit-ветка) `domain` передаётся как раньше, но теперь тип `string | undefined`; все три вызова достижимы только при `canBrowse === true`, поэтому заменить `domain,` на `domain: domain!,` в каждом из трёх вызовов.

- [ ] **Step 4: Прогнать тесты и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/ui/nodes/fields/reference-field-node.tsx
git commit -m "refactor: optionsSource обязателен, DOMAIN_PATH_MAP удалён (handoff A4, A7)"
```

### Task 8: Единый формат пагинации (A5)

**Files:**
- Modify: `src/features/sdui/api/reference-options.ts`
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx:81-92`

**Interfaces:**
- Produces: `fetchListPage` возвращает `{ items: ListRow[]; total: number; page: number; size: number }`.
- Контракт бэка: все списочные ответы SDUI — единый формат `{ items, total, page, size }` (handoff A5; если бэк финально выберет иные имена полей — правка в одном файле `reference-options.ts`).

- [ ] **Step 1: Переписать reference-options.ts на единый формат**

Заменить весь файл `src/features/sdui/api/reference-options.ts` на:

```ts
import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'

interface EntryItem {
  id: number
  presentation?: string
  [key: string]: unknown
}

// A5: единый формат страницы для всех списочных ответов SDUI.
interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export async function fetchReferenceOptions(args: {
  url: string
  params?: Record<string, unknown>
  search?: string
}): Promise<SelectOption[]> {
  const res = await apiService.get<PagedResponse<EntryItem>>({
    url: args.url,
    params: { ...args.params, search: args.search, page: 0, size: 20 },
  })
  const items = res.data.items ?? []
  return items.map((item) => ({
    id: item.id,
    code: String(item.id),
    // A6: presentation обязателен — фронт не собирает подпись из полей.
    label: item.presentation ?? '',
  }))
}

interface ListRow {
  id: number
  [key: string]: unknown
  attributes?: Record<string, unknown>
}

export async function fetchListPage(args: {
  url: string
  params?: Record<string, string>
  page: number
  size: number
  search?: string
  signal?: AbortSignal
}): Promise<PagedResponse<ListRow>> {
  const res = await apiService.get<PagedResponse<ListRow>>({
    url: args.url,
    params: {
      ...args.params,
      page: args.page,
      size: args.size,
      ...(args.search?.trim() && { search: args.search.trim() }),
    },
    signal: args.signal,
  })
  return res.data
}
```

- [ ] **Step 2: list-node.tsx — новый формат страницы**

Заменить `getNextPageParam` и `rows` (строки 81–92):

```ts
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data
      return paged.last ? undefined : paged.number + 1
    },
    enabled: !!source,
    staleTime: 60 * 1000,
  })

  const rows = useMemo(
    () => pagedData?.pages.flatMap((page) => page.data.content) ?? [],
    [pagedData],
  )
```

на:

```ts
    getNextPageParam: (lastPage) =>
      (lastPage.page + 1) * lastPage.size >= lastPage.total
        ? undefined
        : lastPage.page + 1,
    enabled: !!source,
    staleTime: 60 * 1000,
  })

  const rows = useMemo(
    () => pagedData?.pages.flatMap((page) => page.items) ?? [],
    [pagedData],
  )
```

- [ ] **Step 3: Прогнать тесты и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/api/reference-options.ts src/features/sdui/ui/nodes/composite/list-node.tsx
git commit -m "refactor: единый формат пагинации items/total/page/size (handoff A5)"
```

### Task 9: list-node — только presentation, без каскада (A6)

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx:144-153`

**Interfaces:**
- Контракт бэка: каждый объект-значение в строках списков несёт готовую строку `presentation` (handoff A6).

- [ ] **Step 1: Убрать каскад**

В `src/features/sdui/ui/nodes/composite/list-node.tsx` заменить `accessorFn` (строки 144–153):

```ts
        accessorFn: (row: ListRow) => {
          const binding = (col.props?.attributeCode ?? col.props?.binding) as string
          if (!binding) return ''
          const val = resolveBinding(row, binding)
          if (val && typeof val === 'object') {
            const obj = val as Record<string, unknown>
            return (obj.presentation ?? obj.displayName ?? obj.nameRu ?? obj.name ?? String(obj.id ?? '')) as string
          }
          return val
        },
```

на:

```ts
        accessorFn: (row: ListRow) => {
          const binding = (col.props?.attributeCode ?? col.props?.binding) as string
          if (!binding) return ''
          const val = resolveBinding(row, binding)
          if (val && typeof val === 'object') {
            // A6: подпись объекта — только готовая presentation от бэка.
            return ((val as Record<string, unknown>).presentation as string | undefined) ?? ''
          }
          return val
        },
```

- [ ] **Step 2: Прогнать тесты и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/ui/nodes/composite/list-node.tsx
git commit -m "refactor: только presentation для объектов в списках, каскад удалён (handoff A6)"
```

### Task 10: Запрещающие дефолты (A7)

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx:68`
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx:36-38`
- Modify: `src/features/sdui/lib/dispatch.ts:46-52`

**Interfaces:**
- Контракт бэка: `editable`, `allowAdd`, `allowDelete`, `allowReorder` проставлены явно на всех таблицах всех layout; `presentation` проставлен на всех openDialog-effects (handoff A7). **Релиз строго синхронный** — без бэковой части все таблицы станут read-only без кнопок.

- [ ] **Step 1: table-node.tsx**

Заменить строку 68:

```ts
  const editable = (node.props?.editable as boolean | undefined) ?? true
```

на:

```ts
  // A7: запрещающий дефолт — отсутствие пропа означает read-only.
  const editable = (node.props?.editable as boolean | undefined) ?? false
```

- [ ] **Step 2: editable-table.tsx**

Заменить строки 36–38:

```ts
  const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? true
  const allowDelete = (node.props?.allowDelete as boolean | undefined) ?? true
  const allowReorder = (node.props?.allowReorder as boolean | undefined) ?? true
```

на:

```ts
  // A7: запрещающие дефолты — права на изменение выдаёт только бэк явно.
  const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? false
  const allowDelete = (node.props?.allowDelete as boolean | undefined) ?? false
  const allowReorder = (node.props?.allowReorder as boolean | undefined) ?? false
```

- [ ] **Step 3: dispatch.ts — presentation обязателен**

Заменить в `openDialog`-колбэке (строки 46–48):

```ts
        openDialog: (effect) => {
          const presentation =
            (effect.node?.props?.presentation as string) ?? 'modal'
```

на:

```ts
        openDialog: (effect) => {
          const presentationProp = effect.node?.props?.presentation as
            | string
            | undefined
          if (!presentationProp) {
            // A7: presentation обязателен; modal — аварийный рендер, не дефолт.
            console.warn('SDUI: effect openDialog без props.presentation (handoff A7)')
          }
          const presentation = presentationProp ?? 'modal'
```

- [ ] **Step 4: Прогнать все тесты sdui и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/editable-table.tsx src/features/sdui/lib/dispatch.ts
git commit -m "refactor: запрещающие дефолты для editable/allowAdd/allowDelete/allowReorder/presentation (handoff A7)"
```

---

## Порядок выполнения и зависимости

| Задача | Зависит от | Деплой-гейт (бэк) |
|--------|-----------|-------------------|
| 1 (i18n) | — | нет |
| 2 (icon fallback) | — | нет |
| 3 (метаданные действий) | — | A1 |
| 4 (dirtyCloseAction) | 3 | A1 |
| 5 (ReadOnlyTable actions) | — | A2 |
| 6 (selectionScope) | 3 | A2 + A3 |
| 7 (optionsSource/domain) | — | A4 + A7 |
| 8 (пагинация) | — | A5 |
| 9 (presentation) | — | A6 |
| 10 (дефолты) | — | A7 |

Финальная проверка после всех задач (по запросу пользователя): `npm run build`.
