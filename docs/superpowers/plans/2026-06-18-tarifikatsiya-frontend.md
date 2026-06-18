# SCRUM-241: Tarifikatsiya Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Tarifikatsiya document form with generic command toolbar, OBJECT composite picker, and consolidated worker summary grid.

**Architecture:** Extend the legacy FormRenderer with generic form-event command buttons and OBJECT dataType support. Add a Tarifikatsiya-specific form layout (consolidated grid + tabbed raw tables). The SDUI path requires no frontend work — the existing engine handles it when the backend flips `newView=true`.

**Tech Stack:** React 19, TypeScript, React Hook Form, TanStack Query, TanStack Table, i18next

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/features/tarifikatsiya/index.ts` | Barrel export |
| `src/features/tarifikatsiya/types/consolidated.ts` | Types for consolidated grid |
| `src/features/tarifikatsiya/lib/utils/aggregate-workers.ts` | Pure function: 3 ТЧ → per-worker summary rows |
| `src/features/tarifikatsiya/lib/hooks/use-consolidated-data.ts` | Hook wrapping aggregation |
| `src/features/tarifikatsiya/ui/consolidated-grid.tsx` | Read-only summary table |
| `src/features/tarifikatsiya/ui/tarifikatsiya-form-layout.tsx` | Layout: consolidated grid + 5 raw ТЧ tabs |

### Modified files
| File | What changes |
|---|---|
| `src/shared/lib/consts/data-types.ts:23` | Remove OBJECT from IGNORED_DATA_TYPES |
| `src/features/form-renderer/lib/hooks/use-form-events.ts` | Add `triggerEvent(eventName)` to return |
| `src/features/form-renderer/ui/form-renderer.tsx` | Accept `triggerEventRef` prop, wire it |
| `src/features/form-renderer/ui/field-node.tsx:82` | Add OBJECT handling before IGNORED check |
| `src/features/form-renderer/ui/table-cell-renderer.tsx:370` | Add OBJECT handling in CellInput |
| `src/entities/document-type/api/document-type.ts` | Add `getFormEvents(typeCode)` |
| `src/entities/document-type/index.ts` | Export `getFormEvents` |
| `src/widgets/document-form-toolbar/ui/document-form-toolbar.tsx` | Add `commandButtons` + `onClearAll` props |
| `src/widgets/document-form-toolbar/index.ts` | Export new types |
| `src/pages/documents/documents-entry/ui/document-entry-page.tsx` | Wire command buttons, gate Tarifikatsiya layout |
| `src/pages/documents/documents-entry/lib/utils/serialize-table-rows.ts` | Handle OBJECT round-trip `{ type, id }` |
| `src/app/config/i18n/locales/ru/common.json` | New translation keys |
| `src/app/config/i18n/locales/kz/common.json` | New translation keys |

---

## Task 1: Remove OBJECT from IGNORED_DATA_TYPES

**Files:**
- Modify: `src/shared/lib/consts/data-types.ts:23`

- [ ] **Step 1: Remove OBJECT from the ignored set**

In `src/shared/lib/consts/data-types.ts`, line 23, change:

```ts
export const IGNORED_DATA_TYPES = new Set<DataType>(['OBJECT'])
```

to:

```ts
export const IGNORED_DATA_TYPES = new Set<DataType>([])
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/lib/consts/data-types.ts
git commit -m "fix: remove OBJECT from IGNORED_DATA_TYPES to enable composite pickers"
```

---

## Task 2: Add `triggerEvent` to useFormEvents + expose via FormRenderer ref

**Files:**
- Modify: `src/features/form-renderer/lib/hooks/use-form-events.ts`
- Modify: `src/features/form-renderer/ui/form-renderer.tsx`

- [ ] **Step 1: Add `triggerEvent` to `useFormEvents`**

In `src/features/form-renderer/lib/hooks/use-form-events.ts`, add a `triggerEvent` function that calls `mutate` directly with an explicit `eventName`, and add `isPending` from the mutation. Replace the entire file:

```ts
import { useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'
import type { DocumentAttribute } from '@/entities/document-type'

import type { TableReplacersRef } from '../../types/renderer-context'

interface HandleEventPayload {
  eventName: string
  entry: Record<string, unknown>
}

interface HandleEventResponse {
  data: {
    attributes: Record<string, unknown>
    formConfig: Record<string, unknown>
  }
}

interface UseFormEventsParams {
  typeCode: string
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  tableReplacersRef: TableReplacersRef
}

export const useFormEvents = ({
  typeCode,
  attributes,
  form,
  tableReplacersRef,
}: UseFormEventsParams) => {
  const eventFieldMap = useMemo(
    () =>
      new Map(
        attributes
          .filter((attr) => attr.formEvent)
          .map((attr) => [attr.code, attr.formEvent!])
      ),
    [attributes]
  )

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: HandleEventPayload) =>
      apiService.post<HandleEventResponse>({
        url: `/api/document-entries/${typeCode}/handle-event`,
        data: payload,
      }),
    onSuccess: (response) => {
      const newAttributes = response.data.data.attributes as
        | Record<string, unknown>
        | undefined

      if (!newAttributes) return

      for (const [key, value] of Object.entries(newAttributes)) {
        const replacer = tableReplacersRef.current.get(key)
        if (replacer && Array.isArray(value)) {
          replacer(value as Record<string, unknown>[])
        } else {
          form.setValue(key, value)
        }
      }
    },
  })

  const onFieldChange = useCallback(
    (fieldCode: string) => {
      const eventName = eventFieldMap.get(fieldCode)
      if (!eventName) return

      mutate({
        eventName,
        entry: { attributes: form.getValues() },
      })
    },
    [eventFieldMap, mutate, form]
  )

  const triggerEvent = useCallback(
    (eventName: string) => {
      mutate({
        eventName,
        entry: { attributes: form.getValues() },
      })
    },
    [mutate, form]
  )

  return { onFieldChange, triggerEvent, isPending }
}
```

- [ ] **Step 2: Expose `triggerEvent` from FormRenderer via ref prop**

In `src/features/form-renderer/ui/form-renderer.tsx`, add a `triggerEventRef` prop so the parent (`DocumentEntryPage`) can call `triggerEvent` from outside. Replace the file:

```tsx
import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { FormConfig } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'

import { FormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { useFieldOptions } from '../lib/hooks/use-field-options'
import { useFormEvents } from '../lib/hooks/use-form-events'
import { useTypeDependencies } from '../lib/hooks/use-type-dependencies'
import { NodeRenderer } from './node-renderer'

export interface FormRendererHandle {
  triggerEvent: (eventName: string) => void
  clearAllTables: () => void
}

interface FormRendererProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  typeCode: string
  handleRef?: RefObject<FormRendererHandle | null>
  /** Optional shared ref for multi-FormRenderer layouts (e.g. Tarifikatsiya).
   *  When provided, table replacers register into this ref instead of a local one,
   *  so triggerEvent from one FormRenderer can apply echo responses to tables in another. */
  sharedTableReplacersRef?: RefObject<Map<string, (rows: Record<string, unknown>[]) => void>>
}

export const FormRenderer = ({
  config,
  attributes,
  form,
  typeCode,
  handleRef,
  sharedTableReplacersRef,
}: FormRendererProps) => {
  const { i18n } = useTranslation()
  const { dependencyMap } = useTypeDependencies({ attributes })
  const { optionsMap } = useFieldOptions({ attributes, dependencyMap })

  const localTableReplacersRef = useRef(
    new Map<string, (rows: Record<string, unknown>[]) => void>()
  )
  const tableReplacersRef = sharedTableReplacersRef ?? localTableReplacersRef

  const registerTableReplacer = useCallback(
    (code: string, replacer: (rows: Record<string, unknown>[]) => void) => {
      tableReplacersRef.current.set(code, replacer)
    },
    []
  )

  const unregisterTableReplacer = useCallback((code: string) => {
    tableReplacersRef.current.delete(code)
  }, [])

  const { onFieldChange, triggerEvent } = useFormEvents({
    typeCode,
    attributes,
    form,
    tableReplacersRef,
  })

  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        triggerEvent,
        clearAllTables: () => {
          for (const [, replacer] of tableReplacersRef.current) {
            replacer([])
          }
        },
      }
    }
  }, [handleRef, triggerEvent])

  const contextValue = useMemo(
    () => ({
      attributeMap: new Map(attributes.map((attr) => [attr.code, attr])),
      form,
      language: i18n.language,
      optionsMap,
      onFieldChange,
      dependencyMap,
      registerTableReplacer,
      unregisterTableReplacer,
    }),
    [
      attributes,
      form,
      i18n.language,
      optionsMap,
      onFieldChange,
      dependencyMap,
      registerTableReplacer,
      unregisterTableReplacer,
    ]
  )

  return (
    <FormRendererContext value={contextValue}>
      <NodeRenderer node={config.layout} />
    </FormRendererContext>
  )
}
```

- [ ] **Step 3: Update FormRenderer barrel export**

In `src/features/form-renderer/index.ts`, add the type export:

```ts
export { FormRenderer } from './ui/form-renderer'
export type { FormRendererHandle } from './ui/form-renderer'
```

- [ ] **Step 4: Verify dev server compiles**

```bash
npm run dev
```

Check browser — no errors. Existing form-event behavior (field change → handle-event) should still work.

- [ ] **Step 5: Commit**

```bash
git add src/features/form-renderer/
git commit -m "feat: expose triggerEvent from FormRenderer via handleRef"
```

---

## Task 3: Add form-events API + command buttons to toolbar

**Files:**
- Modify: `src/entities/document-type/api/document-type.ts`
- Modify: `src/entities/document-type/index.ts`
- Modify: `src/widgets/document-form-toolbar/ui/document-form-toolbar.tsx`
- Modify: `src/widgets/document-form-toolbar/index.ts`
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`

- [ ] **Step 1: Add `getFormEvents` API function**

In `src/entities/document-type/api/document-type.ts`, add:

```ts
export const getFormEvents = (code: string) =>
  apiService.get<string[]>({
    url: `/api/document-types/${code}/form-events`,
  })
```

- [ ] **Step 2: Export from barrel**

