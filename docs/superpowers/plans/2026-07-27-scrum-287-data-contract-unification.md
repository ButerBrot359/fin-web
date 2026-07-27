# SCRUM-287 — унификация контрактов данных (A5/A6/A7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать фронтовые компенсаторы контракта данных — мёртвые фолбэки формата дропдауна (A5/A6) и разрешающие дефолты пропсов (A7). Состояние/формат теперь всегда присылает бэк.

**Architecture:** Шесть файлов в `features/sdui`, две группы: (A5/A6) `reference-options.ts` + `list-node.tsx` — контракт презентации дропдауна/списка; (A7) `table-node.tsx`, `editable-table.tsx`, `complex-editable-table.tsx`, `reference-field-node.tsx`, `open-dialog-panel.ts` — флип разрешающих дефолтов на запрещающие. Бэк уже соответствует (A7 + CI-гейт).

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, Vitest + Testing Library.

## Global Constraints

- Правки только в `src/features/sdui`. Легаси/shared/gateway-типы не трогать. Изоляция SDUI↔легаси не нарушается.
- Тех-предохранители `?? String(item.id)` / `?? String(obj.id ?? '')` — ОСТАВЛЯЕМ (страховка от битого ответа, не знание модели). Убираем только фолбэки по полям модели (`item.name`, `displayName`/`nameRu`/`name`) и разрешающие дефолты (`?? true`, `?? 'DICTIONARY'`).
- `presentation` в `open-dialog-panel.ts`: оставить `?? 'modal'` как ЯВНЫЙ последний резерв + `console.warn` в dev (решение владельца, вариант C — тип `PanelEntry.presentation` обязателен).
- `domain` в `reference-field-node.tsx`: без дефолта (`string | undefined`); НЕ подставлять `'DICTIONARY'`. Тип gateway (`ReferencePickerRequest.domain: string`) не менять — гардить/ассертить на стороне узла (`domain!`, как существующий `targetTypeCode!`).
- Окружение тестов: нет `jest-dom` (`(el as HTMLButtonElement).disabled` / `.hasAttribute`, не `toBeDisabled`); `fireEvent` (нет user-event); `afterEach(cleanup)` где нужно.
- Без `useMemo`/`useCallback` без перф-причины.
- НЕ запускать `tsc`/`lint`/`build` — только точечные `npx vitest run` из шагов (кроме финальной верификации Task 5).
- Формат коммита: `refactor: … (SCRUM-287)`.
- Алиас `@/*` → `src/*`.

---

## Task 1: A5/A6 — контракт презентации дропдауна и списка

**Files:**
- Modify: `src/features/sdui/api/reference-options.ts` (EntryItem, EntriesResponse, строки 25/29)
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx:149` (каскад презентации)
- Create: `src/features/sdui/api/reference-options.test.ts` (покрытие `fetchReferenceOptions`)

**Interfaces:**
- Produces: `fetchReferenceOptions` мапит `res.data.content` → `{ id, code, label }`, `label = presentation ?? String(id)` (без `?? name`); `EntriesResponse` без `items`.

- [ ] **Step 1: Написать падающий тест (RED)**

Новый файл `src/features/sdui/api/reference-options.test.ts`. Мокает `apiService.get`. Кейс без `presentation` доказывает удаление `?? item.name`.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { apiService } from '@/shared/api/api'
import { fetchReferenceOptions } from './reference-options'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn() },
}))

describe('fetchReferenceOptions (SCRUM-287 A5/A6)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('мапит content → {id, code, label=presentation}', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { content: [{ id: 7, presentation: 'Организация №1' }] },
    } as never)
    const opts = await fetchReferenceOptions({ url: '/x' })
    expect(opts).toEqual([{ id: 7, code: '7', label: 'Организация №1' }])
  })

  it('строка без presentation → label = String(id) (фолбэк по name убран)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { content: [{ id: 9, name: 'НЕ-презентация' }] },
    } as never)
    const opts = await fetchReferenceOptions({ url: '/x' })
    expect(opts[0].label).toBe('9')
  })
})
```

- [ ] **Step 2: Запустить — RED**

Run: `npx vitest run src/features/sdui/api/reference-options.test.ts`
Expected: FAIL на втором кейсе — текущий код возвращает `label: 'НЕ-презентация'` (`?? item.name`), ожидается `'9'`.

- [ ] **Step 3: Правки reference-options.ts**

- `EntryItem` (строки 4-9): убрать `name?: string`:
```ts
interface EntryItem {
  id: number
  presentation?: string
  [key: string]: unknown
}
```
- `EntriesResponse` (строки 11-14): убрать `items?`:
```ts
interface EntriesResponse {
  content?: EntryItem[]
}
```
- Строка 25:
```ts
const items = res.data.content ?? []
```
- Строка 29:
```ts
label: item.presentation ?? String(item.id),
```

- [ ] **Step 4: Запустить — GREEN**

