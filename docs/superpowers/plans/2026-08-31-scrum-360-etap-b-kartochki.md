# SCRUM-360 этап B: карточный роутинг через catch-all — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Карточки документов и справочников уходят с явных легаси-роутов на SDUI catch-all (200→SDUI-карточка с dirty-циклом, 422→легаси-карточка), плоские `/documents|/dictionaries`-редиректы (D-1) снимаются при подтверждении бэка, фолбэк `allowCreate` снимается после зелёного `RefActionsCompletenessIT`.

**Architecture:** Расширяем существующий фолбэк-контур `sdui-catch-all` (KIND_TO_LEGACY + LegacyFallback) карточными kind и многопутёвыми entry; в catch-all добавляем «карточную обвязку» (PageHeader, dirty-«\*», UnsavedChangesDialog, tabsApi) — hook + компонент в самом слайсе catch-all, по образцу `sdui-document-page.tsx`. Явные карточные Route и клиентские развилки `newView` удаляются, серверная развилка 200/422 их заменяет.

**Tech Stack:** React 19 + react-router-dom (вложенные Routes в LegacyFallback), zustand-сторы `@/features/sdui` и `@/features/workspace-tabs`, vitest.

**Spec:** `docs/superpowers/specs/2026-08-12-scrum-360-spravochniki-sdui-design.md` (§3 Блок А, §4 Блок Р-B, резолюции v3-back) + `specs-local/scrum-360-srez-spravochnikov/SCRUM-360-spec-v3-2026-08-28-back.md`.

## Global Constraints

- Ветка: `feature/SCRUM-360-etap-b-kartochki` (создана от origin/dev). Пуш в dev/main и любые Jira-действия — только по явной команде пользователя.
- **Мерж-гейт (v3 §3.3):** выкат бэка с правкой копирования (`DocumentCopyScratchBuilder`) на dev — ДО мержа снятия роутов; подтверждается чек-листом v3 §4 в Task 6.
- **Гейт Task 5 (v3 §1):** фолбэк `allowCreate` снимается только после зелёного `RefActionsCompletenessIT` на населённой БД; красный → список нарушений возвращается бэку, Task 5 откатывается до правки бэка.
- План счетов НЕ трогаем: v3 §3.4 — SDUI-карточки плана счетов на роутинге нет, явные роуты остаются.
- `/information-registers/*`-редиректы (SCRUM-45) и `/modules/:pageCode/calculationplan/:moduleCode/:entryId` (SCRUM-388) — вне скоупа, не трогать.
- Легаси-файлы не рефакторим; новые файлы ≤300 строк; тексты — `useTranslation`+`common.json`.
- Перед мержем: полный `npx vitest run` + `npm run build` (tsc -b строже noEmit).
- CLAUDE.md: прямые импорты SDUI↔легаси запрещены; kind-to-legacy.tsx — композиционный слой (pages), ему можно оба мира.

---

### Task 1: Пробы на dev (read-only) — фиксация фактов до правок кода

Никакого кода. Три вопроса, от которых зависят Tasks 2/4/6. Результаты записать в
`/private/tmp/claude-501/-Users-buterbrot359-Development-MishaWeb-fin-web/*/scratchpad/scrum-360-probe.md` (не коммитить).

**Files:** нет (браузер на dev.qazyna.ai + javascript_tool).

**Interfaces:**

- Produces: PROBE-1 «kind в 422 карточных роутов» (ожидание: `DOCUMENT`, `DOCUMENT_NEW`, `DICTIONARY`, `DICTIONARY_NEW`); PROBE-2 «резолвит ли бэк плоские роуты `/documents/:typeCode[...]`, `/dictionaries/:typeCode[...]`» (200/422 против 404/UNKNOWN_ROUTE); PROBE-3 «выкачен ли бэк с правкой copyFrom» (OPEN new с ?copyFrom на new_view=TRUE типе с ТЧ несёт setValue строк ТЧ).

