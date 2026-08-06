# SCRUM-289 фаза 1: server-driven сайдбар — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать левое меню приложения server-driven — пункты, порядок, метки, иконки и маршруты приходят от бэка деревом `APP_SHELL`, с фолбэком на легаси-сайдбар при недоступном бэке.

**Architecture:** Persistent-хост `ShellSidebarHost` монтируется в `Layout` вместо `<Sidebar/>`, делает OPEN `layoutCode:"APP_SHELL"` через React Query (изолированно от route-driven tree-store), выдёргивает поддерево `SIDEBAR` и рендерит его через `NodeRenderer` → заполненный `SidebarNode`. `SidebarNode` сам рендерит свои `LINK`-дети как пункты меню (не через generic `LinkNode` — разрешение коллизии типа `LINK`). При ошибке/загрузке хост отдаёт фолбэк-легаси-сайдбар, провод которого собран в `App.tsx`.

**Tech Stack:** React 19, TypeScript, TanStack Query, react-router-dom, react-i18next, TailwindCSS (`cn`), Vitest + @testing-library/react.

## Global Constraints

- Дизайн-первоисточник: `docs/superpowers/specs/2026-08-06-scrum-289-shell-sidebar-design.md`.
- Правила изоляции SDUI↔легаси (CLAUDE.md): SDUI **не** импортирует легаси; фолбэк-легаси-сайдбар подаётся в `ShellSidebarHost` **пропом** из `App.tsx` (композиционный корень).
- Barrel-экспорты только на уровне слайса (`src/features/sdui/index.ts`); внутри сегмента — прямые импорты.
- Тексты — через `useTranslation`/`common.json`, не хардкодить (метки пунктов приходят от бэка как `props.label` — это данные, не UI-строки).
- Без `useMemo`/`useCallback` без явной причины производительности.
- Не запускать `tsc`/`lint`/`build` после каждого шага — только по явной просьбе. Тесты — `npx vitest run <путь>`.
- Файл >300 строк обязан быть разбит; цель ~200.
- `/api/settings/modules` НЕ удалять (нужен `entities/module/use-resolve-type-page-code`).
- Не трогать `button-icons.tsx`/`icon-node.tsx`, `AppShellNode`/`TopBarNode`/`WorkspaceNode`, роуты, `resolve-page-type.ts`.

## File Structure

- Create `src/features/sdui/lib/shell/icon-resolver.tsx` — `resolveShellIcon(name)` имя→SVG + fallback.
- Create `src/features/sdui/ui/nodes/shell/sidebar-link-item.tsx` — пункт меню (иконка+label, активность, navigate).
- Modify `src/features/sdui/ui/nodes/shell/sidebar-node.tsx` — наполнение заглушки: хром + маппинг LINK-детей.
- Create `src/features/sdui/api/fetch-app-shell.ts` — `fetchAppShellTree()` OPEN APP_SHELL + `findSidebarNode()`.
- Create `src/features/sdui/lib/shell/use-app-shell-sidebar.ts` — `useAppShellSidebar()` (React Query, ключ по языку).
- Create `src/features/sdui/ui/shell-sidebar-host.tsx` — хост: данные→NodeRenderer / loading|error→fallback.
- Modify `src/features/sdui/index.ts` — экспорт `ShellSidebarHost`.
- Modify `src/app/App.tsx` — `<Sidebar/>` → `<ShellSidebarHost fallback={<Sidebar/>} />`.

Тесты — рядом с каждым файлом (`*.test.tsx`).

---

### Task 1: Резолвер иконки сайдбара

**Files:**

- Create: `src/features/sdui/lib/shell/icon-resolver.tsx`
- Test: `src/features/sdui/lib/shell/icon-resolver.test.tsx`

**Interfaces:**

- Produces: `resolveShellIcon(name?: string): FC<SVGProps<SVGSVGElement>>` — известное имя → соответствующий SVG-компонент; неизвестное/undefined → fallback (`main.svg`).

Имена от бэка (backend-answers §Иконки): `home, bank, warehouse, actives, salary, admin, reports`. Ассеты в `src/shared/assets/navigation/`.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/lib/shell/icon-resolver.test.tsx
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/shared/assets/navigation/main.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/navigation/bank.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/navigation/warehouse.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/actives.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/salary.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/report.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/regulated-fin-report.svg', () => ({
  default: () => null,
}))

