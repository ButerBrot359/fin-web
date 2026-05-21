# AI Button — Form Config Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI button to document and dictionary form toolbars that triggers on-demand UI config generation, replacing the current auto-generation on GET.

**Architecture:** Server GET endpoint becomes read-only (returns config or 404). New POST endpoint handles generation. New `features/generate-form-config` FSD feature contains AiButton, confirmation modal, mutation hook, and API call. Both entry pages integrate AiButton into their toolbars.

**Tech Stack:** React 19, TypeScript, TanStack Query (useMutation), MUI Dialog, Express.js, Anthropic SDK

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `form-configs-server/src/index.ts` | Split GET into read-only, add POST endpoint |
| Create | `src/features/generate-form-config/api/generate-form-config.ts` | POST API call |
| Create | `src/features/generate-form-config/lib/hooks/use-generate-form-config.ts` | useMutation wrapper |
| Create | `src/features/generate-form-config/ui/regenerate-confirm-modal.tsx` | Confirmation dialog |
| Create | `src/features/generate-form-config/ui/ai-button.tsx` | Gradient AI button component |
| Create | `src/features/generate-form-config/index.ts` | Barrel export |
| Modify | `src/shared/api/form-configs-api.ts` | Add `post` method |
| Modify | `src/app/config/i18n/locales/ru/common.json` | Add i18n keys |
| Modify | `src/app/config/i18n/locales/kz/common.json` | Add i18n keys |
| Modify | `src/widgets/document-form-toolbar/ui/document-form-toolbar.tsx` | Integrate AiButton |
| Modify | `src/pages/documents/documents-entry/ui/document-entry-page.tsx` | Pass AI props to toolbar |
| Modify | `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx` | Add AiButton to inline toolbar |

---

### Task 1: Server — Make GET read-only, add POST endpoint

**Files:**
- Modify: `form-configs-server/src/index.ts:39-63`

- [ ] **Step 1: Modify GET endpoint to return 404 when config not found**

Replace the GET handler (lines 39–63) with a read-only version:

```typescript
app.get('/api/configs/:name', async (req, res) => {
  const type =
    typeof req.query.type === 'string' && VALID_TYPES.has(req.query.type)
      ? req.query.type
      : 'documents'
  const dir = getTypeDir(type)
  const filePath = path.join(dir, `${req.params.name}.json`)

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    res.json(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    res.status(404).json({ error: `Config "${req.params.name}" not found` })
  }
})
```

- [ ] **Step 2: Add POST endpoint for config generation**

Add this after the GET handler:

```typescript
app.post('/api/configs/:name', async (req, res) => {
  const type =
    typeof req.query.type === 'string' && VALID_TYPES.has(req.query.type)
      ? req.query.type
      : 'documents'
  const domain =
    typeof req.query.domain === 'string' ? req.query.domain : undefined

  try {
    const config = await generateConfig(req.params.name, type, domain)
    res.json(config)
  } catch (err) {
    console.error(`Generation failed for ${req.params.name}:`, err)
    res.status(500).json({
      error: `Generation failed for "${req.params.name}"`,
    })
  }
})
```

- [ ] **Step 3: Verify server starts**

Run:
```bash
cd form-configs-server && npm run build
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add form-configs-server/src/index.ts
git commit -m "feat: split GET into read-only, add POST endpoint for config generation"
```

---

### Task 2: Add `post` method to `formConfigsApi`

**Files:**
- Modify: `src/shared/api/form-configs-api.ts`

- [ ] **Step 1: Add post method**

Add a `post` function alongside the existing `get`, and export it. The full file should become:

```typescript
import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import type { RequestConfig } from '@/shared/types/api.types'

const instance = axios.create({
  baseURL: import.meta.env.VITE_FORM_CONFIGS_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const makeRequest = <T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> =>
  instance.request<T>(config).catch((error: unknown) => {
    if (error instanceof AxiosError) {
      throw error.response?.data
    }
    throw error
  })

const get = <T = unknown>({ url, params, signal }: RequestConfig) =>
  makeRequest<T>({ method: 'GET', url, params, signal })

const post = <T = unknown>({ url, params }: RequestConfig) =>
  makeRequest<T>({ method: 'POST', url, params })

export const formConfigsApi = {
  get,
  post,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/api/form-configs-api.ts
git commit -m "feat: add post method to formConfigsApi"
```

---

### Task 3: Add i18n keys

**Files:**
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`

- [ ] **Step 1: Add Russian translation keys**

Add a new `"aiConfig"` section after the `"workspaceTabs"` section in `ru/common.json`:

```json
"aiConfig": {
  "title": "UI конфигурация",
  "regenerateMessage": "Конфигурация для данного модуля уже существует. Хотите перегенерировать?",
  "regenerate": "Перегенерировать",
  "generateError": "Ошибка генерации конфигурации"
}
```

- [ ] **Step 2: Add Kazakh translation keys**

Add the same section in `kz/common.json`:

```json
"aiConfig": {
  "title": "UI конфигурациясы",
  "regenerateMessage": "Бұл модуль үшін конфигурация бұрыннан бар. Қайта генерациялағыңыз келе ме?",
  "regenerate": "Қайта генерациялау",
  "generateError": "Конфигурация генерациясының қатесі"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: add i18n keys for AI config generation"
```

---

### Task 4: Create API function `generateFormConfig`

**Files:**
- Create: `src/features/generate-form-config/api/generate-form-config.ts`

- [ ] **Step 1: Create the API file**

```typescript
import { formConfigsApi } from '@/shared/api/form-configs-api'

import type { FormConfig } from '@/entities/form-config'

interface GenerateFormConfigParams {
  moduleCode: string
  type?: string
  domain?: string
}

export const generateFormConfig = ({
  moduleCode,
  type,
  domain,
}: GenerateFormConfigParams) =>
  formConfigsApi.post<FormConfig>({
    url: `/api/configs/${moduleCode}`,
    params: { type, domain },
  })
```

- [ ] **Step 2: Commit**

```bash
git add src/features/generate-form-config/api/generate-form-config.ts
git commit -m "feat: add generateFormConfig API function"
```

---

### Task 5: Create `useGenerateFormConfig` hook

**Files:**
- Create: `src/features/generate-form-config/lib/hooks/use-generate-form-config.ts`

- [ ] **Step 1: Create the mutation hook**

```typescript
import { useMutation } from '@tanstack/react-query'

import { generateFormConfig } from '../../api/generate-form-config'

interface UseGenerateFormConfigParams {
  moduleCode: string
  type?: string
  domain?: string
  onSuccess: () => void
}

export const useGenerateFormConfig = ({
  moduleCode,
  type,
  domain,
  onSuccess,
}: UseGenerateFormConfigParams) =>
  useMutation({
    mutationFn: () => generateFormConfig({ moduleCode, type, domain }),
    onSuccess,
  })
```

- [ ] **Step 2: Commit**

```bash
git add src/features/generate-form-config/lib/hooks/use-generate-form-config.ts
git commit -m "feat: add useGenerateFormConfig mutation hook"
```

---

### Task 6: Create `RegenerateConfirmModal`

**Files:**
- Create: `src/features/generate-form-config/ui/regenerate-confirm-modal.tsx`

- [ ] **Step 1: Create the modal component**

Follow the same pattern as `UnsavedChangesDialog` (MUI Dialog, same styling):

```tsx
import { Dialog } from '@mui/material'
import { useTranslation } from 'react-i18next'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'

interface RegenerateConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const RegenerateConfirmModal = ({
  open,
  onConfirm,
  onCancel,
}: RegenerateConfirmModalProps) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '40px',
            boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
            p: 0,
            m: 0,
            minWidth: 660,
            maxWidth: 'none',
          },
        },
      }}
    >
      <div className="flex flex-col gap-8 px-15 py-10">
        <div className="flex w-full items-center gap-6">
          <h2 className="flex-1 text-[26px] font-bold leading-normal text-ui-06">
            {t('aiConfig.title')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-base font-medium text-ui-06">
          {t('aiConfig.regenerateMessage')}
        </p>

        <div className="flex w-full gap-3">
          <Button
            variant="primary"
            onClick={onConfirm}
            className="flex-1 rounded-lg"
          >
            {t('aiConfig.regenerate')}
          </Button>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1 rounded-lg"
          >
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/generate-form-config/ui/regenerate-confirm-modal.tsx
git commit -m "feat: add RegenerateConfirmModal component"
```

---

### Task 7: Create `AiButton`

**Files:**
- Create: `src/features/generate-form-config/ui/ai-button.tsx`

- [ ] **Step 1: Create the AiButton component**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircularProgress } from '@mui/material'

import { showToast } from '@/shared/ui/toast/show-toast'

import { useGenerateFormConfig } from '../lib/hooks/use-generate-form-config'
import { RegenerateConfirmModal } from './regenerate-confirm-modal'

interface AiButtonProps {
  moduleCode: string
  type: 'documents' | 'dictionaries'
  domain?: string
  configExists: boolean
  onSuccess: () => void
}

export const AiButton = ({
  moduleCode,
  type,
  domain,
  configExists,
  onSuccess,
}: AiButtonProps) => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { mutate, isPending } = useGenerateFormConfig({
    moduleCode,
    type,
    domain,
    onSuccess,
  })

  const handleClick = () => {
    if (configExists) {
      setIsModalOpen(true)
    } else {
      mutate(undefined, {
        onError: () => {
          showToast('error', t('aiConfig.generateError'))
        },
      })
    }
  }

  const handleConfirmRegenerate = () => {
    setIsModalOpen(false)
    mutate(undefined, {
      onError: () => {
        showToast('error', t('aiConfig.generateError'))
      },
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="flex min-w-[56px] cursor-pointer items-center justify-center rounded-md px-5 py-2.5 text-body2 font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          background: isPending
            ? 'linear-gradient(135deg, #818cf8, #a78bfa)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        }}
      >
        {isPending ? (
          <CircularProgress size={16} sx={{ color: 'white' }} />
        ) : (
          'AI'
        )}
      </button>

      <RegenerateConfirmModal
        open={isModalOpen}
        onConfirm={handleConfirmRegenerate}
        onCancel={() => setIsModalOpen(false)}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/generate-form-config/ui/ai-button.tsx
git commit -m "feat: add AiButton component with gradient style and spinner"
```

---

### Task 8: Create barrel export

**Files:**
- Create: `src/features/generate-form-config/index.ts`

- [ ] **Step 1: Create the barrel file**

```typescript
export { AiButton } from './ui/ai-button'
```

- [ ] **Step 2: Commit**

```bash
git add src/features/generate-form-config/index.ts
git commit -m "feat: add generate-form-config barrel export"
```

---

### Task 9: Integrate AiButton into DocumentFormToolbar

**Files:**
- Modify: `src/widgets/document-form-toolbar/ui/document-form-toolbar.tsx`
- Modify: `src/pages/documents/documents-entry/ui/document-entry-page.tsx`

- [ ] **Step 1: Add AiButton props and render in toolbar**

In `document-form-toolbar.tsx`, add a new prop to `DocumentFormToolbarProps` and render `AiButton` in the right section next to "Ещё":

Add import at top:
```typescript
import { AiButton } from '@/features/generate-form-config'
```

Add to the interface:
```typescript
interface AiButtonConfig {
  moduleCode: string
  type: 'documents' | 'dictionaries'
  configExists: boolean
  onSuccess: () => void
}

interface DocumentFormToolbarProps {
  isNew?: boolean
  isDirty?: boolean
  actions: DocumentFormActions
  print: DocumentFormPrint
  onMovements?: () => void
  aiButton: AiButtonConfig
}
```

Update the component destructuring to include `aiButton`, and replace the right-side `DropdownButton` with a flex container containing both AiButton and DropdownButton:

```tsx
<div className="flex items-center gap-2">
  <AiButton
    moduleCode={aiButton.moduleCode}
    type={aiButton.type}
    configExists={aiButton.configExists}
    onSuccess={aiButton.onSuccess}
  />
  <DropdownButton label={t('documentFormToolbar.more')} />
</div>
```

- [ ] **Step 2: Pass aiButton props from DocumentEntryPage**

In `document-entry-page.tsx`, add import and pass the new prop:

Add import:
```typescript
import { useQueryClient } from '@tanstack/react-query'
```

Inside `DocumentEntryPage`, add after the existing hooks:
```typescript
const queryClient = useQueryClient()

const handleAiSuccess = () => {
  void queryClient.invalidateQueries({
    queryKey: ['form-configs', undefined, moduleCode],
  })
}
```

Update the `<DocumentFormToolbar>` JSX to pass `aiButton`:
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
  }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/widgets/document-form-toolbar/ui/document-form-toolbar.tsx src/pages/documents/documents-entry/ui/document-entry-page.tsx
