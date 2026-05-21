# AI Button — генерация UI конфигов по запросу

**Дата:** 2026-05-14

## Суть

Добавить кнопку "AI" в тулбары форм документов и справочников. Кнопка запускает генерацию UI-конфигурации (раскладки полей) через Claude AI. Текущее поведение — автоматическая генерация при отсутствии конфига — заменяется на генерацию по запросу пользователя.

## Серверные изменения (form-configs-server)

### GET `/api/configs/:name` — read-only

- Query params: `type` (default: `documents`), `domain` (опционально, для справочников)
- Конфиг есть на диске → 200, возвращает JSON
- Конфига нет → 404
- **Убираем** автоматическую генерацию из GET (текущее поведение)

### POST `/api/configs/:name` — новый эндпоинт

- Query params: `type` (default: `documents`), `domain` (опционально, для справочников)
- Генерирует конфиг через Claude AI (существующая логика `generateConfig()`)
- Перезаписывает файл на диске если уже существовал
- Возвращает сгенерированный конфиг (200)
- Ошибка генерации → 500

## Фронтенд — фича `generate-form-config`

### Структура

```
src/features/generate-form-config/
├── index.ts                             # export { AiButton }
├── ui/
│   ├── ai-button.tsx                    # Градиентная кнопка "AI"
│   └── regenerate-confirm-modal.tsx     # Модалка подтверждения
├── api/
│   └── generate-form-config.ts          # POST запрос
└── lib/
    └── hooks/
        └── use-generate-form-config.ts  # useMutation + логика
```

### Компонент `AiButton`

Единственный публичный экспорт фичи.

**Props:**
- `moduleCode: string` — код модуля (из URL)
- `type: 'documents' | 'dictionaries'`
- `domain?: string` — для справочников
- `configExists: boolean` — есть ли конфиг с сервера
- `onSuccess: () => void` — колбэк после генерации

**Внешний вид:**
- Градиентная кнопка (purple, `linear-gradient(135deg, #6366f1, #8b5cf6)`)
- Текст: "AI", белый, font-weight 600
- При загрузке: текст "AI" заменяется на спиннер, кнопка disabled
- Позиция: справа в тулбаре, непосредственно перед кнопкой "Ещё"

**Логика по клику:**
1. `configExists === false` → сразу запускает POST мутацию
2. `configExists === true` → открывает `RegenerateConfirmModal`

### Компонент `RegenerateConfirmModal`

- Заголовок: "UI конфигурация"
- Текст: "Конфигурация для данного модуля уже существует. Хотите перегенерировать?"
- Кнопки: "Перегенерировать" / "Отмена"
- "Перегенерировать" → запускает POST мутацию, закрывает модалку

### Хук `useGenerateFormConfig`

- Обёртка над `useMutation` (TanStack Query)
- POST на `formConfigsApi.post('/api/configs/:name', { type, domain })`
- `onSuccess` → вызывает переданный колбэк

### API `generateFormConfig`

- `POST /api/configs/${moduleCode}?type=${type}&domain=${domain}`
- Возвращает сгенерированный `FormConfig`

## Интеграция в страницы

### Document entry — `DocumentFormToolbar`

- Новые props: `aiButton: { moduleCode, type, configExists, onGenerateSuccess }`
- `AiButton` добавляется в правую часть тулбара (рядом с "Ещё", левее)

### Dictionary entry — инлайн-тулбар

- `AiButton` добавляется в правую часть `div`, перед `DropdownButton` "Ещё"

### `onSuccess` колбэк (обе страницы)

- Вызывает `queryClient.invalidateQueries({ queryKey: ['form-configs', ...] })`
- `useOptionalFormConfig` перезапрашивает конфиг → форма перерисовывается с новой раскладкой

### Определение `configExists`

- `useOptionalFormConfig` использует `useQuery` с `retry: false` — при 404 `data` остаётся `undefined`, хук возвращает `config: null`
- Страница использует `config ?? buildFallbackConfig(...)` для рендера
- `configExists = config !== null` — передаётся в `AiButton`

## Что не меняется

- `useOptionalFormConfig` — хук остаётся как есть, GET-запрос при маунте
- `buildFallbackConfig` — fallback раскладка сохраняется
- Рендеринг формы по конфигу — без изменений
- Типы `FormConfig`, `FormNode` и т.д. — без изменений
