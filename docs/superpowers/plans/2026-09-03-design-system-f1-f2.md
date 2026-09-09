# Дизайн-система Ф1+Ф2: токен-слой и скриншотная регрессия — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Единый токен-слой дизайна на CSS-переменных (Ф1, bit-perfect рефакторинг) и Playwright-скриншотная регрессия на замокированном `/api/view` (Ф2).

**Architecture:** `src/shared/design/tokens.ts` — единственный источник literal-значений; Tailwind-конфиг и MUI-тема читают `var(--…)`; `injectDesignTokens()` пишет `:root`-дефолты на старте. Скриншот-тесты поднимают `vite preview`, мокают всю сеть фикстурами и сравнивают с git-эталонами.

**Tech Stack:** Tailwind v4 (`@config` + ts-конфиг), MUI 7, Vite 7, vitest, `@playwright/test` (новая dev-зависимость).

**Spec:** `docs/superpowers/specs/2026-09-03-design-system-audit-design.md`

## Global Constraints

- Ветка: `feature/design-system`; коммит после каждой задачи; пуш ветки — свободно, мерж в dev только после зелёных Ф1-сверок (правило проекта: перед пушем в dev — полный `npx vitest run` и `npm run build`).
- **Ф1 bit-perfect:** ни один пиксель не меняется. Замена hex→токен допустима только при побайтно том же значении; «левые» цвета получают `pending`-токены с ТЕКУЩИМИ значениями (канонизация — Ф4 по итогам аудита).
- **Значения с провода не трогаем:** `textColor`/`background`/appearance из props SDUI-нод — данные бэка. Упоминания hex в КОММЕНТАРИЯХ кода — не хардкод, страж их игнорирует.
- Легаси-файлы участвуют в механической замене hex→токен (не редизайн), но никакой полировки легаси.
- Скриншот-эталоны рендерятся на macOS; порог `maxDiffPixelRatio: 0.001`; viewport 1440×900.
- Правила кода проекта: без `useMemo`/`useCallback` без причины, файлы ≤300 строк, тексты через i18n (в этом плане новых текстов UI нет).

## Mapping-таблица hex → токен (используется задачами 3–5)

Канонические (значение уже совпадает с Figma/палитрой — прямая замена):

| hex (lowercase)                    | токен             | CSS-переменная                                                                       |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `#ffffff`                          | `ui01`            | `--ui-01`                                                                            |
| `#f2f6fd`                          | `ui02`            | `--ui-02`                                                                            |
| `#c3cee0`                          | `ui03`            | `--ui-03`                                                                            |
| `#dbe7fd`                          | `ui04`            | `--ui-04`                                                                            |
| `#9fa9ba`                          | `ui05`            | `--ui-05`                                                                            |
| `#222124`                          | `ui06`            | `--ui-06`                                                                            |
| `#e0eafc`                          | `ui07`            | `--ui-07`                                                                            |
| `#c4d6f5`                          | `ui08`            | `--ui-08`                                                                            |
| `#daf449`                          | `accent01`        | `--accent-01`                                                                        |
| `#dafe10`                          | `accent01Hover`   | `--accent-01-hover`                                                                  |
| `#c0e10b`                          | `accent01Pressed` | `--accent-01-pressed`                                                                |
| `#2a75f4`                          | `accent02`        | `--accent-02`                                                                        |
| `#1f66db`                          | `accent02Hover`   | `--accent-02-hover` (новый осознанный: hover синей кнопки, сейчас в calendar-layout) |
| `#f4482a`                          | `support01`       | `--support-01`                                                                       |
| rgba(42,117,244,.4) в `0 3px 24px` | `shadowPopup`     | `--shadow-popup`                                                                     |

`pending`-токены (значение НЕ каноническое; фиксируем как есть, судьба — чек-лист аудита Ф3):

| hex                               | токен                | где встречается (ориентир)                                                                |
| --------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `#d9d9d9`                         | `pendingGray1`       | report-result-view, support-call                                                          |
| `#dcdcdc`                         | `pendingGray2`       | report-result-view                                                                        |
| `#e5e7eb`                         | `pendingGray3`       | support-call, report-page                                                                 |
| `#e6e9ee`                         | `pendingGray4`       | select-operation-dialog                                                                   |
| `#eceff4`                         | `pendingGray5`       | calendar-layout (borderRight)                                                             |
| `#808080`                         | `pendingGray6`       | report-result-view                                                                        |
| `#e9f0fc`                         | `pendingBlueBg`      | report-page                                                                               |
| `#f0a000`                         | `pendingWarnBorder`  | unknown-node (дев-плашка)                                                                 |
| `#fff8e1`                         | `pendingWarnBg`      | unknown-node                                                                              |
| `#fffbe6`                         | `pendingWarnBg2`     | report-page                                                                               |
| `#fcd53b` / `#f6c827` / `#e3b93c` | `pendingYellow1/2/3` | login/report иконки-акценты                                                               |
| `#d32f2f`                         | `pendingWeekendRed`  | tabel-matrix-cell (fallback var), rows weekendSx rgba(211,47,47,.06) → `pendingWeekendBg` |

