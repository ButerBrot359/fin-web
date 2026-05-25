# Sidebar Navigation API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести навигацию сайдбара с хардкода на фронте на API-endpoint бэкенда (`GET /api/settings/modules`).

**Architecture:** Фронт получает список модулей с бэка, маппит `iconCode` на SVG-компоненты через реестр `ICON_MAP`, элемент "Главная" остаётся захардкоженным. Поле `labelKey` (i18n ключ) заменяется на `label` (реальное название с бэка).

**Tech Stack:** React, TypeScript, TanStack Query, react-i18next, apiService (axios)

---

### Task 1: Обновить тип NavigationItem

**Files:**
- Modify: `src/widgets/sidebar/types/types.ts`

- [ ] **Step 1: Заменить интерфейс NavigationItem**

Убираем `labelKey`, `disabled`, делаем `path` обязательным. Добавляем `label`.

```typescript
import type { FC, SVGProps } from 'react'

export interface NavigationItem {
  id: string
  label: string
  icon: FC<SVGProps<SVGSVGElement>>
  path: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/widgets/sidebar/types/types.ts
git commit -m "refactor: update NavigationItem type — label instead of labelKey, remove disabled"
```

---

### Task 2: Создать ICON_MAP и MAIN_NAV_ITEM, удалить NAVIGATION_ITEMS

**Files:**
- Modify: `src/widgets/sidebar/lib/consts/navigation-items.ts`

- [ ] **Step 1: Заменить содержимое файла**

Удаляем массив `NAVIGATION_ITEMS`, создаём `ICON_MAP` и `MAIN_NAV_ITEM`.

```typescript
import type { FC, SVGProps } from 'react'

import MainIcon from '@/shared/assets/navigation/main.svg'
import BankIcon from '@/shared/assets/navigation/bank.svg'
import WarehouseIcon from '@/shared/assets/navigation/warehouse.svg'
import ActivesIcon from '@/shared/assets/navigation/actives.svg'
import TarifsIcon from '@/shared/assets/navigation/tarifs.svg'
import SalaryIcon from '@/shared/assets/navigation/salary.svg'
import ReportIcon from '@/shared/assets/navigation/report.svg'
import OurCompanyIcon from '@/shared/assets/navigation/our-company.svg'
import FlkIcon from '@/shared/assets/navigation/flk.svg'
import RegulatedFinReportIcon from '@/shared/assets/navigation/regulated-fin-report.svg'

import type { NavigationItem } from '../../types/types'

export const ICON_MAP: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  bank: BankIcon,
  warehouse: WarehouseIcon,
  actives: ActivesIcon,
  tariffs: TarifsIcon,
  salary: SalaryIcon,
  reports: ReportIcon,
  'our-company': OurCompanyIcon,
  flk: FlkIcon,
  'regulated-fin-report': RegulatedFinReportIcon,
  admin: RegulatedFinReportIcon,
}

export const FALLBACK_ICON = MainIcon

export const MAIN_NAV_ITEM: NavigationItem = {
  id: 'main',
  label: 'sidebar.nav.main',
  icon: MainIcon,
  path: '/',
}
```

Примечание: `MAIN_NAV_ITEM.label` остаётся i18n-ключом — это единственный элемент, который переводится на фронте. Sidebar-компонент будет обрабатывать его через `t()`.

- [ ] **Step 2: Commit**

```bash
git add src/widgets/sidebar/lib/consts/navigation-items.ts
git commit -m "refactor: replace NAVIGATION_ITEMS with ICON_MAP and MAIN_NAV_ITEM"
```

---

### Task 3: Реализовать API-вызов fetchNavigationItems

**Files:**
- Modify: `src/widgets/sidebar/api/fetch-navigation-items.ts`

- [ ] **Step 1: Добавить тип ModuleNavItem и реализовать API-вызов**