import { resolveShellIcon } from './icon-resolver'
import MainIcon from '@/shared/assets/navigation/main.svg'
import BankIcon from '@/shared/assets/navigation/bank.svg'

describe('resolveShellIcon', () => {
  it('известное имя → соответствующий ассет', () => {
    expect(resolveShellIcon('bank')).toBe(BankIcon)
  })

  it('home → main.svg', () => {
    expect(resolveShellIcon('home')).toBe(MainIcon)
  })

  it('неизвестное имя → fallback (main.svg)', () => {
    expect(resolveShellIcon('does-not-exist')).toBe(MainIcon)
  })

  it('undefined → fallback (main.svg)', () => {
    expect(resolveShellIcon(undefined)).toBe(MainIcon)
  })
})
```

- [ ] **Step 2: Запустить — тест падает**

Run: `npx vitest run src/features/sdui/lib/shell/icon-resolver.test.tsx`
Expected: FAIL — `Cannot find module './icon-resolver'`.

- [ ] **Step 3: Реализация**

```tsx
// src/features/sdui/lib/shell/icon-resolver.tsx
import type { FC, SVGProps } from 'react'

import MainIcon from '@/shared/assets/navigation/main.svg'
import BankIcon from '@/shared/assets/navigation/bank.svg'
import WarehouseIcon from '@/shared/assets/navigation/warehouse.svg'
import ActivesIcon from '@/shared/assets/navigation/actives.svg'
import SalaryIcon from '@/shared/assets/navigation/salary.svg'
import ReportIcon from '@/shared/assets/navigation/report.svg'
import RegulatedFinReportIcon from '@/shared/assets/navigation/regulated-fin-report.svg'

type IconComponent = FC<SVGProps<SVGSVGElement>>

// Имена — из реестра бэка (SduiIconNames): home + модульные. Ассеты остаются
// на фронте; бэк шлёт имя строкой (backend-answers-SCRUM-289-shell.md §Иконки).
const SHELL_ICONS: Record<string, IconComponent> = {
  home: MainIcon,
  bank: BankIcon,
  warehouse: WarehouseIcon,
  actives: ActivesIcon,
  salary: SalaryIcon,
  reports: ReportIcon,
  admin: RegulatedFinReportIcon,
}

const FALLBACK_ICON: IconComponent = MainIcon

export function resolveShellIcon(name?: string): IconComponent {
  if (!name) return FALLBACK_ICON
  return SHELL_ICONS[name] ?? FALLBACK_ICON
}
```

- [ ] **Step 4: Запустить — тест проходит**

Run: `npx vitest run src/features/sdui/lib/shell/icon-resolver.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/shell/icon-resolver.tsx src/features/sdui/lib/shell/icon-resolver.test.tsx
git commit -m "feat: резолвер иконки сайдбара имя→SVG (SCRUM-289)"
```

---

### Task 2: Пункт меню `SidebarLinkItem`

**Files:**

- Create: `src/features/sdui/ui/nodes/shell/sidebar-link-item.tsx`
- Test: `src/features/sdui/ui/nodes/shell/sidebar-link-item.test.tsx`

**Interfaces:**

- Consumes: `resolveShellIcon` (Task 1).
- Produces: `SidebarLinkItem: FC<{ node: ViewNode; collapsed: boolean }>` — читает `node.props.label/icon/route`; активность — `route` vs `location.pathname` (`/` точно, иначе `startsWith`); клик → `navigate(route)`.

Стиль — портирован из `src/widgets/sidebar/ui/sidebar.tsx` (тот же вид пункта).

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/ui/nodes/shell/sidebar-link-item.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/shell/icon-resolver', () => ({
  resolveShellIcon: () => () => null,
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import type { ViewNode } from '../../../types/view'
import { SidebarLinkItem } from './sidebar-link-item'

const link = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'l1', type: 'LINK', props }) as ViewNode

describe('SidebarLinkItem', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('рендерит label и по клику навигирует на route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarLinkItem
          node={link({
            label: 'Банк и касса',
            icon: 'bank',
            route: '/modules/Bank',
          })}
          collapsed={false}
        />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /Банк и касса/ }))
    expect(navigate).toHaveBeenCalledWith('/modules/Bank')
  })

  it('активен, когда pathname совпадает с route (startsWith для не-корня)', () => {
    render(
      <MemoryRouter initialEntries={['/modules/Bank/document/X']}>
        <SidebarLinkItem
          node={link({
            label: 'Банк и касса',
            icon: 'bank',
            route: '/modules/Bank',
          })}
          collapsed={false}
        />
      </MemoryRouter>
    )
    expect(
      screen
        .getByRole('button', { name: /Банк и касса/ })
        .getAttribute('aria-current')
    ).toBe('page')
  })

  it('корневой route "/" активен только при точном совпадении', () => {
    render(
      <MemoryRouter initialEntries={['/modules/Bank']}>
        <SidebarLinkItem
          node={link({ label: 'Главная', icon: 'home', route: '/' })}
          collapsed={false}
        />
      </MemoryRouter>
    )
    expect(
      screen
        .getByRole('button', { name: /Главная/ })
        .getAttribute('aria-current')
    ).toBeNull()
  })

  it('свёрнутый режим прячет label (иконка остаётся)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarLinkItem
          node={link({
            label: 'Банк и касса',
            icon: 'bank',
            route: '/modules/Bank',
          })}
          collapsed={true}
        />
      </MemoryRouter>
    )
    expect(screen.queryByText('Банк и касса')).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/shell/sidebar-link-item.test.tsx`