- [ ] **Step 1: Залогиненная вкладка dev.** Открыть `https://dev.qazyna.ai/`, убедиться что вход есть (иначе попросить пользователя залогиниться).
- [ ] **Step 2: Снять эталонный OPEN-запрос.** Открыть любой SDUI-список через catch-all (например `/modules/ZarplatiIKadri/dictionary/FizicheskieLitsa`), в javascript_tool поставить хук на XHR (как в SCRUM-277: перехват `XMLHttpRequest.prototype.open/send` по `/api/view`) и скопировать структуру тела OPEN (formSessionId/route/action).
- [ ] **Step 3: PROBE-1 — 422 карточных.** Через `fetch`/XHR с токеном приложения послать OPEN с `route` карточных URL легаси-типа (`new_view=FALSE`), например `/modules/Bank/document/PlatezhnoePoruchenieIskhodyashchee/123` и `/…/new`, и справочного `/modules/ZarplatiIKadri/dictionary/<легаси-тип>/123`. Зафиксировать HTTP-код и `kind` в теле 422.
- [ ] **Step 4: PROBE-2 — плоские роуты.** Тот же OPEN с `route: "/documents/<typeCode>"`, `"/documents/<typeCode>/123"`, `"/dictionaries/<typeCode>/123"`. Зафиксировать: 200/422-с-kind (бэк резолвит) или 404/ошибка роутинга (не резолвит).
- [ ] **Step 5: PROBE-3 — copyFrom выкачен?** На dev найти new_view=TRUE тип документа с непустой ТЧ (из enabled-types), взять id существующего документа, послать OPEN `route: "/modules/…/document/<type>/new?copyFrom=<id>"`. В ответе искать patch `setValue` со строками ТЧ (v3 §3.2). Есть строки → бэк выкачен; нет → мерж-гейт не снят (Task 6 блокирует мерж, работа в ветке продолжается).
- [ ] **Step 6: Записать результаты** в scratchpad-файл: три вердикта + сырые kind. Если PROBE-1 дал kind, отличные от ожидания, — использовать фактические в Task 2.

### Task 2: KIND_TO_LEGACY — карточные kind + многопутёвый LegacyFallback

**Files:**

- Modify: `src/pages/sdui-catch-all/lib/kind-to-legacy.tsx`
- Modify: `src/pages/sdui-catch-all/ui/legacy-fallback.tsx`
- Modify: `src/pages/documents/documents-entry/index.ts` (+экспорт LegacyDocumentEntryPage)
- Modify: `src/pages/dictionaries/dictionary-entry/index.ts` (+экспорт LegacyDictionaryEntryPage)
- Test: `src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx` (новый)

**Interfaces:**

- Consumes: PROBE-1/PROBE-2 из Task 1 (фактические kind; включать ли плоские пути).
- Produces: `LegacyEntry.path: string | string[]`; `resolveLegacyEntry(kind)` возвращает entry для `DOCUMENT`, `DOCUMENT_NEW`, `DICTIONARY`, `DICTIONARY_NEW`; `LegacyFallback` рендерит `<Route>` на каждый путь массива.

- [ ] **Step 1: Написать падающий тест** `legacy-fallback.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { LegacyFallback } from './legacy-fallback'

// Легаси-страницы тяжёлые — мокаем баррели, важен только маршрутинг.
vi.mock('@/pages/documents/documents-entry', () => ({
  LegacyDocumentEntryPage: () => <div>legacy-document-entry</div>,
}))
vi.mock('@/pages/dictionaries/dictionary-entry', () => ({
  LegacyDictionaryEntryPage: () => <div>legacy-dictionary-entry</div>,
}))

const renderAt = (kind: string, url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LegacyFallback kind={kind} />
    </MemoryRouter>
  )

describe('LegacyFallback: карточные kind (SCRUM-360 этап B)', () => {
  it('DOCUMENT матчит карточный module-путь', async () => {
    renderAt('DOCUMENT', '/modules/Bank/document/Plat/42')
    expect(await screen.findByText('legacy-document-entry')).toBeInTheDocument()
  })
  it('DOCUMENT_NEW матчит /new', async () => {
    renderAt('DOCUMENT_NEW', '/modules/Bank/document/Plat/new')
    expect(await screen.findByText('legacy-document-entry')).toBeInTheDocument()
  })
  it('DICTIONARY матчит карточный путь справочника', async () => {
    renderAt('DICTIONARY', '/modules/Zik/dictionary/Banki/7')
    expect(
      await screen.findByText('legacy-dictionary-entry')
    ).toBeInTheDocument()
  })
  it('DICTIONARY_NEW матчит /new', async () => {
    renderAt('DICTIONARY_NEW', '/modules/Zik/dictionary/Banki/new')
    expect(
      await screen.findByText('legacy-dictionary-entry')
    ).toBeInTheDocument()
  })
  it('неизвестный kind — NotFound', () => {
    renderAt('NO_SUCH_KIND', '/whatever')
    expect(screen.queryByText(/legacy-/)).not.toBeInTheDocument()
  })
})
```

