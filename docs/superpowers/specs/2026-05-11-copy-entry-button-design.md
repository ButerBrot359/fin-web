# Copy Entry Button — Design Spec

## Context

В CRM-системе отсутствует возможность копирования записей. Пользователям приходится создавать записи заново вручную. Нужно добавить кнопку "Копировать" в тулбары списков документов, справочников и сайдбара справочников. Бэкенд-эндпоинты будут реализованы отдельно на Java Spring Boot.

## Scope

Кнопка "Копировать" добавляется в 3 места:
1. `DocumentListToolbar` — тулбар списка документов
2. `DictionaryListToolbar` — тулбар списка справочников
3. `DictSidebarListView` — сайдбар справочников (встроенный список)

## API

### Справочники (Universal Domain)
```
POST /api/universaldomain-entries/{domain}/id/{id}/copy
Response: 201 Created
{
  "data": { ...скопированная запись (DictEntry)... },
  "success": true
}
```

### Документы
```
POST /api/document-entries/{typeCode}/{id}/copy
Response: 201 Created
{
  "data": { ...скопированная запись (DocumentEntry)... },
  "success": true
}
```

Оба эндпоинта не принимают body — бэкенд сам копирует все поля и генерирует новый ID/code.

## Фронтенд-реализация

### 1. API-функции

**`src/features/dict-sidebar/api/dict-sidebar-api.ts`** — добавить:
```ts
export const copyDictEntry = (domain: string, id: number) =>
  apiService.post<ApiResponse<DictEntry>>({
    url: `${getUniversalEntryByIdUrl(domain, id)}/copy`,
  })
```

**`src/entities/document-entry/api/document-entry.ts`** — добавить:
```ts
export const copyDocumentEntry = (typeCode: string, id: number) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${typeCode}/${id}/copy`,
  })
```

### 2. Кнопка в тулбарах

Во всех трёх местах кнопка добавляется рядом с кнопкой "Редактировать" / "Выбрать".

Паттерн:
```tsx
<Button
  variant="secondary"
  disabled={selectedRowId == null || copyMutation.isPending}
  onClick={() => copyMutation.mutate(selectedRowId!)}
>
  {t('actions.copy')}
</Button>
```

### 3. Мутации и инвалидация

#### DocumentListToolbar
```ts
const copyMutation = useMutation({
  mutationFn: (id: number) => copyDocumentEntry(moduleCode, id),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['document-entries', moduleCode] })
    showToast('success', t('actions.copied'))
  },
  onError: () => {
    showToast('error', t('actions.copyError'))
  },
})
```

#### DictionaryListToolbar
```ts
const copyMutation = useMutation({
  mutationFn: (id: number) => copyDictEntry(domain, id),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['dict-entries', domain, moduleCode] })
    void queryClient.invalidateQueries({ queryKey: ['dict-sidebar-entries', domain, moduleCode] })
    void queryClient.invalidateQueries({ queryKey: ['dictionary-search'] })
    showToast('success', t('actions.copied'))
  },
  onError: () => {
    showToast('error', t('actions.copyError'))
  },
})
```

#### DictSidebarListView
```ts
const copyMutation = useMutation({
  mutationFn: (id: number) => copyDictEntry(panel.domain, id),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['dict-sidebar-entries', panel.domain, panel.typeCode] })
    void queryClient.invalidateQueries({ queryKey: ['dictionary-search'] })
    void queryClient.invalidateQueries({ queryKey: ['document-entries'] })
    void queryClient.invalidateQueries({ queryKey: ['document-entry'] })
    showToast('success', t('actions.copied'))
  },
  onError: () => {
    showToast('error', t('actions.copyError'))
  },
})
```

### 4. Переводы

**`src/app/config/i18n/locales/ru/common.json`** — в секцию `"actions"`:
```json
"copy": "Копировать",
"copied": "Запись скопирована",
"copyError": "Ошибка копирования"
```

**`src/app/config/i18n/locales/kz/common.json`** — аналогичные ключи на казахском.

### 5. Поведение

1. Кнопка **заблокирована** по умолчанию (`disabled`)
2. При выборе строки в списке — кнопка **разблокируется**
3. При клике — отправляется POST-запрос на копирование
4. Во время запроса кнопка **снова блокируется** (`isPending`)
5. При успехе — инвалидация queries + тост "Запись скопирована"
6. При ошибке — тост "Ошибка копирования"
7. Пользователь **остаётся на месте** (без навигации)

## Файлы для изменения

| Файл | Что делать |
|------|-----------|
| `src/features/dict-sidebar/api/dict-sidebar-api.ts` | Добавить `copyDictEntry` |
| `src/entities/document-entry/api/document-entry.ts` | Добавить `copyDocumentEntry` |
| `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx` | Добавить кнопку + мутацию |
| `src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx` | Добавить кнопку + мутацию |
| `src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx` | Добавить кнопку + мутацию |
| `src/app/config/i18n/locales/ru/common.json` | Добавить ключи переводов |
| `src/app/config/i18n/locales/kz/common.json` | Добавить ключи переводов |

## Верификация

1. Открыть список документов → выбрать строку → кнопка "Копировать" разблокирована → клик → тост + список обновлён
2. Открыть список справочников → аналогично
3. Открыть сайдбар справочника → аналогично
4. Проверить, что без выбранной строки кнопка заблокирована
5. Проверить, что во время запроса кнопка заблокирована (isPending)
6. Проверить ошибку (бэк вернёт 500) — тост с ошибкой