Expected: FAIL — `Cannot find module './sidebar-link-item'`.

- [ ] **Step 3: Реализация**

```tsx
// src/features/sdui/ui/nodes/shell/sidebar-link-item.tsx
import type { FC } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import type { ViewNode } from '../../../types/view'
import { resolveShellIcon } from '../../../lib/shell/icon-resolver'

const buttonStyles = (isActive: boolean, isCollapsed: boolean) =>
  cn(
    'flex w-full max-h-14 items-center gap-3 rounded-lg py-2 text-left text-base text-ui-01 transition-colors',
    isCollapsed ? 'justify-center px-2' : 'justify-start pl-4',
    isActive && 'bg-ui-01 text-ui-06',
    !isActive && 'cursor-pointer hover:bg-ui-01/10'
  )

const iconWrapStyles = (isActive: boolean) =>
  cn(
    'flex justify-center min-w-10 min-h-10 rounded-lg items-center',
    isActive ? 'bg-accent-01' : 'bg-ui-06'
  )

const iconStyles = (isActive: boolean) =>
  cn('w-6 h-6 shrink-0', isActive ? 'text-ui-06' : 'text-ui-01')

interface SidebarLinkItemProps {
  node: ViewNode
  collapsed: boolean
}

export const SidebarLinkItem: FC<SidebarLinkItemProps> = ({
  node,
  collapsed,
}) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const label = (node.props?.label as string | undefined) ?? ''
  const route = (node.props?.route as string | undefined) ?? '/'
  const iconName = node.props?.icon as string | undefined
  const Icon = resolveShellIcon(iconName)

  const isActive = route === '/' ? pathname === '/' : pathname.startsWith(route)

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(route)
      }}
      aria-current={isActive ? 'page' : undefined}
      className={buttonStyles(isActive, collapsed)}
    >
      <div className={iconWrapStyles(isActive)}>
        <Icon className={iconStyles(isActive)} />
      </div>
      {!collapsed && <Typography variant="body2">{label}</Typography>}
    </button>
  )
}
```