Run: `npx vitest run src/features/sdui/api/reference-options.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Правка list-node.tsx:149**

```ts
// было
return (obj.presentation ?? obj.displayName ?? obj.nameRu ?? obj.name ?? String(obj.id ?? '')) as string
// стало (A6 фаза 2: строки /paged несут готовый presentation)
return (obj.presentation ?? String(obj.id ?? '')) as string
```

- [ ] **Step 6: Регресс — use-reference-options + list-node зона**

Run: `npx vitest run src/features/sdui/api src/features/sdui/lib/hooks/use-reference-options.test.tsx`
Expected: PASS. (У `list-node.tsx` своего теста нет — изменение механическое, покрыто финальным регрессом Task 5.)

- [ ] **Step 7: Коммит**

```bash
git add src/features/sdui/api/reference-options.ts src/features/sdui/api/reference-options.test.ts src/features/sdui/ui/nodes/composite/list-node.tsx
git commit -m "refactor: единый контракт презентации дропдауна/списка, убрать мёртвые фолбэки (SCRUM-287 A5/A6)"
```

---

## Task 2: A7 — запрещающие дефолты таблиц (editable / allow*)

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx:138` (`editable`)
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx:36-38` (`allow*`)
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx:50-52` (`allow*`)
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx` (фикстура `detailNode` — добавить триаду)

**Interfaces:**
- Produces: `editable`/`allowAdd`/`allowDelete`/`allowReorder` = `node.props?.X === true` (нет разрешающего дефолта). Read-only таблицы без пропсов → `false`.

- [ ] **Step 1: Обновить фикстуру теста (сначала — иначе тест ложно упадёт после флипа)**

В `src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx` фикстура `detailNode.props` (строки 72-76) сейчас:
```ts
  props: {
    masterTable: 'VychetyIPN',
    masterKey: 'VychetIPN',
    detailKey: 'VychetIPN',
  },
```
Добавить триаду (бэк её теперь всегда шлёт на редактируемой ТЧ; тест проверяет кнопки «Добавить»/«Удалить»):
```ts
  props: {
    masterTable: 'VychetyIPN',
    masterKey: 'VychetIPN',
    detailKey: 'VychetIPN',
    allowAdd: true,
    allowDelete: true,
    allowReorder: true,
  },
```

- [ ] **Step 2: Флип в трёх файлах**

`table-node.tsx:138`:
```ts
const editable = node.props?.editable === true
```
`editable-table.tsx:36-38`:
```ts
const allowAdd = node.props?.allowAdd === true
const allowDelete = node.props?.allowDelete === true
const allowReorder = node.props?.allowReorder === true
```
`complex-editable-table.tsx:50-52`:
```ts
const allowAdd = node.props?.allowAdd === true
const allowDelete = node.props?.allowDelete === true
const allowReorder = node.props?.allowReorder === true
```
(`complex-editable-table.tsx:208` `allowReorder && !isMasterDetail` — не трогать, меняется только источник.)

- [ ] **Step 3: Регресс — таблицы**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx src/features/sdui/ui/nodes/composite/table-node.test.ts`
Expected: PASS. complex-editable-table: кнопки «Добавить»/«Удалить» на месте (фикстура несёт триаду); table-node: чистые функции не задеты. Если что-то падает из-за отсутствующего пропса в другой фикстуре — добавить явные `editable/allow*: true` в эту фикстуру (бэк их шлёт).

- [ ] **Step 4: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/editable-table.tsx src/features/sdui/ui/nodes/composite/complex-editable-table.tsx src/features/sdui/ui/nodes/composite/complex-editable-table.test.tsx
git commit -m "refactor: editable/allow* таблиц из props без разрешающего дефолта (SCRUM-287 A7)"
```

---

## Task 3: A7 — `domain` ссылочного поля без дефолта

**Files:**
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` (строка 38; guard строки 61; три `openReferencePicker` — 115, 125, 196)

**Interfaces:**
- Consumes: `openReferencePicker(req: { domain: string, ... })` (gateway-тип не меняем).
- Produces: `domain = node.props?.domain` (`string | undefined`); пустой domain не подставляется как `'DICTIONARY'`.

- [ ] **Step 1: Убрать дефолт domain (строка 38)**

```ts
const domain = node.props?.domain as string | undefined
```

- [ ] **Step 2: Guard индексации DOMAIN_PATH_MAP (строка 61)**

```ts
// было
const domainPath = DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'
// стало (domain теперь может быть undefined; при пустом — legacy-путь,
// но приоритет всё равно у optionsSource.url с бэка)
const domainPath = domain ? (DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries') : 'dictionary-entries'
```

- [ ] **Step 3: Ассертить domain в трёх вызовах пикера**

В `openReferencePicker({ ..., domain, ... })` на строках 115, 125 и 196 заменить `domain,` на `domain!,` (non-null assertion — как существующий `targetTypeCode!` в этом же файле; браузинг гарантирует непустой domain от бэка, пустой = видимый отказ пикера, а не подстановка модели):
```ts
openReferencePicker({
  mode: 'list',            // / 'create' / 'edit'
  domain: domain!,
  typeCode: targetTypeCode!,   // (в edit-ветке — как в текущем коде)
  ...
})
```

- [ ] **Step 4: Регресс — reference-field-node**