Если PROBE-2 подтвердил серверный резолв плоских роутов — добавить кейсы
`DOCUMENT` на `/documents/Plat/42` и `DICTIONARY` на `/dictionaries/Banki/7`
(массив путей).

- [ ] **Step 2: Прогнать** `npx vitest run src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx` — FAIL (нет экспортов/нет kind).
- [ ] **Step 3: Реализация.** В `kind-to-legacy.tsx`: `interface LegacyEntry { path: string | string[]; element: ReactElement }`; ленивые импорты карточных легаси-страниц из баррелей; новые записи (пути — массивы, если PROBE-2 «да»):

```tsx
const LegacyDocumentEntryPage = lazy(() =>
  import('@/pages/documents/documents-entry').then((m) => ({
    default: m.LegacyDocumentEntryPage,
  }))
)
const LegacyDictionaryEntryPage = lazy(() =>
  import('@/pages/dictionaries/dictionary-entry').then((m) => ({
    default: m.LegacyDictionaryEntryPage,
  }))
)
// …в KIND_TO_LEGACY:
  DOCUMENT: {
    path: [
      '/modules/:pageCode/document/:moduleCode/:entryId',
      '/documents/:typeCode/:entryId', // только если PROBE-2 = да
    ],
    element: <LegacyDocumentEntryPage />,
  },
  DOCUMENT_NEW: {
    path: [
      '/modules/:pageCode/document/:moduleCode/new',
      '/documents/:typeCode/new', // только если PROBE-2 = да
    ],
    element: <LegacyDocumentEntryPage />,
  },
  DICTIONARY: {
    path: [
      '/modules/:pageCode/dictionary/:moduleCode/:entryId',
      '/dictionaries/:typeCode/:entryId', // только если PROBE-2 = да
    ],
    element: <LegacyDictionaryEntryPage />,
  },
  DICTIONARY_NEW: {
    path: '/modules/:pageCode/dictionary/:moduleCode/new',
    element: <LegacyDictionaryEntryPage />,
  },
```

В `legacy-fallback.tsx`:

```tsx
const paths = Array.isArray(entry.path) ? entry.path : [entry.path]
return (
  <Routes>
    {paths.map((p) => (
      <Route key={p} path={p} element={entry.element} />
    ))}
    <Route path="*" element={<NotFound />} />
  </Routes>
)
```

В баррели добавить: `export { LegacyDocumentEntryPage } from './ui/legacy-document-entry-page'` и `export { LegacyDictionaryEntryPage } from './ui/legacy-dictionary-entry-page'`.

- [ ] **Step 4: Прогнать тест** — PASS; плюс существующие `npx vitest run src/pages/sdui-catch-all`.
- [ ] **Step 5: Commit** `feat: SCRUM-360 этап B — карточные kind в KIND_TO_LEGACY, многопутёвый LegacyFallback`.

### Task 3: Карточная обвязка в catch-all (tabsApi + dirty-цикл)

**Files:**

- Create: `src/pages/sdui-catch-all/lib/hooks/use-sdui-card-binding.ts`
- Create: `src/pages/sdui-catch-all/ui/sdui-card-screen.tsx`
- Modify: `src/pages/sdui-catch-all/ui/sdui-catch-all-page.tsx`
- Test: `src/pages/sdui-catch-all/ui/sdui-card-screen.test.tsx` (новый)

**Interfaces:**

- Consumes: `SduiScreen` пропсы (`shouldPersistSession`, `onDirtyChange`, `consumePendingAction`, `onSavedAndClosed`, `onCloseAfter`, `onTitleChange`, `onTab`, `onOpenFailed`, `onRouteUnknown`) — сигнатуры из `sdui-screen.tsx:26-47`; `mapKindToPageType` из `@/features/sdui`.
- Produces: `useSduiCardBinding(): { tabsApi, pageTitle, unsavedDialog, handleClose }`; `SduiCardScreen: FC<{ onTab; onOpenFailed; onRouteUnknown }>`; в `SduiCatchAllPage` — состояние `serverKind`, карточные kind (`DOCUMENT|DOCUMENT_NEW|DICTIONARY|DICTIONARY_NEW`) рендерятся через `SduiCardScreen`.