- [ ] **Step 4: Запустить — тест проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/shell/sidebar-link-item.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/shell/sidebar-link-item.tsx src/features/sdui/ui/nodes/shell/sidebar-link-item.test.tsx
git commit -m "feat: SidebarLinkItem — пункт server-driven меню (SCRUM-289)"
```

---

### Task 3: Наполнение `SidebarNode`

**Files:**

- Modify: `src/features/sdui/ui/nodes/shell/sidebar-node.tsx` (заменить заглушку целиком)
- Test: `src/features/sdui/ui/nodes/shell/sidebar-node.test.tsx`

**Interfaces:**

- Consumes: `SidebarLinkItem` (Task 2), `getStorageItem`/`setStorageItem` из `@/shared/lib/utils/local-storage`.
- Produces: `SidebarNode: FC<NodeProps>` — хром (лого, `sidebar.appName` через i18n, кнопка сворачивания) + маппинг `node.children` (LINK-узлы) в `SidebarLinkItem`. Свёрнутость: старт из localStorage (`sidebar-settings.isCollapsed`), иначе `node.props.collapsed`; тоггл пишет в localStorage.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/ui/nodes/shell/sidebar-node.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/assets/logo.svg', () => ({ default: () => null }))
vi.mock('../../../lib/shell/icon-resolver', () => ({
  resolveShellIcon: () => () => null,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import type { ViewNode } from '../../../types/view'
import { SidebarNode } from './sidebar-node'

const sidebar = (
  props: Record<string, unknown>,
  children: ViewNode[]
): ViewNode => ({ id: 's', type: 'SIDEBAR', props, children }) as ViewNode

const link = (id: string, label: string, route: string): ViewNode =>
  ({ id, type: 'LINK', props: { label, icon: 'home', route } }) as ViewNode

const tree = sidebar({ collapsed: false }, [
  link('n1', 'Главная', '/'),
  link('n2', 'Банк и касса', '/modules/Bank'),
])

describe('SidebarNode', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('рендерит по пункту на каждый LINK-ребёнок', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNode node={tree} />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /Главная/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Банк и касса/ })).toBeTruthy()
  })

  it('кнопка сворачивания прячет метки пунктов и пишет localStorage', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNode node={tree} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByLabelText('sidebar.toggleCollapse'))
    expect(screen.queryByText('Банк и касса')).toBeNull()
    expect(
      JSON.parse(localStorage.getItem('sidebar-settings')!).isCollapsed
    ).toBe(true)
  })

  it('стартовая свёрнутость берётся из localStorage поверх props.collapsed', () => {
    localStorage.setItem(
      'sidebar-settings',
      JSON.stringify({ isCollapsed: true })
    )
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNode node={tree} />
      </MemoryRouter>
    )
    expect(screen.queryByText('Главная')).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/shell/sidebar-node.test.tsx`
Expected: FAIL — старая заглушка не рендерит пункты/кнопку (`Unable to find ... Главная`).

- [ ] **Step 3: Реализация (заменить файл целиком)**

```tsx
// src/features/sdui/ui/nodes/shell/sidebar-node.tsx
import { useState, type FC } from 'react'
import { IconButton, Typography } from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

import Logo from '@/shared/assets/logo.svg'
import { cn } from '@/shared/lib/utils/cn'
import {
  getStorageItem,
  setStorageItem,
} from '@/shared/lib/utils/local-storage'

import type { NodeProps } from '../../../types/view'
import { SidebarLinkItem } from './sidebar-link-item'

const STORAGE_KEY = 'sidebar-settings'

export const SidebarNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const initial = (node.props?.collapsed as boolean | undefined) ?? false
    return getStorageItem<{ isCollapsed: boolean }>(STORAGE_KEY, {
      isCollapsed: initial,
    }).isCollapsed
  })

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      setStorageItem(STORAGE_KEY, { isCollapsed: next })
      return next
    })
  }

  const links = node.children ?? []

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col py-10 transition-all duration-300',
        collapsed ? 'w-20 px-2' : 'w-103 pl-15 pr-5'
      )}
    >
      <div
        className={cn(
          'mb-15 flex items-center',
          collapsed ? 'justify-center' : 'gap-5 pl-5'
        )}
      >
        <Logo className="h-10 w-10 shrink-0" />
        {!collapsed && (
          <Typography variant="h6" className="text-ui-01">
            {t('sidebar.appName')}
          </Typography>
        )}
      </div>
      <nav>
        <ul className="flex flex-col">
          {links.map((child) => (
            <li key={child.id}>
              <SidebarLinkItem node={child} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>
      <div
        className={cn(
          'mt-auto flex',
          collapsed ? 'justify-center' : 'justify-end pr-2'
        )}
      >
        <IconButton
          onClick={toggle}
          size="small"
          aria-label={t('sidebar.toggleCollapse')}
        >
          {collapsed ? (
            <ChevronRight className="text-ui-01" />
          ) : (
            <ChevronLeft className="text-ui-01" />
          )}
        </IconButton>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Добавить i18n-ключ `sidebar.toggleCollapse`**

В `src/app/config/i18n/locales/ru/common.json` в блоке `"sidebar"` добавить `"toggleCollapse": "Свернуть меню"`.
В `src/app/config/i18n/locales/kz/common.json` в блоке `"sidebar"` добавить `"toggleCollapse": "Мәзірді жию"`.

- [ ] **Step 5: Запустить — тест проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/shell/sidebar-node.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/ui/nodes/shell/sidebar-node.tsx src/features/sdui/ui/nodes/shell/sidebar-node.test.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: SidebarNode рендерит server-driven меню + свёрнутость (SCRUM-289)"
```

