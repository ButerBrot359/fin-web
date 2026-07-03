# «Группа ОС»: пикер только групп (referenceSelectionMode) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ссылочные поля с `referenceSelectionMode: "GROUP"` в метаданных атрибута шлют `groupsOnly=true` в запросы пикера (дропдаун и «Показать все»).

**Architecture:** легаси-контур FormRenderer. Новая чистая утилита `selectionModeToSearchParams` в `field-filter-params.ts` (рядом с `fieldFilterToSearchParams`/`mergeSearchParams`), подмешивается в `searchParams` внутри `FieldNode`. До готовности бэка (`GruppaOS` пока `GROUP_AND_ELEMENT`) поведение не меняется. Спека: `docs/superpowers/specs/2026-07-03-os-card-fields-design.md`.

**Tech Stack:** React 19, TypeScript, vitest.

## Global Constraints

- НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build` (CLAUDE.md); тесты — можно.
- Комментарии/тест-описания на русском — как в соседних файлах.
- Формат коммита: `feat|fix|add|refactor: описание`.

---

### Task 1: утилита selectionModeToSearchParams + подключение в FieldNode

**Files:**
- Modify: `src/features/form-renderer/lib/utils/field-filter-params.ts`
- Modify: `src/features/form-renderer/ui/field-node.tsx:94-103`
- Test: `src/features/form-renderer/lib/utils/field-filter-params.test.ts` (создать)

**Interfaces:**
- Consumes: `mergeSearchParams(a, b)` — уже существует в `field-filter-params.ts:32`.
- Produces: `selectionModeToSearchParams(mode: string | null | undefined): Record<string, string> | undefined` — `{ groupsOnly: 'true' }` при `mode === 'GROUP'`, иначе `undefined`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/form-renderer/lib/utils/field-filter-params.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

import {
  selectionModeToSearchParams,
  mergeSearchParams,
} from './field-filter-params'

describe('selectionModeToSearchParams', () => {
  it('GROUP → { groupsOnly: "true" }', () => {
    expect(selectionModeToSearchParams('GROUP')).toEqual({
      groupsOnly: 'true',
    })
  })

  it('другие режимы и отсутствие значения → undefined (без отбора)', () => {
    expect(selectionModeToSearchParams('GROUP_AND_ELEMENT')).toBeUndefined()
    expect(selectionModeToSearchParams('ELEMENT')).toBeUndefined()
    expect(selectionModeToSearchParams(null)).toBeUndefined()
    expect(selectionModeToSearchParams(undefined)).toBeUndefined()
  })

  it('groupsOnly объединяется с af-фильтром через mergeSearchParams', () => {
    expect(
      mergeSearchParams(
        { af: 'Organizatsiya:30294' },
        selectionModeToSearchParams('GROUP')
      )
    ).toEqual({ af: 'Organizatsiya:30294', groupsOnly: 'true' })
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/form-renderer/lib/utils/field-filter-params.test.ts`
Expected: FAIL — `selectionModeToSearchParams` не экспортируется.

- [ ] **Step 3: Минимальная реализация**

В конец `src/features/form-renderer/lib/utils/field-filter-params.ts` добавить:

```ts
/**
 * Режим выбора ссылочного атрибута (1С «выбор групп и элементов»,
 * `referenceSelectionMode` в метаданных). `GROUP` — выбирать можно только
 * группы (папки): в запросы пикера добавляется `groupsOnly=true`
 * (см. backend-handoff-os-card-fields.md). Остальные режимы — без отбора.
 */
export const selectionModeToSearchParams = (
  mode: string | null | undefined
): Record<string, string> | undefined =>
  mode === 'GROUP' ? { groupsOnly: 'true' } : undefined
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/features/form-renderer/lib/utils/field-filter-params.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Подключить в FieldNode**

В `src/features/form-renderer/ui/field-node.tsx`:

1. Расширить импорт из `../lib/utils/field-filter-params` (строки 25-28):

```ts
import {
  fieldFilterToSearchParams,
  mergeSearchParams,
  selectionModeToSearchParams,
} from '../lib/utils/field-filter-params'
```

2. В `useMemo` c `searchParams` (строки 94-103) домешать параметр режима выбора:

```ts
const searchParams = useMemo(() => {
  const depParams =
    dependency && sourceId != null
      ? { af: `${dependency.targetAttributeCode}:${String(sourceId)}` }
      : undefined
  const effectiveFilter =
    fieldFilters[node.code] ??
    synthesizeReferenceFilter(attribute, () => orgSourceValue)
  return mergeSearchParams(
    mergeSearchParams(depParams, fieldFilterToSearchParams(effectiveFilter)),
    selectionModeToSearchParams(attribute?.referenceSelectionMode)
  )
}, [dependency, sourceId, fieldFilters, node.code, attribute, orgSourceValue])
```

`attribute` уже есть в deps — ничего добавлять не нужно. Параметр уедет во все
потребители `searchParams`: `DictField` (дропдаун → `/search`) и
`push({ searchParams })` сайдбара «Показать все» (→ `/paged`).

- [ ] **Step 6: Прогнать все тесты**

Run: `npm run test`
Expected: PASS, без падений в других сьютах.

- [ ] **Step 7: Ручная проверка отсутствия регресса**

Dev-сервер уже поднят (`http://localhost:5173`). Открыть
`/modules/os/dictionary/OsnovnyeSredstva/new?domain=DICTIONARY`, открыть пикер
«Группа ОС» → запрос уходит в `/api/universaldomain-entries/DICTIONARY/VidyDolgosrochnykhAktivov/search`
**без** `groupsOnly` (режим пока `GROUP_AND_ELEMENT`), список как раньше.

- [ ] **Step 8: Commit**

```bash
git add src/features/form-renderer/lib/utils/field-filter-params.ts \
        src/features/form-renderer/lib/utils/field-filter-params.test.ts \
        src/features/form-renderer/ui/field-node.tsx
git commit -m "feat: пикер только групп для ссылочных полей с referenceSelectionMode=GROUP"
```