Хук — копия логики `sdui-document-page.tsx:35-122` (стабильный `tabsApi` через `useMemo`, `navigateToNeighborTab`, dirty-заголовок `${baseTitle} *`, `useUnsavedChangesDialog` с onSave-дескриптором `useTreeStore.getState().onDirtyClose`); отличие от dictionary-варианта: после закрытия садимся на соседнюю вкладку (universal, listPath не знаем). `onSavedAndClosed(route)` = removeTab + closeTab + `navigateToNeighborTab`. Инвалидация: на unmount дергать `invalidateDocumentQueries(queryClient)` и `queryClient.invalidateQueries({ queryKey: ['dict-type'] })` (объединение обеих страниц-доноров; лишняя инвалидация кэша безвредна).

`sdui-card-screen.tsx` — композиция: `PageHeader(pageTitle, onClose=handleClose)` + `SduiScreen {...tabsApi, onTitleChange, onTab, onOpenFailed, onRouteUnknown}` + `UnsavedChangesDialog`, разметка как `sdui-document-page.tsx:124-135` (`div.flex.h-full.flex-col.gap-5.pt-5`).

`sdui-catch-all-page.tsx`: в `authorTab` сохранять `tab.kind` в состояние `serverKind`; рендер:

```tsx
const CARD_KINDS = new Set([
  'DOCUMENT',
  'DOCUMENT_NEW',
  'DICTIONARY',
  'DICTIONARY_NEW',
])
// …
if (mode.kind === 'not-found') return <NotFound />
if (mode.kind === 'legacy') return <LegacyFallback kind={mode.screenKind} />
const screenProps = {
  onTab: authorTab,
  onOpenFailed: (info) =>
    setMode({ kind: 'legacy', screenKind: info?.kind ?? null }),
  onRouteUnknown: () => setMode({ kind: 'not-found' }),
}
return serverKind && CARD_KINDS.has(serverKind) ? (
  <SduiCardScreen {...screenProps} />
) : (
  <SduiScreen {...screenProps} />
)
```

**Важно:** смена «голый SduiScreen → SduiCardScreen» после прихода kind не должна размонтировать активную SDUI-сессию. Если `SduiScreen` при ремаунте шлёт повторный OPEN — передавать tabsApi/обвязку ВСЕГДА (и для списков), а PageHeader/Dialog рендерить условно по `serverKind` вокруг одного и того же `<SduiScreen>` (это дефолтный, более безопасный вариант — выбрать его, если тест Step 2 покажет двойной OPEN).

- [ ] **Step 1: Написать падающий тест** `sdui-card-screen.test.tsx`: мок `@/features/sdui` (SduiScreen → div, сторы), мок `@/features/workspace-tabs`; сценарии: (а) карточный kind → есть PageHeader и один вызов рендера SduiScreen с непустым `shouldPersistSession`; (б) list-kind (`DICTIONARY_LIST`) → PageHeader отсутствует; (в) dirty=true → заголовок с « \*». Использовать образцы моков из `src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx`.
- [ ] **Step 2: Прогнать** — FAIL.
- [ ] **Step 3: Реализовать** хук + компонент + правку страницы (следить за «Важно» выше).
- [ ] **Step 4: Прогнать** новый тест + все тесты слайса `npx vitest run src/pages/sdui-catch-all` — PASS.
- [ ] **Step 5: Commit** `feat: SCRUM-360 этап B — карточная обвязка catch-all (tabsApi, dirty-цикл, PageHeader)`.

### Task 4: Снятие явных карточных роутов + D-1 (по PROBE-2)

**Files:**

- Modify: `src/app/App.tsx`
- Delete: `src/pages/documents/documents-entry/ui/document-entry-page.tsx`, `ui/sdui-document-page.tsx`; `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx`, `ui/sdui-dictionary-entry-page.tsx`
- Delete (если PROBE-2 «да»): `src/pages/documents/document-redirect/`, `src/pages/dictionaries/dictionary-redirect/`
- Modify: баррели `documents-entry/index.ts`, `dictionary-entry/index.ts` (убрать умершие экспорты)
- Modify: `src/pages/sdui-catch-all/lib/no-duplicate-routes.test.ts`
- Modify: `docs/superpowers/specs/2026-07-02-sdui-course-audit.md` (§9, строка D-1)