---

### Task 4: Загрузка дерева `APP_SHELL` + хук

**Files:**

- Create: `src/features/sdui/api/fetch-app-shell.ts`
- Create: `src/features/sdui/lib/shell/use-app-shell-sidebar.ts`
- Test: `src/features/sdui/lib/shell/use-app-shell-sidebar.test.tsx`

**Interfaces:**

- Consumes: `viewTransport.post` (`../api/view-transport`), типы `ViewNode`/`ViewRequest` (`../types/view`).
- Produces:
  - `fetchAppShellTree(): Promise<ViewNode | null>` — OPEN `layoutCode:"APP_SHELL"`, возвращает `res.tree ?? null`.
  - `findSidebarNode(root: ViewNode | null): ViewNode | null` — DFS-поиск узла `type:"SIDEBAR"`.
  - `useAppShellSidebar(): { sidebarNode: ViewNode | null; isPending: boolean; isError: boolean }` — React Query, ключ `['app-shell', language]`.

- [ ] **Step 1: Написать падающий тест хука**

```tsx
// src/features/sdui/lib/shell/use-app-shell-sidebar.test.tsx
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'ru' } }),
}))

import * as api from '../../api/fetch-app-shell'
import { useAppShellSidebar } from './use-app-shell-sidebar'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const shellTree = {
  id: 'shell',
  type: 'APP_SHELL',
  children: [
    { id: 'tb', type: 'TOP_BAR' },
    {
      id: 'sb',
      type: 'SIDEBAR',
      props: { collapsed: false },
      children: [
        { id: 'n1', type: 'LINK', props: { label: 'Главная', route: '/' } },
      ],
    },
    { id: 'ws', type: 'WORKSPACE' },
  ],
}

describe('useAppShellSidebar', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('возвращает поддерево SIDEBAR из дерева APP_SHELL', async () => {
    vi.spyOn(api, 'fetchAppShellTree').mockResolvedValue(shellTree as never)
    const { result } = renderHook(() => useAppShellSidebar(), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.sidebarNode?.id).toBe('sb')
    expect(result.current.isError).toBe(false)
  })

  it('ошибка запроса → isError, sidebarNode = null', async () => {
    vi.spyOn(api, 'fetchAppShellTree').mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useAppShellSidebar(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.sidebarNode).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — тест падает**

Run: `npx vitest run src/features/sdui/lib/shell/use-app-shell-sidebar.test.tsx`
Expected: FAIL — модули `../../api/fetch-app-shell` / `./use-app-shell-sidebar` не найдены.

- [ ] **Step 3: Реализация — api**

```ts
// src/features/sdui/api/fetch-app-shell.ts
import type { ViewNode } from '../types/view'
import { viewTransport } from './view-transport'

// OPEN оболочки: layoutCode:"APP_SHELL" (route-независимо; после мёржа задачи 8
// бэк принимает явный layoutCode — backend-answers-SCRUM-289-shell.md §1).
// viewTransport сам добавляет language из i18n.
export async function fetchAppShellTree(): Promise<ViewNode | null> {
  const res = await viewTransport.post({
    formSessionId: null,
    revision: null,
    layoutCode: 'APP_SHELL',
    action: { type: 'OPEN', layoutCode: 'APP_SHELL' },
  })
  return res.tree ?? null
}

// DFS-поиск узла SIDEBAR в дереве APP_SHELL.
export function findSidebarNode(root: ViewNode | null): ViewNode | null {
  if (!root) return null
  if (root.type === 'SIDEBAR') return root
  for (const child of root.children ?? []) {
    const found = findSidebarNode(child)
    if (found) return found
  }
  return null
}
```

- [ ] **Step 4: Реализация — хук**

```ts
// src/features/sdui/lib/shell/use-app-shell-sidebar.ts
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { ViewNode } from '../../types/view'
import { fetchAppShellTree, findSidebarNode } from '../../api/fetch-app-shell'

