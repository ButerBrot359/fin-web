# Polytable Event Update Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Polytable (TABLE) fields not updating when the `handle-event` backend endpoint returns new table data after a field change event.

**Architecture:** Register each `TableField`'s `useFieldArray.replace` function via `FormRendererContext`. When `useFormEvents` receives updated attributes from the backend, it checks for a registered replacer — if found and value is an array, calls `replace(rows)` instead of `form.setValue`.

**Tech Stack:** React 19, React Hook Form, TypeScript

---

### Task 1: Add table replacer registration to context type

**Files:**
- Modify: `src/features/form-renderer/types/renderer-context.ts:1-18`

- [ ] **Step 1: Add `TableReplacersRef` type and registration methods to `FormRendererContextValue`**

```ts
import type { MutableRefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { DocumentAttribute } from '@/entities/document-type'
import type { SelectOption } from '@/shared/types/select-option'

export interface FieldDependency {
  sourceFieldCode: string
  targetAttributeCode: string
}

export type TableReplacersRef = MutableRefObject<
  Map<string, (rows: Record<string, unknown>[]) => void>
>

export interface FormRendererContextValue {
  attributeMap: Map<string, DocumentAttribute>
  form: UseFormReturn<Record<string, unknown>>
  language: string
  optionsMap: Record<string, SelectOption[]>
  onFieldChange: (fieldCode: string) => void
  dependencyMap: Map<string, FieldDependency>
  registerTableReplacer: (
    code: string,
    replacer: (rows: Record<string, unknown>[]) => void
  ) => void
  unregisterTableReplacer: (code: string) => void
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/form-renderer/types/renderer-context.ts
git commit -m "feat: add table replacer types to FormRendererContextValue"
```

---

### Task 2: Create ref and pass replacers through FormRenderer

**Files:**
- Modify: `src/features/form-renderer/ui/form-renderer.tsx:1-51`
- Modify: `src/features/form-renderer/lib/hooks/use-form-events.ts:1-75`

- [ ] **Step 1: Update `useFormEvents` to accept `tableReplacersRef` and use it in `onSuccess`**

Full updated file `src/features/form-renderer/lib/hooks/use-form-events.ts`:

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

  const { mutate } = useMutation({
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

  return { onFieldChange }
}
```

- [ ] **Step 2: Update `FormRenderer` to create the ref, register/unregister helpers, and pass them through context**

Full updated file `src/features/form-renderer/ui/form-renderer.tsx`:

```tsx
import { useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import type { FormConfig } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'

import { FormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { useFieldOptions } from '../lib/hooks/use-field-options'
import { useFormEvents } from '../lib/hooks/use-form-events'
import { useTypeDependencies } from '../lib/hooks/use-type-dependencies'
import { NodeRenderer } from './node-renderer'

interface FormRendererProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  typeCode: string
}

export const FormRenderer = ({
  config,
  attributes,
  form,
  typeCode,
}: FormRendererProps) => {
  const { i18n } = useTranslation()
  const { dependencyMap } = useTypeDependencies({ attributes })
  const { optionsMap } = useFieldOptions({ attributes, dependencyMap })

  const tableReplacersRef = useRef(
    new Map<string, (rows: Record<string, unknown>[]) => void>()
  )

  const registerTableReplacer = useCallback(
    (code: string, replacer: (rows: Record<string, unknown>[]) => void) => {
      tableReplacersRef.current.set(code, replacer)
    },
    []
  )

  const unregisterTableReplacer = useCallback((code: string) => {
    tableReplacersRef.current.delete(code)
  }, [])

  const { onFieldChange } = useFormEvents({
    typeCode,
    attributes,
    form,
    tableReplacersRef,
  })

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

- [ ] **Step 3: Commit**

```bash
git add src/features/form-renderer/lib/hooks/use-form-events.ts src/features/form-renderer/ui/form-renderer.tsx
git commit -m "feat: create tableReplacersRef and use it in useFormEvents onSuccess"
```

---

### Task 3: Register replace in TableField

**Files:**
- Modify: `src/features/form-renderer/ui/table-field.tsx:1-52,65-68`

- [ ] **Step 1: Import `useFormRendererContext` and register `replace` on mount/unmount**

Add import at the top of `table-field.tsx` (after existing imports, before the interface):

```ts
import { useFormRendererContext } from '../lib/hooks/use-form-renderer-context'
```

Replace the component's opening lines (lines 52-68) with:

```tsx
export const TableField = ({ attribute, form, language }: TableFieldProps) => {
  const { t } = useTranslation()
  const { columns, isLoading } = useTableColumns(attribute)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const { registerTableReplacer, unregisterTableReplacer } =
    useFormRendererContext()

  // Ensure the table field is initialised in form state before useFieldArray
  useEffect(() => {
    const current = form.getValues(attribute.code)
    if (current === undefined) {
      form.setValue(attribute.code, [])
    }
  }, [form, attribute.code])

  const { fields, append, remove, move, replace } = useFieldArray({
    control: form.control as unknown as Control,
    name: attribute.code,
  })

  // Register replace so useFormEvents can update table data from event responses
  useEffect(() => {
    registerTableReplacer(attribute.code, replace)
    return () => {
      unregisterTableReplacer(attribute.code)
    }
  }, [attribute.code, replace, registerTableReplacer, unregisterTableReplacer])
```

Everything else in the file stays unchanged.

- [ ] **Step 2: Commit**

```bash
git add src/features/form-renderer/ui/table-field.tsx
git commit -m "fix: register useFieldArray replace for event-driven polytable updates"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the fix**

1. Open a document entry form that has a TABLE attribute with a field event (e.g., "Регистрация заявлений по вычетам ИПН")
2. Change the field that triggers the event (e.g., "Физическое лицо")
3. Confirm that the `handle-event` response updates TABLE fields (checkboxes like "Предоставлять вычет" should change to match the response)
4. Confirm that regular (non-table) fields still update correctly from the event response
5. Confirm that initial data loading still works (open an existing entry — table should populate from saved data)