**Interfaces:**

- Consumes: Task 2 (fallback обслуживает карточные 422), Task 3 (200 рендерится карточной обвязкой), PROBE-2.
- Produces: в `App.tsx` нет Route `/modules/:pageCode/document/:moduleCode/new|:entryId`, `/modules/:pageCode/dictionary/:moduleCode/new|:entryId`; при PROBE-2 «да» — нет `/documents/:typeCode*`, `/dictionaries/:typeCode*` и редирект-страниц.

- [ ] **Step 1: Расширить no-duplicate-routes.test** — добавить в `REMOVED_LIST_PATHS` (переименовать в `REMOVED_PATHS`):

```ts
  '/modules/:pageCode/document/:moduleCode/new',
  '/modules/:pageCode/document/:moduleCode/:entryId',
  '/modules/:pageCode/dictionary/:moduleCode/new',
  '/modules/:pageCode/dictionary/:moduleCode/:entryId',
  // при PROBE-2 «да»:
  '/documents/:typeCode',
  '/documents/:typeCode/new',
  '/documents/:typeCode/:entryId',
  '/dictionaries/:typeCode',
  '/dictionaries/:typeCode/:entryId',
```

- [ ] **Step 2: Прогнать** — FAIL (роуты ещё в App.tsx).
- [ ] **Step 3: App.tsx** — удалить перечисленные Route + lazy-импорты `DocumentEntryPage`, `DictionaryEntryPage` (+`DocumentRedirect`, `DictionaryRedirect` при PROBE-2 «да»). НЕ трогать: accountplan-роуты, account-card, information-registers, calculationplan/:entryId, treasury-export.
- [ ] **Step 4: Удалить мёртвые файлы** (см. Files), почистить баррели: `documents-entry/index.ts` → только `export { LegacyDocumentEntryPage }…`, `dictionary-entry/index.ts` → только `export { LegacyDictionaryEntryPage }…`. Найти осиротевшие импорты: `grep -rn "DocumentEntryPage\|DictionaryEntryPage\|DocumentRedirect\|DictionaryRedirect\|sdui-document-page\|sdui-dictionary-entry-page" src` и починить/удалить (включая их тесты; use-unsaved-changes-dialog остаётся — им пользуются legacy-страницы и новый хук Task 3).
- [ ] **Step 5: D-1.** Если PROBE-2 «да»: в `2026-07-02-sdui-course-audit.md` строку D-1 пометить «**снято** (SCRUM-360 этап B, дата)» по образцу D-2 (строка 161). Если «нет»: D-1 оставить «живо», в §9 дописать «карточные module-роуты сняты; плоские ждут серверного резолва — вопрос бэку в v4».
- [ ] **Step 6: Прогнать всё**: `npx vitest run` + `npm run build` — зелёные.
- [ ] **Step 7: Commit** `feat: SCRUM-360 этап B — карточки через catch-all, снятие явных роутов [и D-1]`.

### Task 5: Гейт Q-1 — RefActionsCompletenessIT и снятие фолбэка allowCreate

**Files:**