interface AppShellSidebar {
  sidebarNode: ViewNode | null
  isPending: boolean
  isError: boolean
}

export function useAppShellSidebar(): AppShellSidebar {
  const { i18n } = useTranslation()

  // Ключ включает язык: метки RU/KZ фиксируются на OPEN, смена языка → ре-фетч.
  // Меню статично в рамках сессии/языка (новый модуль = релиз бэка) → staleTime Infinity.
  const query = useQuery({
    queryKey: ['app-shell', i18n.language],
    queryFn: fetchAppShellTree,
    staleTime: Infinity,
    retry: false,
  })

  return {
    sidebarNode: findSidebarNode(query.data ?? null),
    isPending: query.isPending,
    isError: query.isError,
  }
}
```

- [ ] **Step 5: Запустить — тест проходит**

Run: `npx vitest run src/features/sdui/lib/shell/use-app-shell-sidebar.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/api/fetch-app-shell.ts src/features/sdui/lib/shell/use-app-shell-sidebar.ts src/features/sdui/lib/shell/use-app-shell-sidebar.test.tsx
git commit -m "feat: загрузка APP_SHELL + выборка SIDEBAR-поддерева (SCRUM-289)"
```

---

### Task 5: Хост `ShellSidebarHost` + экспорт слайса

**Files:**

- Create: `src/features/sdui/ui/shell-sidebar-host.tsx`
- Modify: `src/features/sdui/index.ts` (добавить экспорт)
- Test: `src/features/sdui/ui/shell-sidebar-host.test.tsx`

**Interfaces:**

- Consumes: `useAppShellSidebar` (Task 4), `NodeRenderer` (`./node-renderer`).
- Produces: `ShellSidebarHost: FC<{ fallback: ReactNode }>` — данные есть → `<NodeRenderer node={sidebarNode} />`; `isPending`/`isError`/нет узла → `fallback`.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/sdui/ui/shell-sidebar-host.test.tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useAppShellSidebar = vi.fn()
vi.mock('../lib/shell/use-app-shell-sidebar', () => ({
  useAppShellSidebar: () => useAppShellSidebar(),
}))
vi.mock('./node-renderer', () => ({
  NodeRenderer: ({ node }: { node: { id: string } }) => (
    <div data-testid="node-renderer">{node.id}</div>
  ),
}))

import { ShellSidebarHost } from './shell-sidebar-host'

const fallback = <div data-testid="legacy-fallback">legacy</div>

describe('ShellSidebarHost', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('данные есть → рендерит NodeRenderer с SIDEBAR-узлом', () => {
    useAppShellSidebar.mockReturnValue({
      sidebarNode: { id: 'sb', type: 'SIDEBAR' },
      isPending: false,
      isError: false,
    })
    render(<ShellSidebarHost fallback={fallback} />)
    expect(screen.getByTestId('node-renderer').textContent).toBe('sb')
    expect(screen.queryByTestId('legacy-fallback')).toBeNull()
  })

  it('загрузка → фолбэк', () => {
    useAppShellSidebar.mockReturnValue({
      sidebarNode: null,
      isPending: true,
      isError: false,
    })
    render(<ShellSidebarHost fallback={fallback} />)
    expect(screen.getByTestId('legacy-fallback')).toBeTruthy()
  })

  it('ошибка → фолбэк', () => {
    useAppShellSidebar.mockReturnValue({
      sidebarNode: null,
      isPending: false,
      isError: true,
    })
    render(<ShellSidebarHost fallback={fallback} />)
    expect(screen.getByTestId('legacy-fallback')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Запустить — тест падает**

Run: `npx vitest run src/features/sdui/ui/shell-sidebar-host.test.tsx`
Expected: FAIL — `Cannot find module './shell-sidebar-host'`.

- [ ] **Step 3: Реализация**

```tsx
// src/features/sdui/ui/shell-sidebar-host.tsx
import type { FC, ReactNode } from 'react'

import { useAppShellSidebar } from '../lib/shell/use-app-shell-sidebar'
import { NodeRenderer } from './node-renderer'