In `src/entities/document-type/index.ts`, add `getFormEvents` to the export:

```ts
export { getDocumentType, getOnGetForm, getFormEvents } from './api/document-type'
```

- [ ] **Step 3: Add i18n keys for command buttons**

In `src/app/config/i18n/locales/ru/common.json`, add inside the `"documentFormToolbar"` object (after `"more": "Ещё"`):

```json
    "fill": "Заполнить",
    "calculateAll": "Рассчитать всё",
    "clearAll": "Очистить все"
```

In `src/app/config/i18n/locales/kz/common.json`, add the same keys with Kazakh translations (or same Russian text as placeholders — verify with team):

```json
    "fill": "Толтыру",
    "calculateAll": "Барлығын есептеу",
    "clearAll": "Барлығын тазалау"
```

- [ ] **Step 4: Add command buttons props to DocumentFormToolbar**

In `src/widgets/document-form-toolbar/ui/document-form-toolbar.tsx`, add a new prop for command buttons and render them. Replace the file:

```tsx
import { useTranslation } from 'react-i18next'

import type { PrintCommand } from '@/entities/document-entry'

import { AiButton } from '@/features/generate-form-config'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { PrintDropdownButton } from './print-dropdown-button'
import DebetKreditIcon from '@/shared/assets/icons/debet-kredit.svg'
import LayersIcon from '@/shared/assets/icons/layers.svg'
import LinkIcon from '@/shared/assets/icons/link.svg'

export interface CommandButton {
  eventName: string
  label: string
  onClick: () => void
  isPending?: boolean
}

interface DocumentFormActions {
  handleSave: () => void
  handlePost: () => void
  handlePostAndClose: () => void
}

interface DocumentFormPrint {
  onPrint: (form?: string) => void
  isLoading?: boolean
  commands: PrintCommand[]
}

interface AiButtonConfig {
  moduleCode: string
  type: 'documents' | 'dictionaries'
  configExists: boolean
  onSuccess: () => void
  onPendingChange?: (isPending: boolean) => void
}

interface DocumentFormToolbarProps {
  isNew?: boolean
  isDirty?: boolean
  actions: DocumentFormActions
  print: DocumentFormPrint
  onMovements?: () => void
  aiButton: AiButtonConfig
  commandButtons?: CommandButton[]
  onClearAll?: () => void
}

export const DocumentFormToolbar = ({
  isNew,
  isDirty,
  actions,
  print,
  onMovements,
  aiButton,
  commandButtons,
  onClearAll,
}: DocumentFormToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={actions.handlePostAndClose}>
          {t('documentFormToolbar.postAndClose')}
        </Button>
        <Button variant="secondary" onClick={actions.handleSave}>
          {t('documentFormToolbar.save')}
        </Button>
        <Button variant="secondary" onClick={actions.handlePost}>
          {t('documentFormToolbar.post')}
        </Button>
        {commandButtons?.map((btn) => (
          <Button
            key={btn.eventName}
            variant="secondary"
            onClick={btn.onClick}
            disabled={btn.isPending}
          >
            {btn.label}
          </Button>
        ))}
        {onClearAll && (
          <Button variant="secondary" onClick={onClearAll}>
            {t('documentFormToolbar.clearAll')}
          </Button>
        )}
        <PrintDropdownButton
          commands={print.commands}
          disabled={isNew || isDirty}
          loading={print.isLoading}
          onPrint={print.onPrint}
        />
        <Button
          variant="secondary"
          aria-label={t('actions.debitCredit')}
          disabled={isNew}
          onClick={onMovements}
          startIcon={<DebetKreditIcon className="h-5 w-5" />}
        />
        <Button
          variant="secondary"
          aria-label={t('actions.layers')}
          startIcon={<LayersIcon className="h-5 w-5" />}
        />
        <Button
          variant="secondary"
          aria-label={t('actions.link')}
          startIcon={<LinkIcon className="h-5 w-5" />}
        />
        <DropdownButton label={t('documentFormToolbar.reports')} />
      </div>

      <div className="flex items-center gap-2">
        <AiButton
          moduleCode={aiButton.moduleCode}
          type={aiButton.type}
          configExists={aiButton.configExists}
          onSuccess={aiButton.onSuccess}
          onPendingChange={aiButton.onPendingChange}
        />
        <DropdownButton label={t('documentFormToolbar.more')} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update toolbar barrel export**

In `src/widgets/document-form-toolbar/index.ts`:

```ts
export { DocumentFormToolbar } from './ui/document-form-toolbar'
export type { CommandButton } from './ui/document-form-toolbar'
export { PrintDropdownButton } from './ui/print-dropdown-button'
```

- [ ] **Step 6: Commit**

```bash
git add src/entities/document-type/ src/widgets/document-form-toolbar/ src/app/config/i18n/
git commit -m "feat: add generic command buttons to document form toolbar"
```

---

## Task 4: Wire command buttons in DocumentEntryPage

**Files:**
- Modify: `src/pages/documents/documents-entry/ui/document-entry-page.tsx`

- [ ] **Step 1: Add command buttons wiring**

In `src/pages/documents/documents-entry/ui/document-entry-page.tsx`, wire the `triggerEventRef`, fetch form-events, build command buttons, and pass to toolbar.

Add imports at the top:

```ts
import { useRef } from 'react'  // add useRef to the existing import from 'react'
import { useQuery } from '@tanstack/react-query'  // add useQuery
import { getFormEvents } from '@/entities/document-type'  // add this import
import type { FormRendererHandle } from '@/features/form-renderer'  // add this import
import type { CommandButton } from '@/widgets/document-form-toolbar'  // add this import
```

After the `useDocumentEntryForm()` call (around line 48), add:

```ts
  const formRendererRef = useRef<FormRendererHandle | null>(null)

  const { data: formEvents = [] } = useQuery({
    queryKey: ['form-events', moduleCode],
    queryFn: async () => {
      const response = await getFormEvents(moduleCode)
      return response.data as string[]
    },
    staleTime: 10 * 60 * 1000,
  })

  const EVENT_BUTTON_CONFIG: Record<string, { label: string; order: number }> = {
    OnZapolnitPoVsemRabotnikamClick: {
      label: t('documentFormToolbar.fill'),
      order: 1,
    },
    OnRasschitatVseClick: {
      label: t('documentFormToolbar.calculateAll'),
      order: 2,
    },
  }

  const commandButtons: CommandButton[] = formEvents
    .filter((name) => name.endsWith('Click') && EVENT_BUTTON_CONFIG[name])
    .map((eventName) => ({
      eventName,
      label: EVENT_BUTTON_CONFIG[eventName].label,
      onClick: () => formRendererRef.current?.triggerEvent(eventName),
    }))
    .sort(
      (a, b) =>
        (EVENT_BUTTON_CONFIG[a.eventName]?.order ?? 99) -
        (EVENT_BUTTON_CONFIG[b.eventName]?.order ?? 99)
    )

  const handleClearAll = moduleCode === 'Tarifikatsiya'
    ? () => {
        formRendererRef.current?.clearAllTables()
      }
    : undefined