- Внешний прогон: `~/Development/MishaWeb/webbuh` (`webbuh-api`)
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx:229`
- Test: соседний тест-файл ноды (найти `reference-field-node.test.tsx` рядом; если нет — создать)

**Interfaces:**

- Consumes: v3 §1 (команда прогона); dev-БД или дамп.
- Produces: строгий `allowCreate`: кнопка «создать» без action — только при `allowCreate === true`.

- [ ] **Step 1: Выяснить доступ к населённой БД.** Варианты по порядку: (а) локальный PG с дампом webbuh — `psql -l`, искать базу webbuh; (б) креды dev-БД в конфигах webbuh (`application-*.yaml`); (в) нет доступа → СТОП: зафиксировать «IT не прогнан, фолбэк не снят», убрать Task 5 из итерации, отметить в v4-front (гейт остаётся). Не изобретать обходов.
- [ ] **Step 2: Прогнать** `BDD_USE_LOCAL_POSTGRES=true ./mvnw test -pl webbuh-api -am -Pit -Dtest=RefActionsCompletenessIT` (из корня webbuh; таймаут ≥10 мин). Зелёный → Step 3. Красный на предусловии «нет new_view-типов» → БД не населена, вернуться к Step 1. Красный со списком header-нарушений → сохранить список для v4-front (возврат бэку), СТОП по этой задаче.
- [ ] **Step 3: Падающий тест фронта:** кейс «actions нет, allowCreate undefined, canBrowse=true → кнопки создания НЕТ» (сейчас есть из-за `?? canBrowse`); и инвариант-кейсы `allowOpen`/`allowCopy` undefined → кнопок нет (§3.3 дизайна).
- [ ] **Step 4: Прогнать** — новый кейс FAIL.
- [ ] **Step 5: Реализация:** `reference-field-node.tsx:229`: `: !createAction && (allowCreate ?? canBrowse)` → `: !createAction && allowCreate === true`.
- [ ] **Step 6: Прогнать** тесты ноды + полный `npx vitest run` — PASS.
- [ ] **Step 7: Commit** `feat: SCRUM-360 — строгий allowCreate в шапке ссылочного поля (гейт C1.4 зелёный)`.

### Task 6: Регресс на dev + спека v4-front (мерж только после гейта)

**Files:**

- Create: `specs-local/scrum-360-srez-spravochnikov/SCRUM-360-spec-v4-<дата>-front.md`

**Interfaces:**

- Consumes: собранная ветка (`npm run build` зелёный), dev-стенд, PROBE-3.
- Produces: отчёт-спека v4-front; вердикт мерж-гейта.

- [ ] **Step 1: Локальный прогон ветки** против dev-api (`npm run dev`, браузер): чек-лист —
  1. Документ new_view=TRUE: открытие карточки из списка → SDUI через catch-all, dirty-«\*», крестик → диалог → «Сохранить»/«Не сохранять»/отмена.
  2. Документ new_view=FALSE: карточка → 422 → легаси-карточка без мигания; /new то же.
  3. Справочник new_view=TRUE (например ПроизводственныеКалендари или Физлица): карточка через catch-all, «Записать и закрыть» садится на соседнюю вкладку.
  4. Справочник new_view=FALSE: 422 → легаси.
  5. Копирование по чек-листу v3 §4 (пп.1–4 обязательно; п.5 «Записать» — только если PROBE-3 подтвердил выкат бэка).
  6. План счетов: list/new/entry работают как раньше (явные роуты не тронуты).
  7. Плоские ссылки: «Показать в списке»/related-docs (если PROBE-2 «нет» — редиректы на месте и работают).
- [ ] **Step 2: Вердикт мерж-гейта.** PROBE-3/п.5 подтверждён → мерж разрешён (по команде пользователя). Нет → ветка ждёт выката бэка, зафиксировать в v4.
- [ ] **Step 3: Спека v4-front** по конвенции: статус этапа B, результаты чек-листа, вердикт Q-1 (IT: зелёный/не прогнан/список нарушений), судьба D-1 (по PROBE-2), напоминание про порядок выката. Черновик короткого коммента (1-2 предложения) — в чат.
- [ ] **Step 4: Показать пользователю** итог: спека + черновик коммента + statement «мерж/пуш/Jira — жду команды».

---

## Self-Review (выполнено)

- Покрытие спеки: §4.1 (KIND_TO_LEGACY+multi-path) → Task 2; §4.2 (снятие роутов, D-1) → Task 4; §4.3 (tabsApi) → Task 3; §4.4 (развилки newView умирают) → Task 4 Step 3-4; §4.5 (copyFrom-гейт) → Task 1 PROBE-3 + Task 6; §3.2 (allowCreate после IT) → Task 5; §3.3 (инварианты undefined) → Task 5 Step 3. План счетов исключён по v3 §3.4 — отражено в Global Constraints.
- Типы: `LegacyEntry.path: string | string[]` согласован между Task 2 кодом и тестом; `CARD_KINDS` согласован с `tab-kind.ts` (DOCUMENT/DOCUMENT_NEW/DICTIONARY/DICTIONARY_NEW).
- Плейсхолдеров нет; ветвления по PROBE-«да/нет» прописаны в обоих исходах.
