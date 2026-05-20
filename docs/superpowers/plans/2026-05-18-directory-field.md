# Directory Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support `dataType: "DIRECTORY"` in form-renderer as an autocomplete field that searches directories (groups) via `/api/universaldomain-directories/{domain}/{typeCode}`.

**Architecture:** Extend the existing `DictField` component with an optional `selectOptions` prop for custom response transformation. Add a `DIRECTORY` branch in `field-node.tsx` before the `REFERENCE_DOMAIN_KINDS` check, wiring up the directory URL and flat-array transformer.

**Tech Stack:** React, TanStack Query, react-hook-form, Axios

**Spec:** `docs/superpowers/specs/2026-05-18-directory-field-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/lib/consts/data-types.ts` | Modify | Add `DIRECTORY` to `DataType`, add `getUniversalDirectoriesUrl` |
| `src/shared/ui/form-fields/dict-field.tsx` | Modify | Add optional `selectOptions` prop for custom response transformation |
| `src/features/form-renderer/ui/field-node.tsx` | Modify | Add `DIRECTORY` branch before `REFERENCE_DOMAIN_KINDS` check |

---

### Task 1: Add DIRECTORY to DataType and URL builder

**Files:**
- Modify: `src/shared/lib/consts/data-types.ts:1-19` (DataType union), `src/shared/lib/consts/data-types.ts:34-48` (URL builders)

- [ ] **Step 1: Add `DIRECTORY` to the `DataType` union**

In `src/shared/lib/consts/data-types.ts`, add `'DIRECTORY'` after `'OBJECT'`:

```ts
export type DataType =
  | 'STRING'
  | 'TEXT'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'DICTIONARY'
  | 'TABLE'
  | 'ENUMS'
  | 'ACCOUNT_PLAN'
  | 'CHARACTERISTICS_PLAN'
  | 'DOCUMENT'
  | 'EXCHANGE_PLAN'
  | 'CALCULATION_PLAN'
  | 'ACCUMULATION_REGISTER'
  | 'INFORMATION_REGISTER'
  | 'OBJECT'
  | 'DIRECTORY'
```

- [ ] **Step 2: Add `getUniversalDirectoriesUrl` function**

After the existing `getUniversalTypeUrl` function (line 49-50), add:

```ts
const DIRECTORIES_BASE = '/api/universaldomain-directories'

export const getUniversalDirectoriesUrl = (domain: string, typeCode: string) =>
  `${DIRECTORIES_BASE}/${domain}/${typeCode}`
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/consts/data-types.ts
git commit -m "feat: add DIRECTORY dataType and directories URL builder"
```

---

### Task 2: Add `selectOptions` prop to DictField

**Files:**
- Modify: `src/shared/ui/form-fields/dict-field.tsx:31-46` (props interface), `src/shared/ui/form-fields/dict-field.tsx:97-120` (useQuery)

- [ ] **Step 1: Add `selectOptions` to `DictFieldProps`**

In `src/shared/ui/form-fields/dict-field.tsx`, add the prop to the interface after `onOpenEntry`:

```ts
interface DictFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  disabled?: boolean
  required?: string
  options?: SelectOption[]
  searchUrl?: string
  searchParams?: Record<string, string>
  loading?: boolean
  onValueChange?: () => void
  onShowAll?: (onSelect: (value: SelectOption) => void) => void
  onAdd?: () => void
  onOpenEntry?: (entryId: number | string) => void
  selectOptions?: (response: AxiosResponse) => SelectOption[]
}
```

- [ ] **Step 2: Destructure the new prop and use it in useQuery**

Add `selectOptions` to the destructured props (after `onOpenEntry`):

```ts
export const DictField = ({
  name,
  label,
  control,
  readOnly,
  disabled,
  options: staticOptions,
  required,
  searchUrl,
  searchParams,
  loading: externalLoading,
  onValueChange,
  onShowAll,
  onAdd,
  onOpenEntry,
  selectOptions,
}: DictFieldProps) => {
```

Then replace the `useQuery` generic types and `select` to use the custom transformer when provided. Change the useQuery block (lines 97-120) to:

```ts
  const { data: serverOptions = [], isFetching } = useQuery<
    AxiosResponse,
    unknown,
    SelectOption[]
  >({
    queryKey: ['dictionary-search', searchUrl, debouncedSearch, searchParams],
    queryFn: () =>
      apiService.get({
        url: searchUrl!,
        params: { q: debouncedSearch, size: 30, ...searchParams },
      }),
    enabled: isServerSearch && opened,
    select: selectOptions
      ? (response) => selectOptions(response)
      : (response) =>
          (response as AxiosResponse<DictionarySearchResponse>).data.data.content.map(
            (entry): SelectOption => ({
              id: entry.id,
              code: entry.code,
              label:
                (entry.displayName ?? getLocalizedName(entry, i18n.language)) ||
                entry.code,
              raw: entry as unknown as Record<string, unknown>,
            })
          ),
  })
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/ui/form-fields/dict-field.tsx
git commit -m "feat: add selectOptions prop to DictField for custom response transformation"
```

---

### Task 3: Add DIRECTORY branch in field-node.tsx

**Files:**
- Modify: `src/features/form-renderer/ui/field-node.tsx:1-10` (imports), `src/features/form-renderer/ui/field-node.tsx:118-176` (renderField)

- [ ] **Step 1: Add import for `getUniversalDirectoriesUrl`**

In `src/features/form-renderer/ui/field-node.tsx`, update the import from `data-types` (lines 6-10):

```ts
import {
  IGNORED_DATA_TYPES,
  REFERENCE_DOMAIN_KINDS,
  getUniversalSearchUrl,
  getUniversalDirectoriesUrl,
  resolveAttributeDomain,
} from '@/shared/lib/consts/data-types'
```

- [ ] **Step 2: Add the `DictionaryEntry` interface**

At the top of `field-node.tsx`, after the existing imports and before the `FieldNodeProps` interface (line 27), add:

```ts
interface DictionaryEntry {
  id: number
  code: string | null
  displayName?: string
  nameRu?: string
  nameKz?: string
  [key: string]: unknown
}
```

- [ ] **Step 3: Add DIRECTORY branch in `renderField()`**

In `renderField()` (line 118), add the DIRECTORY check **before** the existing `REFERENCE_DOMAIN_KINDS` check. The new code goes between `const renderField = () => {` (line 118) and `const resolved = resolveAttributeDomain(attribute)` (line 119):

```ts
  const renderField = () => {
    if (dataType === 'DIRECTORY') {
      const resolved = resolveAttributeDomain(attribute)
      if (resolved) {
        const searchUrl = getUniversalDirectoriesUrl(
          resolved.domain,
          resolved.typeCode
        )

        return (
          <DictField
            {...commonProps}
            searchUrl={searchUrl}
            disabled={disabled}
            searchParams={{ isHierarchical: 'false', ...searchParams }}
            selectOptions={(response) => {
              const entries = response.data as DictionaryEntry[]
              return entries.map(
                (entry): SelectOption => ({
                  id: entry.id,
                  code: entry.code ?? '',
                  label:
                    entry.displayName ||
                    (language === 'kz'
                      ? entry.nameKz || entry.nameRu
                      : entry.nameRu) ||
                    '',
                  raw: entry as unknown as Record<string, unknown>,
                })
              )
            }}
          />
        )
      }
    }

    const resolved = resolveAttributeDomain(attribute)
    // ... existing REFERENCE_DOMAIN_KINDS check continues unchanged
```

- [ ] **Step 4: Verify the app compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/form-renderer/ui/field-node.tsx
git commit -m "feat: add DIRECTORY dataType support in form-renderer"
```

---

### Task 4: Manual smoke test

- [ ] **Step 1: Verify DIRECTORY field renders**

Run `npm run dev`, navigate to a form that has a `dataType: "DIRECTORY"` attribute (e.g., a hierarchical dictionary entry form with "Parent" field). Confirm:

1. The field renders as an autocomplete input
2. Typing triggers search via `/api/universaldomain-directories/{domain}/{typeCode}?isHierarchical=false&q=...`
3. Results display with correct names
4. Selecting a result sets the field value
5. No "Show All" or "Add" buttons appear in the dropdown footer

- [ ] **Step 2: Verify existing DictField still works**

Navigate to a form with a regular reference field (non-DIRECTORY). Confirm:

1. Autocomplete still works via `/api/universaldomain-entries/{domain}/{typeCode}/search`
2. "Show All" and "Add" buttons still appear
3. No regressions

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: directory field adjustments from smoke test"
```