git commit -m "feat: integrate AiButton into document form toolbar"
```

---

### Task 10: Integrate AiButton into Dictionary entry page

**Files:**
- Modify: `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx`

- [ ] **Step 1: Add AiButton to the inline toolbar**

Add import at top:
```typescript
import { AiButton } from '@/features/generate-form-config'
```

Add a handler inside `DictionaryEntryPage` (the component already has `queryClient` from existing code):
```typescript
const handleAiSuccess = () => {
  void queryClient.invalidateQueries({
    queryKey: ['form-configs', 'dictionaries', moduleCode],
  })
}
```

Replace the toolbar `div` (lines 329–341) to use `justify-between` layout with AI button and "Ещё" on the right:

```tsx
<div className="flex items-center justify-between pb-3">
  <div className="flex items-center gap-2">
    <Button
      variant="primary"
      disabled={isSaving}
      onClick={handleSaveAndClose}
    >
      {t('dictSidebar.saveAndClose')}
    </Button>
    <Button variant="secondary" disabled={isSaving} onClick={handleSave}>
      {t('dictSidebar.save')}
    </Button>
  </div>
  <div className="flex items-center gap-2">
    <AiButton
      moduleCode={moduleCode}
      type="dictionaries"
      domain={domain}
      configExists={config !== null}
      onSuccess={handleAiSuccess}
    />
    <DropdownButton label={t('actions.more')} disabled />
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx
git commit -m "feat: integrate AiButton into dictionary entry toolbar"
```

---

### Task 11: Manual verification

- [ ] **Step 1: Start the form-configs server**

```bash
cd form-configs-server && npm run dev
```

- [ ] **Step 2: Start the frontend dev server**

```bash
npm run dev
```

- [ ] **Step 3: Test document entry page**

1. Open a document entry page that HAS an existing config (e.g. `PrikhodnyyKassovyyOrder`)
2. Verify the form renders with the AI-generated layout
3. Click the AI button → modal should appear asking to regenerate
4. Click "Отмена" → modal closes, nothing changes
5. Click AI again → "Перегенерировать" → button shows spinner, then form refreshes with new layout

- [ ] **Step 4: Test document entry with no config**

1. Open a document entry page that has NO config on the server
2. Verify the form renders with fallback layout (vertical stack)
3. Click the AI button → no modal, spinner appears immediately
4. After generation completes, form refreshes with the generated layout

- [ ] **Step 5: Test dictionary entry page**

1. Open a dictionary entry page
2. Repeat the same tests as steps 3-4 above
3. Verify the AI button and "Ещё" are on the right side of the toolbar