НЕ трогаем (не хардкод): `#b22222`, `#0000ff`, `#ccffcc` — встречаются только в комментариях про значения с провода.

---

### Task 1: Канон токенов `tokens.ts` + инъекция `:root`

**Files:**

- Create: `src/shared/design/tokens.ts`
- Create: `src/shared/design/inject-design-tokens.ts`
- Test: `src/shared/design/tokens.test.ts`
- Modify: `src/app/main.tsx` (вызов инъекции до render)

**Interfaces:**

- Produces: `interface DesignToken { cssVar: string; value: string }`;
  экспорты `palette` (все строки mapping-таблицы, канонические и pending),
  `typography` (`h2/h3/body1/body2/caption`: `{ size, weight }` + `fontFamily`),
  `radii = { sm: 4, md: 8, lg: 12 }`, `spacing = [4, 8, 12, 16, 20, 24, 32]`,
  `shadows` (`primaryHover`, `secondaryHover`, `popup`);
  `cssVar(t: DesignToken): string` → `var(--ui-01, #ffffff)`;
  `allTokens(): DesignToken[]` (плоский список для инъекции и тестов);
  `injectDesignTokens(): void`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/shared/design/tokens.test.ts
import { describe, expect, it } from 'vitest'

import { allTokens, cssVar, palette } from './tokens'
import { injectDesignTokens } from './inject-design-tokens'