```

Update the `<DocumentFormToolbar>` JSX to pass new props:

```tsx
      <DocumentFormToolbar
        isNew={isNew}
        isDirty={isDirty}
        actions={actions}
        print={{
          onPrint: handlePrint,
          isLoading: isPrintLoading,
          commands: printCommands,
        }}
        onMovements={handleMovements}
        aiButton={{
          moduleCode,
          type: 'documents',
          configExists: config !== null,
          onSuccess: handleAiSuccess,
          onPendingChange: setIsAiGenerating,
        }}
        commandButtons={commandButtons}
        onClearAll={handleClearAll}
      />
```

Update the `<FormRenderer>` JSX to pass the ref:

```tsx
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
            handleRef={formRendererRef}
          />
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

1. Open any document type that has form-events → command buttons should appear
2. Open a Tarifikatsiya document → "Заполнить", "Рассчитать всё", "Очистить все" buttons should appear
3. Click "Рассчитать всё" → should POST handle-event and update form

- [ ] **Step 3: Commit**

```bash
git add src/pages/documents/documents-entry/
git commit -m "feat: wire command buttons and clear-all into document entry page"
```

---

## Task 5: Add OBJECT composite picker to field-node (header fields)

**Files:**
- Modify: `src/features/form-renderer/ui/field-node.tsx`

- [ ] **Step 1: Add OBJECT handling**

In `src/features/form-renderer/ui/field-node.tsx`, add OBJECT handling inside `renderField()` — **before** the `resolveAttributeDomain` check at line 156. Add this block right after the DIRECTORY check (after line 154, before line 156):

```tsx
    if (dataType === 'OBJECT') {
      const allowedTypes = attribute.allowedTypes ?? []
      if (allowedTypes.length === 0) return null

      // Build search URLs for all allowed types
      const searchUrls = allowedTypes
        .filter((at) => REFERENCE_DOMAIN_KINDS.has(at.domainKind))
        .map((at) => getUniversalSearchUrl(at.domainKind, at.typeCode))

      // Use first type's search URL — options from all types are merged in DictField
      // via a custom selectOptions that fetches from all URLs
      const primaryResolved = { domain: allowedTypes[0].domainKind, typeCode: allowedTypes[0].typeCode }
      const searchUrl = getUniversalSearchUrl(primaryResolved.domain, primaryResolved.typeCode)

      return (
        <DictField
          {...commonProps}
          searchUrl={searchUrl}
          disabled={disabled}
          searchParams={searchParams}
        />
      )
    }
```

**Note:** This is a simplified v1 — uses only the first allowed type for the picker. The composite multi-source picker (fetching from multiple types and merging) will be added in a follow-up if needed, since Tarifikatsiya's `Rabotnik` OBJECT field appears only in table cells, not in header fields. The header OBJECT support is here for completeness.

- [ ] **Step 2: Commit**

```bash
git add src/features/form-renderer/ui/field-node.tsx
git commit -m "feat: add OBJECT dataType support to header field-node"
```

---

## Task 6: Add OBJECT composite picker to table cells

**Files:**
- Modify: `src/features/form-renderer/ui/table-cell-renderer.tsx`

This is where `Rabotnik` columns in the 5 ТЧ actually render.