```typescript
import i18n from '@/app/config/i18n'
import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import { ICON_MAP, FALLBACK_ICON, MAIN_NAV_ITEM } from '../lib/consts/navigation-items'
import type { NavigationItem } from '../types/types'

interface ModuleNavItem {
  code: string
  nameRu: string
  nameKz: string
  iconCode: string
  sortOrder: number
}

export async function fetchNavigationItems(): Promise<NavigationItem[]> {
  const response = await apiService.get<ApiResponse<ModuleNavItem[]>>({
    url: '/api/settings/modules',
  })
  const modules = response.data.data.map((m): NavigationItem => ({
    id: m.code,
    label: i18n.language === 'kz' ? m.nameKz : m.nameRu,
    icon: ICON_MAP[m.iconCode] ?? FALLBACK_ICON,
    path: `/modules/${m.code}`,
  }))
  return [MAIN_NAV_ITEM, ...modules]
}
```

Импорт `i18n` — из `@/app/config/i18n` (экспортируется как `export default i18n`).

- [ ] **Step 2: Commit**

```bash
git add src/widgets/sidebar/api/fetch-navigation-items.ts
git commit -m "feat: fetch sidebar navigation items from backend API"
```

---

### Task 4: Обновить Sidebar-компонент — убрать disabled, использовать label

**Files:**
- Modify: `src/widgets/sidebar/ui/sidebar.tsx`

- [ ] **Step 1: Обновить sidebar.tsx**

Изменения:
1. Убрать `isDisabled` логику из рендера
2. Заменить `t(item.labelKey as never)` на `item.label` для модулей, но для "Главной" (которая имеет i18n-ключ) использовать `t()`
3. Упростить `getButtonStyles` — убрать `isDisabled`

```typescript
import { IconButton, Typography } from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

import Logo from '@/shared/assets/logo.svg'
import { cn } from '@/shared/lib/utils/cn'

import { useSidebar } from '../lib/hooks/use-sidebar'

const getButtonStyles = (isActive: boolean, isCollapsed: boolean) =>
  cn(
    'flex w-full max-h-14 items-center gap-3 rounded-lg py-2 text-left text-base text-ui-01 transition-colors',
    isCollapsed ? 'justify-center px-2' : 'justify-start pl-4',
    isActive && 'bg-ui-01 text-ui-06',
    !isActive && 'cursor-pointer hover:bg-ui-01/10'
  )

const getIconWrapStyles = (isActive: boolean) =>
  cn(
    'flex justify-center min-w-10 min-h-10 rounded-lg items-center',
    isActive ? 'bg-accent-01' : 'bg-ui-06'
  )

const getIconStyles = (isActive: boolean) =>
  cn('w-6 h-6 shrink-0', isActive ? 'text-ui-06' : 'text-ui-01')

export const Sidebar = () => {
  const { t } = useTranslation()
  const {
    navigationItems,
    activeItem,
    handleSelectItem,
    isCollapsed,
    toggleCollapsed,
  } = useSidebar()

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col py-10 transition-all duration-300',
        isCollapsed ? 'w-20 px-2' : 'w-103 pl-15 pr-5'
      )}
    >
      <div
        className={cn(
          'mb-15 flex items-center',
          isCollapsed ? 'justify-center' : 'gap-5 pl-5'
        )}
      >
        <Logo className="h-10 w-10 shrink-0" />
        {!isCollapsed && (
          <Typography variant="h6" className="text-ui-01">
            {t('sidebar.appName')}
          </Typography>
        )}
      </div>
      <nav>
        <ul className="flex flex-col">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem?.id === item.id

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    void handleSelectItem(item)
                  }}
                  className={getButtonStyles(isActive, isCollapsed)}
                >
                  <div className={getIconWrapStyles(isActive)}>
                    <Icon className={getIconStyles(isActive)} />
                  </div>
                  {!isCollapsed && (
                    <Typography variant="body2">
                      {item.id === 'main' ? t('sidebar.nav.main') : item.label}
                    </Typography>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div
        className={cn(
          'mt-auto flex',
          isCollapsed ? 'justify-center' : 'justify-end pr-2'
        )}
      >
        <IconButton onClick={toggleCollapsed} size="small">
          {isCollapsed ? (
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

- [ ] **Step 2: Commit**

```bash
git add src/widgets/sidebar/ui/sidebar.tsx
git commit -m "refactor: sidebar uses label from API, remove disabled state"
```

---

### Task 5: Обновить useSidebar — убрать проверку disabled

**Files:**
- Modify: `src/widgets/sidebar/lib/hooks/use-sidebar.ts`

- [ ] **Step 1: Упростить handleSelectItem и activeItem**

Убираем проверку `item.path` (теперь `path` всегда есть) и `disabled`.

```typescript
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  getStorageItem,
  setStorageItem,
} from '@/shared/lib/utils/local-storage'
import { fetchNavigationItems } from '../../api/fetch-navigation-items'
import type { NavigationItem } from '../../types/types'