Run: `npx vitest run src/features/sdui/ui/nodes/fields/reference-field-node.test.tsx`
Expected: PASS без изменений теста — фикстура тянет опции по `optionsSource.url` (не по domain), browse не кликается (нет `targetTypeCode` → `canBrowse` false), поэтому `domain!` не исполняется.

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/fields/reference-field-node.tsx
git commit -m "refactor: domain ссылочного поля из props без дефолта DICTIONARY (SCRUM-287 A7)"
```

---

## Task 4: A7 — `presentation` openDialog: резерв + dev-warn

**Files:**
- Modify: `src/features/sdui/lib/open-dialog-panel.ts:13` (+ строка 30)

**Interfaces:**
- Produces: `PanelEntry.presentation` = `presentation ?? 'modal'` (тип `'drawer'|'modal'|'page'` сохранён); при отсутствии — `console.warn` в dev.

- [ ] **Step 1: Заменить нормальный дефолт на резерв + warn**

Строка 13:
```ts
// было
const presentation = (props?.presentation as string) ?? 'modal'
// стало
const presentationRaw = props?.presentation as string | undefined
if (import.meta.env.DEV && !presentationRaw) {
  // A7: openDialog обязан нести presentation; отсутствие — баг бэк-композера.
  console.warn('[sdui] openDialog без presentation (A7)', effect.node?.id)
}
const presentation = presentationRaw ?? 'modal'
```
Строка 30 (каст в PanelEntry) — без изменений: `presentation: presentation as 'drawer' | 'modal' | 'page',` (presentation теперь всегда строка благодаря резерву).

- [ ] **Step 2: Регресс — open-dialog-panel**

Run: `npx vitest run src/features/sdui/lib/open-dialog-panel.test.ts`
Expected: PASS без изменений теста (тест передаёт `presentation: 'page'` явно — резерв не задействован).

- [ ] **Step 3: Коммит**

```bash
git add src/features/sdui/lib/open-dialog-panel.ts
git commit -m "refactor: openDialog presentation — явный резерв + dev-warn вместо нормального дефолта (SCRUM-287 A7)"
```

---

## Task 5: Приёмка — grep-критерии + полный регресс + сборка

**Files:** нет (верификация).

- [ ] **Step 1: Критерий A5 (grep пуст)**

Run: `grep -rn "\.items\b\|?? item.name\|res.data.items" src/features/sdui/api/reference-options.ts`
Expected: пусто.

- [ ] **Step 2: Критерий A7 (разрешающих дефолтов нет)**

Run: `grep -rn "?? true\|?? 'DICTIONARY'\|editable ?? \|allowAdd ?? \|allowDelete ?? \|allowReorder ?? " src/features/sdui`
Expected: пусто в table/reference-местах. (Допустимо остаётся `?? 'modal'` в open-dialog-panel — это осознанный явный резерв, под критерий «разрешающего дефолта» не подпадает.)

- [ ] **Step 3: Полный регресс sdui**

Run: `npx vitest run src/features/sdui`
Expected: PASS (вывод чистый). Известное pre-existing падение вне sdui (`dict-sidebar/dict-columns.test.tsx`) сюда не входит.

- [ ] **Step 4: Сборка**

Run: `npm run build`
Expected: tsc + vite зелёные (предупреждение о размере чанка — pre-existing, игнор).

Коммита в этой задаче нет (только верификация); если Step 3/4 вскрыли поломку — вернуть в соответствующую задачу.

---

## Верификация (e2e, ручная — на стенде с актуальным webbuh)

1. Дропдаун ссылочного поля (dictionary/document/account-plan): опции грузятся, показывают `presentation` единообразно.
2. Строки списка `/paged` (пикер «Показать все»): показывают `presentation`.
3. Редактируемая ТЧ (ГП «График платежей», ИПН): кнопки добавить/удалить/reorder на месте — регресса нет.
4. Read-only таблица (движения, связанные документы): add/delete/reorder не появляются.
5. Диалоги (drawer/page) открываются с презентацией от бэка; в dev-консоли нет `[sdui] openDialog без presentation`.

---

## Self-Review (выполнено при написании плана)

**Покрытие спек:**
- A5 §2.1/2.2 (items, item.name, EntriesResponse) → Task 1. ✓
- A6 §3 (list-node каскад) → Task 1. ✓
- A7 §1.1 (editable) + §1.2 (allow*) → Task 2. ✓
- A7 §1.3 (domain) → Task 3. ✓
- A7 §1.4 (presentation) → Task 4 (вариант C). ✓
- Критерии приёмки A5/A7 grep → Task 5. ✓
- Тесты: моки на явные props (complex-editable-table фикстура) + новый reference-options.test → Task 1/2. ✓

**Плейсхолдеры:** нет TBD/TODO; код и тесты целиком.

**Согласованность:** имена `editable`/`allowAdd`/`allowDelete`/`allowReorder`/`domain`/`presentation` едины; gateway-тип не трогаем (guard/assert на узле); тех-предохранители `?? String(id)` сохранены во всех местах.

**Осознанные упущения:** `editable-table.tsx` и `list-node.tsx` без прямого юнит-теста (pre-existing) — механические флипы, покрыты финальным регрессом Task 5 + build + e2e.