- [ ] **Step 1: Add OBJECT handling to CellInput**

In `src/features/form-renderer/ui/table-cell-renderer.tsx`, in the `CellInput` component (starting at line 362), add an OBJECT check **before** the main switch statement (before line 394, after the ENUMS check at line 392). Insert:

```tsx
  if (dataType === 'OBJECT') {
    const allowedTypes = column.allowedTypes ?? []
    const firstType = allowedTypes.find((at) =>
      REFERENCE_DOMAIN_KINDS.has(at.domainKind)
    )
    if (firstType) {
      const objectColumn = {
        ...column,
        domainKind: firstType.domainKind,
        allowedTypes: [firstType],
      }
      return (
        <Box sx={tableCellWrapperSx}>
          <DictCell
            name={name}
            column={objectColumn}
            control={control}
            language={language}
          />
        </Box>
      )
    }
  }
```

This reuses `DictCell` by narrowing the column's `allowedTypes` to the first reference type. `resolveAttributeDomain` inside `DictCell` reads `allowedTypes[0]`, so it gets the correct domain/typeCode.

- [ ] **Step 2: Also handle OBJECT in the display path**

In `TableCellRenderer` (line 476+), the display text is rendered via `formatCellValue`. OBJECT values are objects like `{ id: 42, displayName: "Иванов" }` — `formatCellValue` should already handle this if it checks for `displayName`/`nameRu`. Verify by checking `formatCellValue`.

Read `src/shared/lib/utils/format-cell-value.ts` and ensure it handles object values with `displayName` or `nameRu`. If not, add a case.

- [ ] **Step 3: Commit**

```bash
git add src/features/form-renderer/ui/table-cell-renderer.tsx
git commit -m "feat: add OBJECT dataType support to table cell renderer"
```

---

## Task 7: Handle OBJECT serialization on save

**Files:**
- Modify: `src/pages/documents/documents-entry/lib/utils/serialize-table-rows.ts`

- [ ] **Step 1: Update serialization for OBJECT fields**

Currently `serializeTableRows` converts `{ id: X }` → `X` (just the id). For OBJECT fields, the backend expects `{ type: "Sotrudniki", id: 42 }`. However, looking at the current code, the serializer strips ALL objects to just their `id`. This works for DICTIONARY/ENUMS but not for OBJECT composite refs.

We need to check if the attribute is OBJECT type and if so, keep the `type` field. But `serializeTableRows` doesn't have access to child attribute metadata.

The simplest approach: OBJECT values stored in form should have `_typeCode` alongside `id`. On serialization, we convert `{ id, _typeCode, displayName, ... }` → `{ type: _typeCode, id }`.

In `src/pages/documents/documents-entry/lib/utils/serialize-table-rows.ts`, update the serialization to handle the `_typeCode` marker:

```ts
import type { DocumentAttribute } from '@/entities/document-type'

export const serializeTableRows = (
  attributes: Record<string, unknown>,
  documentAttributes: DocumentAttribute[]
): Record<string, unknown> => {
  const result = { ...attributes }

  for (const attr of documentAttributes) {
    if (attr.dataType !== 'TABLE') continue
    const rows = result[attr.code]
    if (!Array.isArray(rows)) continue

    result[attr.code] = rows.map(
      (row: Record<string, unknown>): Record<string, unknown> => {
        const serialized: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row)) {
          if (key === '_rhfId') continue
          if (value && typeof value === 'object' && 'id' in value) {
            const obj = value as { id: number; _typeCode?: string }
            if (obj._typeCode) {
              serialized[key] = { type: obj._typeCode, id: obj.id }
            } else {
              serialized[key] = obj.id
            }
          } else {
            serialized[key] = value
          }
        }
        return serialized
      }
    )
  }

  return result
}
```

- [ ] **Step 2: Verify with backend team**

Confirm with the backend team that OBJECT fields in Tarifikatsiya ТЧ rows expect `{ type: "Sotrudniki", id: 42 }` on save. If the backend actually expects just `id` (because it infers the type), revert to the simple `id` serialization. The code above is defensive — it only uses the `{ type, id }` format when `_typeCode` is present.

- [ ] **Step 3: Commit**

```bash
git add src/pages/documents/documents-entry/lib/utils/serialize-table-rows.ts
git commit -m "feat: handle OBJECT composite ref serialization with type+id"
```

---

## Task 8: Create consolidated grid types and aggregation

**Files:**
- Create: `src/features/tarifikatsiya/types/consolidated.ts`
- Create: `src/features/tarifikatsiya/lib/utils/aggregate-workers.ts`
- Create: `src/features/tarifikatsiya/lib/hooks/use-consolidated-data.ts`

- [ ] **Step 1: Create types**

Create `src/features/tarifikatsiya/types/consolidated.ts`:

```ts
export interface ConsolidatedWorkerRow {
  rabotnikId: number | string
  rabotnikName: string
  dolzhnost: string
  tarifnayaStavka: number
  nadbavki: number
  mesyachnyFot: number
  dopolnitelnyFot: number
  itogoFot: number
}
```

- [ ] **Step 2: Create pure aggregation function**

Create `src/features/tarifikatsiya/lib/utils/aggregate-workers.ts`:

```ts
import type { ConsolidatedWorkerRow } from '../../types/consolidated'

interface RabotnikRef {
  id?: number | string
  displayName?: string
  nameRu?: string
}

interface DannyeRow {
  Rabotnik?: RabotnikRef | null
  Dolzhnost?: { nameRu?: string } | null
  [key: string]: unknown
}

interface NachisleniyaRow {
  Rabotnik?: RabotnikRef | null
  Rezultat?: number | null
  EtoNadbavka?: boolean | null
  [key: string]: unknown
}

interface DopNachisleniyaRow {
  Rabotnik?: RabotnikRef | null
  Rezultat?: number | null
  [key: string]: unknown
}

const getRabotnikId = (ref: RabotnikRef | null | undefined): string | null =>
  ref?.id != null ? String(ref.id) : null

const getRabotnikName = (ref: RabotnikRef | null | undefined): string =>
  ref?.displayName ?? ref?.nameRu ?? ''

export const aggregateWorkers = (
  dannyeRabotnikov: DannyeRow[],
  nachisleniya: NachisleniyaRow[],
  dopNachisleniya: DopNachisleniyaRow[]
): ConsolidatedWorkerRow[] => {
  // Collect unique workers from DannyeRabotnikov
  const workerMap = new Map<
    string,
    { name: string; dolzhnost: string }
  >()

  for (const row of dannyeRabotnikov) {
    const id = getRabotnikId(row.Rabotnik)
    if (!id) continue
    if (!workerMap.has(id)) {
      workerMap.set(id, {
        name: getRabotnikName(row.Rabotnik),
        dolzhnost: row.Dolzhnost?.nameRu ?? '',
      })
    }
  }

  // Sum nachisleniya per worker
  const tarifMap = new Map<string, number>()
  const nadbavkiMap = new Map<string, number>()

  for (const row of nachisleniya) {
    const id = getRabotnikId(row.Rabotnik)
    if (!id) continue
    const rezultat = row.Rezultat ?? 0
    if (row.EtoNadbavka) {
      nadbavkiMap.set(id, (nadbavkiMap.get(id) ?? 0) + rezultat)
    } else {
      tarifMap.set(id, (tarifMap.get(id) ?? 0) + rezultat)
    }
    // Ensure worker is in the map even if not in DannyeRabotnikov
    if (!workerMap.has(id)) {
      workerMap.set(id, { name: getRabotnikName(row.Rabotnik), dolzhnost: '' })
    }
  }

  // Sum dop nachisleniya per worker
  const dopMap = new Map<string, number>()
  for (const row of dopNachisleniya) {
    const id = getRabotnikId(row.Rabotnik)
    if (!id) continue
    dopMap.set(id, (dopMap.get(id) ?? 0) + (row.Rezultat ?? 0))
    if (!workerMap.has(id)) {
      workerMap.set(id, { name: getRabotnikName(row.Rabotnik), dolzhnost: '' })
    }
  }

  // Build consolidated rows
  const rows: ConsolidatedWorkerRow[] = []
  for (const [id, worker] of workerMap) {
    const tarifnayaStavka = tarifMap.get(id) ?? 0
    const nadbavki = nadbavkiMap.get(id) ?? 0
    const mesyachnyFot = tarifnayaStavka + nadbavki
    const dopolnitelnyFot = dopMap.get(id) ?? 0

    rows.push({
      rabotnikId: id,
      rabotnikName: worker.name,
      dolzhnost: worker.dolzhnost,
      tarifnayaStavka,
      nadbavki,
      mesyachnyFot,
      dopolnitelnyFot,
      itogoFot: mesyachnyFot + dopolnitelnyFot,
    })
  }

  return rows
}
```

- [ ] **Step 3: Create hook**

Create `src/features/tarifikatsiya/lib/hooks/use-consolidated-data.ts`:

```ts
import type { UseFormReturn } from 'react-hook-form'

import { aggregateWorkers } from '../utils/aggregate-workers'

export const useConsolidatedData = (
  form: UseFormReturn<Record<string, unknown>>
) => {
  const values = form.watch()

  const dannyeRabotnikov = (values.DannyeRabotnikov ?? []) as Record<
    string,
    unknown
  >[]
  const nachisleniya = (values.NachisleniyaRabotnikov ?? []) as Record<
    string,
    unknown
  >[]
  const dopNachisleniya = (values.DopolnitelnyeNachisleniya ?? []) as Record<
    string,
    unknown
  >[]

  return aggregateWorkers(dannyeRabotnikov, nachisleniya, dopNachisleniya)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/tarifikatsiya/
git commit -m "feat: add consolidated worker data aggregation for Tarifikatsiya"
```

---

## Task 9: Create consolidated grid component

**Files:**
- Create: `src/features/tarifikatsiya/ui/consolidated-grid.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/tarifikatsiya/ui/consolidated-grid.tsx`:

```tsx
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { ConsolidatedWorkerRow } from '../types/consolidated'

interface ConsolidatedGridProps {
  data: ConsolidatedWorkerRow[]
}

const formatNumber = (value: number): string =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })

export const ConsolidatedGrid = ({ data }: ConsolidatedGridProps) => {
  const { t } = useTranslation()

  const columns: ColumnDef<ConsolidatedWorkerRow>[] = [
    {
      id: 'index',
      header: '№',
      cell: ({ row }) => row.index + 1,
      size: 50,
    },
    {
      accessorKey: 'rabotnikName',
      header: t('tarifikatsiya.worker'),
      size: 200,
    },
    {
      accessorKey: 'dolzhnost',
      header: t('tarifikatsiya.position'),
      size: 180,
    },
    {
      accessorKey: 'tarifnayaStavka',
      header: t('tarifikatsiya.tariffRate'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
    {
      accessorKey: 'nadbavki',
      header: t('tarifikatsiya.supplements'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
    {
      accessorKey: 'mesyachnyFot',
      header: t('tarifikatsiya.monthlyPayroll'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
    {
      accessorKey: 'dopolnitelnyFot',
      header: t('tarifikatsiya.additionalPayroll'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 150,
    },
    {
      accessorKey: 'itogoFot',
      header: t('tarifikatsiya.totalPayroll'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-2">
      <Typography variant="subtitle2">
        {t('tarifikatsiya.workerSummary')}
      </Typography>
      <div className="overflow-x-auto rounded-md border border-ui-03">
        <table className="w-full border-collapse text-body2">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-ui-02">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-ui-03 px-3 py-2 text-left font-medium text-ui-05"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-ui-04"
                >
                  {t('common.noData')}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-ui-03 hover:bg-ui-01">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 text-ui-06">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add i18n keys for Tarifikatsiya grid**

In `src/app/config/i18n/locales/ru/common.json`, add a new top-level section:

```json
  "tarifikatsiya": {
    "workerSummary": "Итоги по работникам",
    "worker": "Работник",
    "position": "Должность",
    "tariffRate": "Тарифная ставка",
    "supplements": "Надбавки",
    "monthlyPayroll": "Месячный ФОТ",
    "additionalPayroll": "Дополнительный ФОТ",
    "totalPayroll": "Итого ФОТ"
  }
