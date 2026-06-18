# SCRUM-241: Тарификация — Frontend Design

> **Date:** 2026-06-18
> **Backend spec:** `docs/superpowers/plans/SCRUM-241-frontend-spec.md`
> **Scope:** Document form (legacy + SDUI), list page, command toolbar, consolidated grid, composite picker

---

## 1. Architectural Decisions

| Decision | Choice |
|---|---|
| UI path | Both: legacy FormRenderer now, SDUI when backend ships layout |
| Consolidated grid | Immediately — read-only summary above editable raw tabs |
| Command toolbar | Generic, metadata-driven from `GET /{typeCode}/form-events` |
| Composite picker (Rabotnik) | Unified list: Сотрудники ∪ Вакансии in one autocomplete |
| List page | Generic DocumentPage + Tarifikatsiya-specific filters |
| Print | Existing mechanism, backend stubs rendered as-is |
| Dependent pickers | Out of the box via `dependsOn` metadata |
| «Очистить все» | Client-side clear, Tarifikatsiya-only |
| SDUI path | Minimal frontend work — existing engine covers it |

---

## 2. Code Structure (FSD)

### New slice

```
features/tarifikatsiya/
├── index.ts                           # barrel export
├── ui/
│   ├── consolidated-grid.tsx          # «Итоги по работникам» read-only summary table
│   └── tarifikatsiya-form-layout.tsx  # Layout: consolidated grid + raw ТЧ in tabs
├── lib/
│   ├── hooks/
│   │   └── use-consolidated-data.ts   # Aggregation hook: 5 ТЧ → per-worker rows
│   └── utils/
│       └── aggregate-workers.ts       # Pure aggregation function
└── types/
    └── consolidated.ts                # Types for the consolidated table
```

### Extended existing slices

- **`widgets/document-form-toolbar/`** — generic command buttons from form-events
- **`features/form-renderer/`** — OBJECT dataType handler (composite picker)
- **`pages/documents/documents-entry/`** — gate: if `typeCode === 'Tarifikatsiya'`, render `TarifikatsiyaFormLayout` for the form body

### Integration principle

Tarifikatsiya still goes through standard `DocumentEntryPage` (header, toolbar, save/post/print). Only the form body differs: consolidated grid + tabbed raw ТЧ instead of a plain stack of 5 tables.

---

## 3. Generic Command Toolbar

### Data source

```
GET /api/document-types/{typeCode}/form-events → string[]
```

Filter to `*Click` suffix events for toolbar buttons.

### Button metadata mapping

`EVENT_BUTTON_CONFIG: Record<string, { label: string, icon?: string, order: number }>` — maps known eventNames to UI metadata. Unknown events get a fallback label from humanized event name (`OnXxxClick` → `Xxx`).

### Buttons for Tarifikatsiya

| eventName | label | position |
|---|---|---|
| `OnZapolnitPoVsemRabotnikamClick` | Заполнить | after Провести |
| `OnRasschitatVseClick` | Рассчитать всё | after Заполнить |
| — (client-side) | Очистить все | after Рассчитать |

**«Очистить все»** is not a form-event. It's a client-side action passed as `onClearAll` prop, shown only for Tarifikatsiya. Clears all 5 ТЧ via `useFieldArray.replace([], ...)` for each.

### Click flow

```
Button click
  → POST /api/document-entries/{typeCode}/handle-event
    body: { eventName, entry: { attributes: currentFormData } }
  → response.data.attributes
  → apply: scalars → setValue(), arrays → useFieldArray.replace()
  → form becomes dirty → user saves/posts
```

Reuses existing `useFormEvents` logic from `features/form-renderer` — just invokes `triggerEvent(eventName)` from the button.

---

## 4. Consolidated Grid «Итоги по работникам»

### Columns

| Column | Source |
|---|---|
| № | sequential row number |
| Работник | `DannyeRabotnikov.Rabotnik.displayName` |
| Должность | `DannyeRabotnikov.Dolzhnost.nameRu` |
| Тарифная ставка | Σ `NachisleniyaRabotnikov.Rezultat` where `EtoNadbavka = false` per worker |
| Надбавки | Σ `NachisleniyaRabotnikov.Rezultat` where `EtoNadbavka = true` per worker |
| Месячный ФОТ | Тарифная ставка + Надбавки |
| Дополнительный ФОТ | Σ `DopolnitelnyeNachisleniya.Rezultat` per worker |
| Итого ФОТ | Месячный ФОТ + Дополнительный ФОТ |

### Grouping key

`Rabotnik.id` — present in all ТЧ. Join with `DannyeRabotnikov` by this key to get `Должность`.

### Reactivity

`useConsolidatedData(formValues)` hook calls pure `aggregateWorkers()` on every render. No memoization needed — data is tens to hundreds of rows.

### Form layout

```
┌──────────────────────────────────────┐
│ Header fields (Дата, Орг, Подр...)   │
├──────────────────────────────────────┤
│ Итоги по работникам (consolidated)   │
│  read-only summary table             │
├──────────────────────────────────────┤
│ Tabs: [ Данные | Начисления | Распр. │
│         | Разделения | Доп.начисл. ] │
│  ┌────────────────────────────────┐  │
│  │ Raw ТЧ — editable table       │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│ Footer (Комментарий, Ответственный)  │
└──────────────────────────────────────┘
```