interface SidebarSettings {
  isCollapsed: boolean
}

const STORAGE_KEY = 'sidebar-settings'

const DEFAULT_SETTINGS: SidebarSettings = {
  isCollapsed: false,
}

export function useSidebar() {
  const { i18n } = useTranslation()

  const { data: navigationItems = [] } = useQuery({
    queryKey: ['navigation-items', i18n.language],
    queryFn: fetchNavigationItems,
  })

  const [settings, setSettings] = useState<SidebarSettings>(() =>
    getStorageItem(STORAGE_KEY, DEFAULT_SETTINGS)
  )

  const updateSettings = useCallback((patch: Partial<SidebarSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      setStorageItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const toggleCollapsed = useCallback(() => {
    updateSettings({ isCollapsed: !settings.isCollapsed })
  }, [settings.isCollapsed, updateSettings])

  const navigate = useNavigate()
  const location = useLocation()

  const activeItem = useMemo(
    () =>
      navigationItems.find((item) => {
        if (item.path === '/') return location.pathname === '/'
        return location.pathname.startsWith(item.path)
      }) ?? null,
    [navigationItems, location.pathname]
  )

  const handleSelectItem = useCallback(
    async (item: NavigationItem) => {
      await navigate(item.path)
    },
    [navigate]
  )

  return {
    navigationItems,
    activeItem,
    handleSelectItem,
    isCollapsed: settings.isCollapsed,
    toggleCollapsed,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/widgets/sidebar/lib/hooks/use-sidebar.ts
git commit -m "refactor: simplify useSidebar — path is always present"
```

---

### Task 6: Обновить usePageTitle — использовать label вместо labelKey

**Files:**
- Modify: `src/pages/module/lib/hooks/use-page-title.ts`

- [ ] **Step 1: Обновить use-page-title.ts**

Убираем `useTranslation` — название уже приходит готовым в `label`.

```typescript
import { useQueryClient } from '@tanstack/react-query'

interface NavigationItem {
  id: string
  label: string
  path: string
}

export const usePageTitle = (path: string, fallback: string) => {
  const queryClient = useQueryClient()

  const navigationItems =
    queryClient.getQueryData<NavigationItem[]>(['navigation-items']) ?? []
  const navItem = navigationItems.find((item) => item.path === path)

  return navItem ? navItem.label : fallback
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/module/lib/hooks/use-page-title.ts
git commit -m "refactor: usePageTitle uses label directly instead of i18n key"
```

---

### Task 7: Удалить неиспользуемые i18n ключи

**Files:**
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`

- [ ] **Step 1: Обновить ru/common.json**

Удалить из блока `sidebar.nav` все ключи кроме `main`. Блок должен выглядеть:

```json
"sidebar": {
  "appName": "Web-бухгалтерия",
  "nav": {
    "main": "Главная"
  }
}
```

Удаляемые ключи: `bank`, `warehouse`, `actives`, `tariffs`, `salary`, `reports`, `ourCompany`, `flk`, `regulatedFinReport`, `formConfigs`, `administrirovanie`.

- [ ] **Step 2: Обновить kz/common.json**

Аналогично — оставить только `main` в `sidebar.nav`.

- [ ] **Step 3: Commit**

```bash
git add src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "cleanup: remove unused sidebar.nav i18n keys"
```

---

### Task 8: Проверить работоспособность

- [ ] **Step 1: Запустить dev-сервер**

```bash
npm run dev
```

- [ ] **Step 2: Проверить в браузере**

1. Открыть `http://localhost:5173`
2. Сайдбар должен показать "Главная" + модули, полученные от бэка
3. Если бэкенд ещё не реализован — сайдбар покажет только "Главная" (API вернёт ошибку, `useQuery` вернёт пустой массив)
4. Клик по модулю навигирует на `/modules/{code}`
5. Нет disabled-элементов

- [ ] **Step 3: Финальный коммит (если нужны правки)**

```bash
git add -A
git commit -m "feat: sidebar navigation loaded from backend API"
```