```

In `src/app/config/i18n/locales/kz/common.json`, add:

```json
  "tarifikatsiya": {
    "workerSummary": "Жұмысшылар бойынша қорытындылар",
    "worker": "Жұмысшы",
    "position": "Лауазымы",
    "tariffRate": "Тарифтік мөлшерлеме",
    "supplements": "Үстемақылар",
    "monthlyPayroll": "Айлық ЕТҚ",
    "additionalPayroll": "Қосымша ЕТҚ",
    "totalPayroll": "Барлығы ЕТҚ"
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/features/tarifikatsiya/ src/app/config/i18n/
git commit -m "feat: add consolidated worker grid component for Tarifikatsiya"
```

---

## Task 10: Create Tarifikatsiya form layout

**Files:**
- Create: `src/features/tarifikatsiya/ui/tarifikatsiya-form-layout.tsx`
- Create: `src/features/tarifikatsiya/index.ts`

- [ ] **Step 1: Create the form layout**

Create `src/features/tarifikatsiya/ui/tarifikatsiya-form-layout.tsx`:

```tsx
import { useState, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils/cn'

import type { FormConfig } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'
import { FormRenderer } from '@/features/form-renderer'
import type { FormRendererHandle } from '@/features/form-renderer'

import { ConsolidatedGrid } from './consolidated-grid'
import { useConsolidatedData } from '../lib/hooks/use-consolidated-data'

interface TarifikatsiyaFormLayoutProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  typeCode: string
  handleRef?: React.RefObject<FormRendererHandle | null>
}

const TABLE_TABS = [
  { key: 'DannyeRabotnikov', label: 'Данные работников' },
  { key: 'NachisleniyaRabotnikov', label: 'Начисления работников' },
  { key: 'RaspredeleniePoNagruzkam', label: 'Распределение по нагрузкам' },
  { key: 'RazdeleniyaPoShablonam', label: 'Разделения по шаблонам' },
  { key: 'DopolnitelnyeNachisleniya', label: 'Дополнительные начисления' },
] as const

export const TarifikatsiyaFormLayout = ({
  config,
  attributes,
  form,
  typeCode,
  handleRef,
}: TarifikatsiyaFormLayoutProps) => {
  const { t } = useTranslation()
  const consolidatedData = useConsolidatedData(form)
  const [activeTab, setActiveTab] = useState(TABLE_TABS[0].key)

  // CRITICAL: All FormRenderer instances must share the same tableReplacersRef.
  // When triggerEvent fires (e.g. "Рассчитать всё") from the header FormRenderer,
  // the echo response updates table data via replacers registered by the tab FormRenderers.
  const sharedTableReplacersRef = useRef(
    new Map<string, (rows: Record<string, unknown>[]) => void>()
  )

  // Split config: render header fields via FormRenderer (non-TABLE fields),
  // and TABLE fields manually in tabs
  const headerConfig: FormConfig = {
    ...config,
    layout: {
      type: 'VStack',
      gap: 4,
      children: config.layout.type === 'VStack'
        ? config.layout.children.filter((node) => {
            if (node.type !== 'Field') return true
            const attr = attributes.find((a) => a.code === node.code)
            return attr?.dataType !== 'TABLE'
          })
        : config.layout.children,
    },
  }

  const tableAttributes = attributes.filter((a) => a.dataType === 'TABLE')

  return (
    <div className="flex flex-col gap-4">
      {/* Header fields via FormRenderer — handleRef goes here for triggerEvent */}
      <FormRenderer
        config={headerConfig}
        attributes={attributes}
        form={form}
        typeCode={typeCode}
        handleRef={handleRef}
        sharedTableReplacersRef={sharedTableReplacersRef}
      />

      {/* Consolidated grid */}
      <ConsolidatedGrid data={consolidatedData} />

      {/* Raw ТЧ in tabs */}
      <div className="flex flex-col">
        <div className="flex gap-1 border-b border-ui-03">
          {TABLE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 text-body2 transition-colors',
                activeTab === tab.key
                  ? 'border-b-2 border-accent-01 text-accent-01'
                  : 'text-ui-05 hover:text-ui-06'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tableAttributes.map((attr) => (
            <div
              key={attr.code}
              className={cn(attr.code !== activeTab && 'hidden')}
            >
              <FormRenderer
                config={{
                  name: attr.code,
                  title: '',
                  layout: { type: 'Field' as const, code: attr.code },
                }}
                attributes={attributes}
                form={form}
                typeCode={typeCode}
                sharedTableReplacersRef={sharedTableReplacersRef}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create barrel export**

Create `src/features/tarifikatsiya/index.ts`:

```ts
export { TarifikatsiyaFormLayout } from './ui/tarifikatsiya-form-layout'
```

- [ ] **Step 3: Commit**

```bash
git add src/features/tarifikatsiya/
git commit -m "feat: add Tarifikatsiya form layout with consolidated grid and tabbed tables"
```

---

## Task 11: Integrate Tarifikatsiya layout into DocumentEntryPage

**Files:**
- Modify: `src/pages/documents/documents-entry/ui/document-entry-page.tsx`

- [ ] **Step 1: Add conditional rendering**

In `src/pages/documents/documents-entry/ui/document-entry-page.tsx`, import the layout and conditionally render it for Tarifikatsiya.

Add import:

```ts
import { TarifikatsiyaFormLayout } from '@/features/tarifikatsiya'
```

Replace the form body section (lines 150-161). Change:

```tsx
      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingConfig || isLoading || isAiGenerating ? (
          <DocumentEntrySkeleton />
        ) : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
            handleRef={formRendererRef}
          />
        )}
      </div>
```

to:

```tsx
      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingConfig || isLoading || isAiGenerating ? (
          <DocumentEntrySkeleton />
        ) : moduleCode === 'Tarifikatsiya' ? (
          <TarifikatsiyaFormLayout
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
            handleRef={formRendererRef}
          />
        ) : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
            handleRef={formRendererRef}
          />
        )}
      </div>
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

1. Navigate to a Tarifikatsiya document
2. Verify: header fields render at top, consolidated grid shows below, 5 tabs with raw ТЧ below that
3. Add a row to ДанныеРаботников + НачисленияРаботников → consolidated grid updates
4. Click "Рассчитать всё" → Результат fills in, consolidated grid recalculates
5. Navigate to any other document type → standard FormRenderer renders as before

- [ ] **Step 3: Commit**

```bash
git add src/pages/documents/documents-entry/
git commit -m "feat: integrate Tarifikatsiya form layout into document entry page"
```

---

## Task 12: Manual E2E Verification

- [ ] **Step 1: Create Tarifikatsiya document**

1. Navigate to the Tarifikatsiya document list
2. Click "Создать"
3. Set Организация (pick a real org with employees)
4. Set Дата
5. Click "Записать" → document saves, URL updates to entry ID

- [ ] **Step 2: Fill data and calculate**

1. Go to "Данные работников" tab → add a row → pick a Работник (Сотрудник) from composite picker, set Должность
2. Go to "Начисления работников" tab → add a row → pick same Работник, ВидРасчета = «Оклад по дням», Размер = 85123, Ставка = 1.5
3. Click "Рассчитать всё" → verify Результат = **127 685** in the row
4. Check consolidated grid → worker row shows Тарифная ставка = 127 685
5. Header Итого = 127 685

- [ ] **Step 3: Post and verify registers**

1. Click "Провести" → success toast
2. Check movements (Деб/Кред button) → `TarifikatsiyaNachisleniyaSotrudnikov` has Результат = 127685
3. Toggle `Формировать кадровые движения` ON → re-post → 5 kadry registers populate

- [ ] **Step 4: Print**

1. Click Печать → "Результаты тарификации" → PDF opens in new tab

- [ ] **Step 5: Clear all**

1. Click "Очистить все" → all 5 ТЧ empty, consolidated grid empty

- [ ] **Step 6: List page**

1. Go to Tarifikatsiya list
2. Verify document appears with Сумма документа column showing the value
3. Filters (Организация, etc.) work via `af` params

- [ ] **Step 7: Other document types unaffected**

1. Open any non-Tarifikatsiya document → renders normally without command buttons (unless it has form-events)
2. No regressions