interface ShellSidebarHostProps {
  // Легаси-сайдбар подаётся пропом из app/ (изоляция SDUI↔легаси): показывается,
  // пока бэк APP_SHELL недоступен/грузится — регресса нет до выкатки (дизайн §4).
  fallback: ReactNode
}

export const ShellSidebarHost: FC<ShellSidebarHostProps> = ({ fallback }) => {
  const { sidebarNode, isPending, isError } = useAppShellSidebar()

  if (isPending || isError || !sidebarNode) return <>{fallback}</>
  return <NodeRenderer node={sidebarNode} />
}
```

- [ ] **Step 4: Экспорт из барреля слайса**

Добавить в `src/features/sdui/index.ts`:

```ts
export { ShellSidebarHost } from './ui/shell-sidebar-host'
```

- [ ] **Step 5: Запустить — тест проходит**

Run: `npx vitest run src/features/sdui/ui/shell-sidebar-host.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/ui/shell-sidebar-host.tsx src/features/sdui/ui/shell-sidebar-host.test.tsx src/features/sdui/index.ts
git commit -m "feat: ShellSidebarHost — OPEN APP_SHELL с фолбэком на легаси (SCRUM-289)"
```

---

### Task 6: Провод в `App.tsx`

**Files:**

- Modify: `src/app/App.tsx`

**Interfaces:**

- Consumes: `ShellSidebarHost` (Task 5, из `@/features/sdui`), легаси `Sidebar` (из `@/widgets/sidebar`, уже импортирован).

Замена статичного `<Sidebar/>` на `<ShellSidebarHost fallback={<Sidebar/>} />`. Легаси-сайдбар остаётся как фолбэк на время перехода (удаляется отдельным коммитом после прод-верификации — дизайн §4).

- [ ] **Step 1: Добавить импорт**

В блоке импортов `@/features/sdui` в `src/app/App.tsx` добавить `ShellSidebarHost`:

```tsx
import {
  ShellSidebarHost,
  setReferencePickerGateway,
  setReportResultGateway,
} from '@/features/sdui'
```

- [ ] **Step 2: Заменить проп `sidebar` в `<Layout>`**

Было:

```tsx
      <Layout sidebar={<Sidebar />} header={<TopBar />}>
```

Стало:

```tsx
      <Layout sidebar={<ShellSidebarHost fallback={<Sidebar />} />} header={<TopBar />}>
```

- [ ] **Step 3: Прогнать сьют SDUI-нод оболочки + смоук App**

Run: `npx vitest run src/features/sdui/ui/nodes/shell src/features/sdui/ui/shell-sidebar-host.test.tsx src/features/sdui/lib/shell`
Expected: PASS (все тесты Tasks 1–5).

- [ ] **Step 4: Коммит**

```bash
git add src/app/App.tsx
git commit -m "feat: подключить server-driven сайдбар в Layout, легаси как фолбэк (SCRUM-289)"
```

---

## Финальная проверка (по явной просьбе / перед пушем)

- [ ] `npm run build` (tsc -b строже tsc --noEmit) — обязательно перед пушем.
- [ ] `npx vitest run` — весь сьют зелёный.
- [ ] Ручная проверка ПОСЛЕ выкатки бэка на среду (e2e — автор таски): на `/` меню строится из server-дерева; клик по пункту навигирует; смена языка меняет метки; при недоступном бэке — легаси-сайдбар (фолбэк).

## Self-review заметки (для исполнителя)

- **Коллизия `LINK`:** намеренно НЕ заводим новый `LinkNode` и НЕ трогаем `action/link-node.tsx` — пункты сайдбара рендерит `SidebarNode`→`SidebarLinkItem`. Отклонение от устаревшей спеки §3.1 зафиксировано в дизайн-доке.
- **Изоляция:** ни один файл под `src/features/sdui/` не импортирует легаси; фолбэк подаётся пропом из `App.tsx`.
- **Не в скоупе:** удаление `widgets/sidebar`/`use-sidebar`/`fetch-navigation-items`, `/api/settings/modules`, консолидация `button-icons`/`icon-node`, наполнение TOP_BAR/WORKSPACE — follow-up после прода / фаза 2 / задача 8-9.