describe('design tokens', () => {
  it('cssVar собирает var() с фолбэком-значением', () => {
    expect(cssVar(palette.ui01)).toBe('var(--ui-01, #ffffff)')
    expect(cssVar(palette.accent02)).toBe('var(--accent-02, #2a75f4)')
  })

  it('имена CSS-переменных уникальны, значения — валидные CSS-цвета/тени', () => {
    const tokens = allTokens()
    const vars = tokens.map((t) => t.cssVar)
    expect(new Set(vars).size).toBe(vars.length)
    for (const t of tokens) {
      expect(t.cssVar).toMatch(/^--[a-z0-9-]+$/)
      expect(t.value).toMatch(/^(#[0-9a-f]{6}|rgba?\(|0 \d)/)
    }
  })

  it('injectDesignTokens пишет :root-переменные один раз', () => {
    injectDesignTokens()
    injectDesignTokens() // идемпотентность
    const styles = document.querySelectorAll('style[data-design-tokens]')
    expect(styles.length).toBe(1)
    expect(styles[0].textContent).toContain('--ui-01: #ffffff')
    expect(styles[0].textContent).toContain('--accent-02: #2a75f4')
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run src/shared/design/tokens.test.ts`
Expected: FAIL (модулей нет).

- [ ] **Step 3: Реализация**

```ts
// src/shared/design/tokens.ts
/**
 * ЕДИНСТВЕННОЕ место literal-значений дизайна (спека
 * docs/superpowers/specs/2026-09-03-design-system-audit-design.md §1).
 * Имена канонических токенов = переменным Figma (UI 01…, Accent 01/02).
 * pending* — «левые» цвета, зафиксированные при переезде Ф1 как есть;
 * их канонизация — по чек-листу аудита (Ф3/Ф4).
 */
export interface DesignToken {
  cssVar: string
  value: string
}

const t = (cssVar: string, value: string): DesignToken => ({ cssVar, value })

export const palette = {
  ui01: t('--ui-01', '#ffffff'),
  ui02: t('--ui-02', '#f2f6fd'),
  ui03: t('--ui-03', '#c3cee0'),
  ui04: t('--ui-04', '#dbe7fd'),
  ui05: t('--ui-05', '#9fa9ba'),
  ui06: t('--ui-06', '#222124'),
  ui07: t('--ui-07', '#e0eafc'),
  ui08: t('--ui-08', '#c4d6f5'),
  accent01: t('--accent-01', '#daf449'),
  accent01Hover: t('--accent-01-hover', '#dafe10'),
  accent01Pressed: t('--accent-01-pressed', '#c0e10b'),
  accent02: t('--accent-02', '#2a75f4'),
  accent02Hover: t('--accent-02-hover', '#1f66db'),
  support01: t('--support-01', '#f4482a'),
  // pending: значения зафиксированы Ф1 как есть, судьба — аудит (Ф3)
  pendingGray1: t('--pending-gray-1', '#d9d9d9'),
  pendingGray2: t('--pending-gray-2', '#dcdcdc'),
  pendingGray3: t('--pending-gray-3', '#e5e7eb'),
  pendingGray4: t('--pending-gray-4', '#e6e9ee'),
  pendingGray5: t('--pending-gray-5', '#eceff4'),
  pendingGray6: t('--pending-gray-6', '#808080'),
  pendingBlueBg: t('--pending-blue-bg', '#e9f0fc'),
  pendingWarnBorder: t('--pending-warn-border', '#f0a000'),
  pendingWarnBg: t('--pending-warn-bg', '#fff8e1'),
  pendingWarnBg2: t('--pending-warn-bg-2', '#fffbe6'),
  pendingYellow1: t('--pending-yellow-1', '#fcd53b'),
  pendingYellow2: t('--pending-yellow-2', '#f6c827'),
  pendingYellow3: t('--pending-yellow-3', '#e3b93c'),
  pendingWeekendRed: t('--pending-weekend-red', '#d32f2f'),
  pendingWeekendBg: t('--pending-weekend-bg', 'rgba(211, 47, 47, 0.06)'),
} satisfies Record<string, DesignToken>

// Семантические алиасы: код читает смысл, значение — ссылка на палитру.
export const semantic = {
  textPrimary: palette.ui06,
  textSecondary: palette.ui05,
  divider: palette.ui03,
  zebra: palette.ui02,
  headerLine: palette.ui06,
  surface: palette.ui01,
  surfaceRaised: palette.ui02,
  selection: palette.ui04,
  primary: palette.accent02,
  error: palette.support01,
  brand: palette.accent01,
} satisfies Record<string, DesignToken>

export const shadows = {
  primaryHover: t('--shadow-primary-hover', '2px 4px 8px rgba(218,244,73,0.8)'),
  secondaryHover: t(
    '--shadow-secondary-hover',
    '0px 4px 8px rgba(42,117,244,0.2)'
  ),
  popup: t('--shadow-popup', '0 3px 24px rgba(42, 117, 244, 0.4)'),
} satisfies Record<string, DesignToken>

export const fontFamily = "'Google Sans', system-ui, sans-serif"

export const typography = {
  h2: { size: 26, weight: 700 },
  h3: { size: 20, weight: 700 },
  body1: { size: 16, weight: 500 },
  body2: { size: 14, weight: 500 },
  caption: { size: 12, weight: 500 },
} as const

export const radii = { sm: 4, md: 8, lg: 12 } as const

/** Шкала отступов, кратная 4 — для gap/padding в TS-коде и MUI sx. */
export const spacing = [4, 8, 12, 16, 20, 24, 32] as const

export const cssVar = (token: DesignToken): string =>
  `var(${token.cssVar}, ${token.value})`

export const allTokens = (): DesignToken[] => [
  ...Object.values(palette),
  ...Object.values(shadows),
]
```

```ts
// src/shared/design/inject-design-tokens.ts
import { allTokens } from './tokens'

/**
 * Пишет дефолты токенов в :root на старте приложения. Runtime-канал для
 * фазы 2 (/api/theme): серверная тема просто перепишет эти переменные через
 * setProperty — компоненты читают var() и перекрасятся сами (спека §4.1).
 */
export function injectDesignTokens(): void {
  if (document.querySelector('style[data-design-tokens]')) return
  const style = document.createElement('style')
  style.setAttribute('data-design-tokens', '')
  const lines = allTokens()
    .map((t) => `  ${t.cssVar}: ${t.value};`)
    .join('\n')
  style.textContent = `:root {\n${lines}\n}`
  document.head.appendChild(style)
}
```

В `src/app/main.tsx` — первой строкой после импортов CSS:

```ts
import { injectDesignTokens } from '@/shared/design/inject-design-tokens'
// …
injectDesignTokens()
```

(вызов до `createRoot(...)`).

- [ ] **Step 4: Прогнать тест — зелёный**

Run: `npx vitest run src/shared/design/tokens.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/shared/design src/app/main.tsx
git commit -m "feat: канон дизайн-токенов и инъекция :root-переменных (Ф1 спеки дизайн-системы)"
```

---

### Task 2: Tailwind-конфиг читает токены через var()

**Files:**

- Modify: `tailwind.config.ts`
- Test: `src/shared/design/tokens.test.ts` (дополнить)

**Interfaces:**

- Consumes: `palette`, `shadows`, `cssVar` из Task 1.
- Produces: те же tailwind-классы, что и сейчас (`bg-ui-01`, `text-accent-02`,
  `border-ui-03`, `shadow-primary-hover`…) — ни один класс не переименовывается.

- [ ] **Step 1: Дополнить тест синхронности**

```ts
// добавить в src/shared/design/tokens.test.ts
import tailwindConfig from '../../../tailwind.config'

it('tailwind-палитра построена из токенов (var(), не literal-hex)', () => {
  const colors = (
    tailwindConfig as unknown as {
      theme: { extend: { colors: Record<string, unknown> } }
    }
  ).theme.extend.colors
  expect(JSON.stringify(colors)).not.toMatch(/#[0-9a-fA-F]{6}/)
  expect(JSON.stringify(colors)).toContain('var(--ui-01')
})
```

- [ ] **Step 2: Прогнать — падает** (в конфиге сейчас literal-hex).

- [ ] **Step 3: Переписать блоки `colors`/`boxShadow` конфига**

```ts
// tailwind.config.ts (фрагмент; остальное без изменений)
import type { Config } from 'tailwindcss'

import { cssVar, palette, shadows } from './src/shared/design/tokens'

export default {
  // …content/keyframes/animation/fontFamily/fontSize/borderRadius как были…
  theme: {
    extend: {
      // …
      boxShadow: {
        'primary-hover': cssVar(shadows.primaryHover),
        'secondary-hover': cssVar(shadows.secondaryHover),
        popup: cssVar(shadows.popup),
      },
      colors: {
        ui: {
          '01': cssVar(palette.ui01),
          '02': cssVar(palette.ui02),
          '03': cssVar(palette.ui03),
          '04': cssVar(palette.ui04),
          '05': cssVar(palette.ui05),
          '06': cssVar(palette.ui06),
          '07': cssVar(palette.ui07),
          '08': cssVar(palette.ui08),
        },
        accent: {
          '01': {
            DEFAULT: cssVar(palette.accent01),
            hover: cssVar(palette.accent01Hover),
            pressed: cssVar(palette.accent01Pressed),
          },
          '02': {
            DEFAULT: cssVar(palette.accent02),
            hover: cssVar(palette.accent02Hover),
          },
        },
        support: { '01': cssVar(palette.support01) },
        pending: {
          'gray-1': cssVar(palette.pendingGray1),
          'gray-2': cssVar(palette.pendingGray2),
          'gray-3': cssVar(palette.pendingGray3),
          'gray-4': cssVar(palette.pendingGray4),
          'gray-5': cssVar(palette.pendingGray5),
          'gray-6': cssVar(palette.pendingGray6),
          'blue-bg': cssVar(palette.pendingBlueBg),
          'warn-border': cssVar(palette.pendingWarnBorder),
          'warn-bg': cssVar(palette.pendingWarnBg),
          'warn-bg-2': cssVar(palette.pendingWarnBg2),
          'yellow-1': cssVar(palette.pendingYellow1),
          'yellow-2': cssVar(palette.pendingYellow2),
          'yellow-3': cssVar(palette.pendingYellow3),
          'weekend-red': cssVar(palette.pendingWeekendRed),
          'weekend-bg': cssVar(palette.pendingWeekendBg),
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: Тесты + сборка**

Run: `npx vitest run src/shared/design && npm run build`
Expected: PASS; build зелёный (v4 принимает var()-строки в ts-конфиге).

- [ ] **Step 5: Смоук в браузере**

Поднять `npm run dev`, открыть `/` и убедиться (DevTools → computed), что
у сайдбара/кнопок фоновые цвета остались прежними (классы `bg-ui-*`
разрешаются в те же hex через var()).

- [ ] **Step 6: Коммит**

```bash
git add tailwind.config.ts src/shared/design/tokens.test.ts
git commit -m "refactor: tailwind-палитра читает дизайн-токены через var()"
```

---

### Task 3: MUI-тема на токенах

**Files:**

- Modify: `src/app/theme/theme.ts` (295 строк, 36 hex-вхождений)
- Test: `src/shared/design/tokens.test.ts` (дополнить)

**Interfaces:**

- Consumes: `cssVar`, `palette`, `semantic`, `shadows`, `fontFamily` из Task 1.

- [ ] **Step 1: Дополнить тест**

```ts
// добавить в src/shared/design/tokens.test.ts
it('MUI-тема не содержит literal-hex (кроме none)', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync('src/app/theme/theme.ts', 'utf8')
  )
  const code = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')
  expect(code).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
})
```

- [ ] **Step 2: Прогнать — падает.**

- [ ] **Step 3: Замены в theme.ts по mapping-таблице**

Единый принцип — каждый literal заменяется на `cssVar(...)`:

```ts
import {
  cssVar,
  fontFamily,
  palette,
  semantic,
  shadows,
} from '@/shared/design/tokens'

// palette:
palette: {
  primary: { main: cssVar(semantic.primary) },
  error: { main: cssVar(semantic.error) },
  text: {
    primary: cssVar(semantic.textPrimary),
    secondary: cssVar(semantic.textSecondary),
  },
},
```

Дальше механически: `'#ffffff'` → `cssVar(palette.ui01)`, `'#c3cee0'` →
`cssVar(semantic.divider)`, `'#2a75f4'` → `cssVar(semantic.primary)`,
`'#f4482a'` → `cssVar(semantic.error)`, `'#9fa9ba'` →
`cssVar(semantic.textSecondary)`, `'#222124'` → `cssVar(semantic.textPrimary)`,
`'#dbe7fd'` → `cssVar(semantic.selection)`, `'#e0eafc'` →
`cssVar(palette.ui07)`; строка тени
`'0px 3px 24px rgba(42, 117, 244, 0.4)'` (2 места) → `cssVar(shadows.popup)`;
литералы `'"Google Sans", system-ui, sans-serif'` (5 мест) → `` `${fontFamily}` ``
(значение идентично — кавычки внутри fontFamily одинарные, проверить рендер).

- [ ] **Step 4: Тесты + сборка + смоук**

Run: `npx vitest run src/shared/design && npx vitest run && npm run build`
Смоук: открыть карточку документа — инпуты (границы, фокус-синий), календарь
(выделенный день) выглядят как раньше.

- [ ] **Step 5: Коммит**

```bash
git add src/app/theme/theme.ts src/shared/design/tokens.test.ts
git commit -m "refactor: MUI-тема читает дизайн-токены (bit-perfect)"
```

---

### Task 4: Переезд потребителей — shared/widgets/pages

**Files (Modify, по mapping-таблице):**

- `src/shared/ui/inputs/calendar-layout.tsx` (17)
- `src/shared/ui/toast/show-toast.tsx` (12)
- `src/shared/ui/inputs/autocomplete-input.tsx` (4)
- `src/widgets/document-list-toolbar/ui/select-operation-dialog.tsx` (3)
- `src/features/support-call/ui/call-room-dialog.tsx` (11)
- `src/features/support-call/lib/remote-control-apply.ts` (2)
- `src/pages/login/ui/login-field-sx.ts` (9), `src/pages/login/ui/login-page.tsx` (2)
- `src/pages/reports/report-list/ui/report-page.tsx` (6),
  `src/pages/reports/report-list/ui/report-param-field.tsx` (1)
- `src/pages/reportalt/ui/reportalt-param-field.tsx` (1)
- `src/features/generate-form-config/ui/ai-button.tsx` (2)
- `src/features/form-renderer/ui/table-field.tsx` (2)
- `src/features/dict-sidebar/ui/dict-sidebar-header.tsx` (1),
  `src/features/dict-sidebar/ui/dict-sidebar-drawer.tsx` (1)

**Interfaces:** Consumes `cssVar`/`palette`/`semantic`/`shadows` из Task 1.

- [ ] **Step 1: Механическая замена**

В каждом файле каждый hex по mapping-таблице: в `sx`/style-объектах —
`cssVar(...)`; в tailwind-классах-arbitrary (`bg-[#2a75f4]`) — канонический
класс (`bg-accent-02`) либо `bg-pending-*`. Канонические замены строго
значение-в-значение; «левые» — на `pending`-токен с тем же значением.
Пример (calendar-layout.tsx:119-124):

```tsx
color: selected ? cssVar(palette.ui01) : cssVar(semantic.textPrimary),
backgroundColor: selected ? cssVar(semantic.primary) : 'transparent',
'&:hover': {
  backgroundColor: selected
    ? cssVar(semantic.primary)
    : cssVar(semantic.selection),
  color: selected ? cssVar(palette.ui01) : cssVar(semantic.primary),
},
// :143
borderRight: `1px solid ${cssVar(palette.pendingGray5)}`,
// :165
'&:hover': { backgroundColor: cssVar(palette.accent02Hover) },
```

- [ ] **Step 2: Прогнать точечные тесты соседних компонентов**

Run: `npx vitest run src/shared/ui src/widgets src/pages/login src/features/support-call`
Expected: PASS.

- [ ] **Step 3: Смоук в браузере**

Логин-стили (не разлогиниваясь: DevTools-инспект login-field-sx не обязателен,
достаточно тостов и календаря): вызвать тост (переключить язык туда-обратно —
или открыть страницу отчёта), открыть календарь даты. Цвета прежние.

- [ ] **Step 4: Коммит**

```bash
git add -A
git commit -m "refactor: shared/widgets/pages на дизайн-токены (bit-perfect)"
```

---

### Task 5: Переезд потребителей — SDUI и report-result-view

**Files (Modify):**

- `src/features/sdui/ui/nodes/composite/table-grid-sx.ts` (2: `#c3cee0` → `cssVar(semantic.divider)`, `#222124` → `cssVar(semantic.headerLine)`; комментарии о синхронизации с border-ui-03 обновить: теперь синхронизация гарантирована общим токеном)
- `src/features/sdui/ui/nodes/composite/editable-table.tsx`,
  `complex-editable-table.tsx` (по 2)
- `src/features/sdui/ui/nodes/composite/tabel/tabel-matrix-cell.tsx`
  (`var(--color-red-600, #d32f2f)` → `cssVar(palette.pendingWeekendRed)`)
- `src/features/sdui/ui/nodes/composite/tabel/tabel-matrix-rows.tsx`
  (weekendSx `rgba(211,47,47,0.06)` → `cssVar(palette.pendingWeekendBg)`)
- `src/features/sdui/ui/unknown-node.tsx` (2 → `pendingWarnBorder`/`pendingWarnBg`)
- `src/features/sdui/ui/dialog-host.tsx` (`PANEL_BG '#F2F6FD'` → `cssVar(palette.ui02)`)
- `src/features/sdui/ui/nodes/calendar/calendar-legend.tsx`
  (`bg-[#2a75f4]` → `bg-accent-02`), `calendar-day-cell.tsx`
  (`text-[#2a75f4]` → `text-accent-02`; `text-gray-400` → `text-ui-05` — ВНИМАНИЕ:
  это смена значения (#9ca3af→#9fa9ba), при bit-perfect-сомнении оставить
  `text-gray-400` и внести в чек-лист аудита; решение: оставить и записать)
- `src/features/report-result-view/ui/tree-table.tsx` (4),
  `ledger-table.tsx` (3), `form-view.tsx` (2)

**Не трогать:** `table-text-color.ts`, `column-background.ts` (hex только в
комментариях — значения с провода).

**Interfaces:** Consumes `cssVar`/`palette`/`semantic` из Task 1.

- [ ] **Step 1: Механическая замена по mapping-таблице** (принцип и примеры — как в Task 4).

- [ ] **Step 2: Тесты SDUI**

Run: `npx vitest run src/features/sdui src/features/report-result-view`
Expected: PASS (тест `table-render-parity` пинует rgb(195,206,224) — значение
не меняется, var() разрешается в тот же цвет в браузере; в jsdom тест пинует
объект TABLE_GRID_SX — обновить пин: вместо literal-hex ожидать
`cssVar(semantic.divider)`-строку).

- [ ] **Step 3: Смоук**: открыть карточку «Отпуска» с ТЧ — зебра/линии прежние.

- [ ] **Step 4: Коммит**

```bash
git add -A
git commit -m "refactor: SDUI-ноды и report-result-view на дизайн-токены (bit-perfect)"
```

---

### Task 6: Страж дрейфа

**Files:**

- Create: `src/shared/design/no-hex-drift.test.ts`

**Interfaces:** самостоятельный (fs-скан исходников).

- [ ] **Step 1: Написать тест (он и есть деливерабл)**

```ts
// src/shared/design/no-hex-drift.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Страж дрейфа (спека §1.4): literal-hex и opacity-модификаторы
 * tailwind-цветов запрещены вне канона токенов. Комментарии не считаются
 * (упоминания значений с провода легальны в javadoc).
 */
const SRC = 'src'
const ALLOWED_FILES = new Set(['src/shared/design/tokens.ts'])

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []
  })

const stripComments = (code: string): string =>
  code
    .split('\n')
    .filter((l) => {
      const s = l.trim()
      return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*')
    })
    .join('\n')

describe('страж дрейфа дизайн-токенов', () => {
  it('literal-hex нет нигде, кроме tokens.ts', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (ALLOWED_FILES.has(file.replaceAll('\\', '/'))) continue
      const code = stripComments(readFileSync(file, 'utf8'))
      const hits = code.match(/#[0-9a-fA-F]{6}\b/g)
      if (hits) offenders.push(`${file}: ${hits.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('opacity-модификаторы токен-цветов не используются (var() их не умеет)', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const code = stripComments(readFileSync(file, 'utf8'))
      const hits = code.match(
        /(?:bg|text|border)-(?:ui|accent|support|pending)-[\w-]+\/\d+/g
      )
      if (hits) offenders.push(`${file}: ${hits.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Прогнать**

Run: `npx vitest run src/shared/design/no-hex-drift.test.ts`
Expected: если Task 4–5 закрыли всё — PASS; если тест находит остатки
(3-значные hex вроде `#fff`, rgba-литералы вне тени) — это список доборной
работы: каждый offender чинится той же mapping-таблицей, тест перегоняется
до зелёного.

- [ ] **Step 3: Полный прогон + сборка**

Run: `npx vitest run && npm run build`
Expected: все зелёные.

- [ ] **Step 4: Коммит**

```bash
git add src/shared/design/no-hex-drift.test.ts
git commit -m "test: страж дрейфа — hex-литералы запрещены вне канона токенов"
```

---

### Task 7: Bit-perfect сверка Ф1 (ручная, выполняет основной агент)

**Files:** нет (артефакты в scratchpad).

- [ ] **Step 1:** `git stash`ем НЕ пользоваться; взять коммит до Task 1
      (`git worktree add /tmp/fin-web-before <sha-до-Ф1>`), поднять там
      `npm ci && npm run dev` на другом порту.
- [ ] **Step 2:** Playwright-браузером снять по 4 скрина в обоих сборках
      (перенеся токены авторизации): карточка «Отпуска» с ТЧ, список документов,
      ОСВ сформированная, главная с шеллом.
- [ ] **Step 3:** Сравнить попиксельно (python PIL, diff-count). Допуск: 0
      отличий; любые отличия — регресс Ф1, чинить до нуля.
- [ ] **Step 4:** Снести worktree, зафиксировать результат сверки в сообщении
      коммита-мержа Ф1 (или в PR-описании).

---

### Task 8: Playwright-инфраструктура (Ф2)

**Files:**

- Modify: `package.json` (devDeps `@playwright/test`; скрипты)
- Create: `playwright.config.ts`
- Create: `tests/visual/helpers/mock-api.ts`
- Create: `tests/visual/helpers/freeze.ts`
- Create: `tests/visual/README.md`
- Create: `tests/visual/assets/` (google-sans-500.woff2, google-sans-700.woff2 — скачать с fonts.gstatic.com однократно)

**Interfaces:**

- Produces: `mockApi(page, fixtures: Record<string, unknown>)` — перехват
  `**/api/**`: URL+method → фикстура из карты, остальное → 200 `{}`;
  перехват `fonts.googleapis.com`/`fonts.gstatic.com` → локальные woff2.
  `freezeTime(page)` — `Date` заморожен на `2026-09-03T12:00:00`.

- [ ] **Step 1: Зависимости и скрипты**

```bash
npm i -D @playwright/test && npx playwright install chromium
```

```jsonc
// package.json scripts +
"test:visual": "playwright test",
"test:visual:update": "playwright test --update-snapshots"
```

- [ ] **Step 2: Конфиг**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/visual',
  fullyParallel: true,
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

- [ ] **Step 3: Хелперы**

```ts
// tests/visual/helpers/freeze.ts
import type { Page } from '@playwright/test'

export async function freezeTime(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fixed = new Date('2026-09-03T12:00:00+05:00').valueOf()
    const RealDate = Date
    // @ts-expect-error переопределение конструктора для детерминизма скриншотов
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(fixed)
        else super(...(args as [number]))
      }
      static now() {
        return fixed
      }
    }
  })
}
```

```ts
// tests/visual/helpers/mock-api.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page, Route } from '@playwright/test'

/**
 * Полная изоляция от сети: все /api/* отвечаются фикстурами, шрифты —
 * локальными woff2 (CDN недетерминирован), прочий внешний трафик — 200 {}.
 * Ключ фикстуры: `${method} ${pathname}`; для POST /api/view — дополнительно
 * по `action.type` из тела: `POST /api/view#OPEN`.
 */
export async function mockApi(
  page: Page,
  fixtures: Record<string, unknown>
): Promise<void> {
  await page.route('**/fonts.googleapis.com/**', (r) =>
    r.fulfill({
      contentType: 'text/css',
      body: [500, 700]
        .map(
          (w) =>
            `@font-face{font-family:'Google Sans';font-weight:${w};` +
            `src:url('http://localhost:4173/__font-${w}.woff2')}`
        )
        .join('\n'),
    })
  )
  await page.route('**/__font-*.woff2', (r) => {
    const w = r.request().url().includes('500') ? '500' : '700'
    r.fulfill({
      contentType: 'font/woff2',
      body: readFileSync(join('tests/visual/assets', `google-sans-${w}.woff2`)),
    })
  })
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    let key = `${req.method()} ${url.pathname}`
    if (url.pathname === '/api/view' && req.method() === 'POST') {
      const body = req.postDataJSON() as { action?: { type?: string } }
      key = `${key}#${body.action?.type ?? ''}`
    }
    const fixture = fixtures[key]
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fixture ?? {}),
      status: fixture === undefined ? 200 : 200,
    })
  })
}
```

- [ ] **Step 4: README**

```md
# Визуальная регрессия

- Эталоны рендерятся на macOS (соглашение до появления CI); на других ОС
  тесты не гонять — diff будет ложным.
- `npm run test:visual` — прогон; `npm run test:visual:update` — осознанное
  обновление эталонов (только вместе с визуальным изменением в том же PR).
- Сеть замокана целиком: фикстуры в `fixtures/`, шрифты в `assets/`.
- Запуск перед мержем в dev обязателен (наравне с build).
```

- [ ] **Step 5: Смоук-тест конфига** (одна страница логина без фикстур):

```ts
// tests/visual/smoke.spec.ts
import { expect, test } from '@playwright/test'
import { freezeTime } from './helpers/freeze'
import { mockApi } from './helpers/mock-api'

test('логин рендерится и совпадает с эталоном', async ({ page }) => {
  await freezeTime(page)
  await mockApi(page, {})
  await page.goto('/login')
  await expect(page).toHaveScreenshot('login.png')
})
```

Run: `npm run test:visual -- --update-snapshots && npm run test:visual`
Expected: первый прогон пишет эталон, второй зелёный.

- [ ] **Step 6: Коммит**

```bash
git add package.json package-lock.json playwright.config.ts tests/visual
git commit -m "feat: инфраструктура визуальной регрессии (playwright, моки сети, локальный шрифт)"
```

---

### Task 9: Фикстуры /api/view с dev-api (выполняет основной агент)

**Files:**

- Create: `tests/visual/fixtures/*.json` (по экрану на файл или по ключу)

Снимаются живой сессией против dev-api (браузером с токенами, как в обычном
e2e): для каждого экрана из спеки §3.2 сохранить ответ(ы) `POST /api/view`
(OPEN — обязательно; для отчётов дополнительно `/run` и `/meta`; для списков —
данные листинга; для шелла — `APP_SHELL`-OPEN и `/api/settings/modules`).
Персональные данные в фикстурах допустимы (dev-стенд, тестовые), но токены/
authorization в фикстуры не попадают (сохраняются только тела ответов).

Экраны: шелл+модуль; карточка «Отпуска» (ТЧ с VERTICAL-группами; включая
одну добавленную строку — снять EVENT-ответ или зафиксировать состояние в
OPEN-фикстуре out-of-band); список документов ВНА; табель-матрица
(заполненный демо-док); ОСВ TREE (`/run` август-2026); Карточка счёта LEDGER
(если конфиг выкачен, иначе экран откладывается с пометкой в README);
карточка справочника «Графики работы»; диалог «Сохранить изменения?»
(достигается кликом в тесте, отдельная фикстура не нужна) и поповер
автокомплита (открывается кликом; нужна фикстура опций
`GET /api/dictionary-entries/...`).

- [ ] Снять и закоммитить фикстуры; каждая проверена локальным прогоном
      соответствующего spec-файла Task 10.

```bash
git add tests/visual/fixtures
git commit -m "test: фикстуры /api/view для визуальной регрессии (8 экранов)"
```

---

### Task 10: Скриншот-спеки восьми экранов + эталоны

**Files:**

- Create: `tests/visual/screens.spec.ts`

**Interfaces:** Consumes `mockApi`/`freezeTime` (Task 8), фикстуры (Task 9).

- [ ] **Step 1: Спеки** (шаблон один; по тесту на экран):

```ts
import { expect, test } from '@playwright/test'
import { freezeTime } from './helpers/freeze'
import { mockApi } from './helpers/mock-api'
import shellOpen from './fixtures/shell-open.json'
import otpuskOpen from './fixtures/otpusk-open.json'
// … остальные фикстуры

test.beforeEach(async ({ page }) => {
  await freezeTime(page)
})

test('карточка документа с ТЧ (Отпуск)', async ({ page }) => {
  await mockApi(page, {
    'POST /api/view#OPEN': otpuskOpen,
    'GET /api/settings/modules': shellModules,
    'GET /api/tasks/active': { data: [], success: true },
  })
  await page.goto('/documents/Otpusk/new')
  await page.getByRole('tab', { name: 'Сотрудники' }).click()
  await expect(page).toHaveScreenshot('otpusk-card-tch.png')
})

// аналогично: shell-module.png, document-list.png, tabel-matrix.png,
// report-tree.png (плюс фикстуры POST /api/reportalt/.../run#- по ключу
// 'POST /api/reportalt/OborotnoSaldovayaVedomost/run'), report-ledger.png,
// dictionary-card.png, unsaved-dialog.png (клик по крестику карточки после
// ввода в поле), autocomplete-popover.png (клик по стрелке поля)
```

(в спеке каждый тест пишется полностью — при исполнении скопировать шаблон и
подставить фикстуры/действия; действия экранов описаны в Task 9).

- [ ] **Step 2: Сгенерировать эталоны**: `npm run test:visual:update`
- [ ] **Step 3: Стабильность**: два подряд `npm run test:visual` зелёные
      (нет флейков — иначе чинить детерминизм: шрифт/дата/анимации).
- [ ] **Step 4: Коммит**

```bash
git add tests/visual
git commit -m "test: скриншотные спеки и эталоны восьми опорных экранов"
```

---

### Task 11: Финализация — Jira, мерж Ф1+Ф2 в dev

**Files:** нет (процесс).

- [ ] Полный `npx vitest run` + `npm run build` + `npm run test:visual` — всё зелёное.
- [ ] Завести Jira-тикет (эпик SCRUM-258, активный спринт), переименовать
      ветку `feature/design-system` → `feature/SCRUM-<N>-design-system`
      (`git branch -m` + пуш новой, удаление старой).
- [ ] Свежий `git fetch` + rebase/merge origin/dev (агентские ветки активно
      мержатся — обязательный шаг), повторный прогон тестов.
- [ ] Мерж в dev → пуш; dev → main → пуш (порядок проекта), затем коммент в
      тикет со спекой и скринами сверки Task 7, тикет — по состоянию работ
      (Ф3/Ф4 продолжаются в этом же тикете).

## Self-review

- Покрытие спеки: §1.1-1.4 → Tasks 1-6; §3.1-3.3 → Tasks 8-10; Ф1
  bit-perfect → Task 7; §2 и §4 — вне плана намеренно (Ф3/Ф4 и фаза 2);
  «пофазный мерж» → Task 11.
- Уточнение спеки, зафиксированное планом: «левые» цвета в Ф1 мэпятся не на
  ближайший канонический токен (это изменило бы пиксели), а на
  `pending`-токены с текущими значениями; канонизация — Ф4. Это соответствует
  приоритету bit-perfect из §5.
- Типы/имена сверены: `cssVar/palette/semantic/shadows/allTokens` едины по
  задачам 1-6; `mockApi/freezeTime` — по 8-10.