- Consolidated grid — **read-only**, display only
- Tabs with raw ТЧ — **editable**, source of truth
- Editing raw ТЧ → consolidated grid updates automatically

---

## 5. Composite OBJECT Picker

### Problem

`Rabotnik` has `dataType: OBJECT` — can be from `Sotrudniki` or `Vakansii`. Legacy FormRenderer only handles DICTIONARY and ENUMS.

### Solution

Add `OBJECT` dataType support to FormRenderer (field-node + table-cell-renderer):

- When `dataType === 'OBJECT'`, read `allowedTypes[]` — array of `{ domainKind, typeCode }`
- Picker loads entries from **all** allowed types in parallel, merges into one list
- Each option stores `{ id, displayName, _typeCode }` to track origin
- On save, round-trip: `{ type: "Sotrudniki", id: 42 }` or `{ type: "Vakansii", id: 5 }`

### UI

Standard autocomplete like `DictField`, single dropdown. No visual separation between types (matches 1C behavior).

### Usage

`Rabotnik` column in all 5 ТЧ — same picker.

---

## 6. List Page

### Approach

Use generic `DocumentPage`. No custom list page needed.

### Filters

| Filter | API param | Type |
|---|---|---|
| Организация | `af=Organizatsiya:<id>` | DictField picker |
| Подразделение организации | `af=PodrazdelenieOrganizatsii:<id>` | DictField, depends on Организация (`af=Vladelets:<orgId>`) |
| Сотрудник/Вакансия | `af=Rabotnik:<id>` | Composite OBJECT picker |

Filters pass through existing `useTableFilterRequest` → `GET /{typeCode}/paged?af=...`.

### Columns

From backend column metadata (`GET /{typeCode}/columns`). Verify `ItogoSummaNachisleniy` (Сумма документа) is present.

### Sorting

Default `sortAttr=Data&sortDir=DESC` — standard behavior, already works.

---

## 7. Print

Existing mechanism covers everything:

- `GET /Tarifikatsiya/print-commands` → command list
- `PrintDropdownButton` in toolbar shows menu
- Click → `GET /{typeCode}/{id}/print?form=...` → PDF blob → new window

| Form | Status |
|---|---|
| Результаты тарификации (`Rezultaty`) | Works |
| По категориям | Backend stub — blank PDF |
| По работникам | Backend stub — blank PDF |

No special frontend logic needed. Stubs appear in menu as-is.

---

## 8. Dependent Pickers

`PodrazdelenieOrganizatsii` depends on `Organizatsiya` — picker must pass `af=Vladelets:<orgId>`.

Already implemented in FormRenderer:
- `useCellDependency()` in tables
- `useTypeDependencies()` in header fields
- Reads `dependsOn` from type metadata, applies `af` parameter

Works out of the box if backend metadata maps `Vladelets` → `Organizatsiya` correctly.

---

## 9. SDUI Parallel Path

### When backend ships layout

Backend creates `Tarifikatsiya.ФормаОбъекта`, flips `newView=true` → document automatically routes through `SduiDocumentPage` (check already exists in `document-entry-page.tsx`).

### Frontend work for SDUI

Almost nothing — SDUI engine already supports:
- `BUTTON` / `COMMAND` nodes → command buttons from layout
- `TABLE` with server-managed rows
- `REFERENCE_FIELD` with filter props
- `EVENT` dispatch → server patches

### Only thing to verify

1. **`OBJECT_FIELD`** — already in component-registry. Verify composite picker (multiple `allowedTypes`) works through SDUI node.
2. **Consolidated grid** — in SDUI, backend may send it as a computed `TABLE` node (server-side aggregation), making the frontend `ConsolidatedGrid` unnecessary. Backend's decision.

---

## 10. Echo Contract (handle-event response)

Critical for «Рассчитать всё»:

1. Frontend sends `POST handle-event({ eventName: "OnRasschitatVseClick", entry: formData })`
2. Backend returns `{ attributes: { NachisleniyaRabotnikov: [...rows...] } }`
3. Frontend applies via table-replacer: `useFieldArray.replace("NachisleniyaRabotnikov", rows)`
4. Each row is `{ Rabotnik: { id, displayName }, VidRascheta: { id, nameRu }, Razmer, Stavka, Rezultat, ... }`
5. Reference cells = objects `{ id, displayName|nameRu }` (bare id renders blank)
6. Scalars = raw values
7. No top-level `id` on row objects (RHF `keyName` collision)
8. Header `ItogoSummaNachisleniy` also updated via `setValue`
9. Form becomes dirty → user saves/posts to persist

Existing `useFormEvents` response-applier handles this pattern. No new code needed for the echo itself.

---

## 11. End-to-End Verification

1. **Create** Тарификация; set Организация (real org with employees), Дата. Записать.
2. Fill `ДанныеРаботников` (Работник = Сотрудник, Должность, ...) and `НачисленияРаботников` (ВидРасчета = «Оклад по дням», Размер = 85123, Ставка = 1.5).
3. **«Рассчитать всё»** → row Результат = **127 685**, header Итого = **127 685** (via echo).
4. Consolidated grid shows worker row with Тарифная ставка = 127 685.
5. **«Провести»** → register `TarifikatsiyaNachisleniyaSotrudnikov` has Результат = 127685.
6. Toggle **Формировать кадровые движения** ON → re-post → 5 kadry registers populate.
7. **«Печать → Результаты»** → PDF opens.
8. List page filters by Организация → document appears, Сумма документа column shows 127 685.
