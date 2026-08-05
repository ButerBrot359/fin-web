# SCRUM-291 · срез 2a — транспорт `SEARCH` для SDUI-списка (дизайн)

Дата: 2026-08-05. Родитель: [roadmap SCRUM-291](2026-08-05-scrum-291-frontend-migration-roadmap-design.md), п.2.
Источник контракта: `specs-local/scrum-291-perevod-ekranov-na-sdui/frontend-spec-list-form.md` §5, §1.
Тип: имплементационный дизайн одного среза. Терминал — `writing-plans`.

## Проблема

Экран SDUI-списка сейчас умеет только `PAGED`-транспорт: `fetchListPage` шлёт `GET url?params&page&size`.
Бэк-контракт Phase 2a вводит вторую форму `source` — `SEARCH`:

```jsonc
// PAGED (дефолт, ключей method/body НЕТ вовсе)
{ "url": ".../paged", "params": { "sortAttr": "Data", "sortDir": "DESC" } }

// SEARCH (Phase 2a+)
{ "url": ".../search", "method": "POST",
  "params": { "sortAttr": "Data", "sortDir": "DESC" },
  "body": { "filters": [], "logic": "AND" } }
```

`SEARCH` — фундамент для сортировки (2b), фильтров (2c) и периода (2d): все они меняют `params`/`body`
и требуют POST-транспорта. `SEARCH`-тракт возвращает `Slice`, а не `Page` → в ответе **нет**
`totalElements`.

## Четыре обязательных пункта (§5)

Все четыре — на фронте, все обязательные. Пока они не в проде, бэк не флипает `transport:SEARCH`.

### 1. POST-ветка в `fetchListPage` (`src/features/sdui/api/reference-options.ts`)

- Аргументы += `method?: string`, `body?: unknown`.
- `method === 'POST'` → `apiService.post({ url, params: {...params, page, size, ...search}, data: body ?? {}, signal })`.
- Иначе — GET как сейчас (обратная совместимость с `PAGED`).
- `PagedListResponse.data.totalElements` → сделать опциональным (`Slice` его не отдаёт);
  `last`/`number` у `Slice` есть — пагинация (`getNextPageParam`) не меняется.

`apiService.post({ url, data, params, signal, timeout })` уже существует (`src/shared/api/api.ts`).

### 2. `queryKey` += `method`, `body` (`src/features/sdui/ui/nodes/composite/list-node.tsx`)

- `ListSource` += `method?: string`, `body?: unknown`; пробросить оба в `fetchListPage`.
- `queryKey`: `['sdui-list', url, params, method, body, search]`.
- Обоснование: 2b/2c/2d меняют `body`/`params`; без них в ключе TanStack Query не рефетчит при
  смене фильтра/сортировки/периода — список молча остаётся старым.

### 3. Видимая ветка `isError` (`list-node.tsx`)

- Достать `isError` из `useInfiniteQuery`.
- Ветка ошибки — **после** `isLoading`, **до** пустого списка: `isError` → видимый текст
  (`t('table.loadError')`), не «Нет данных».
- Почему обязательно: сегодня ветки `isError` нет вовсе — любая 400/500/сеть выглядит как пустой
  список. Это и есть механизм ловушки порядка деплоя (см. ниже).

### 4. Счётчик без `total` (`list-node.tsx`)

- `totalElements` — число → `t('table.loadedCount', {loaded, total})` («Загружено N из M»).
- `totalElements` отсутствует (`Slice`) → `t('table.loadedCountNoTotal', {loaded})` («Загружено N»).

### i18n (`ru` + `kz`, `src/app/config/i18n/locales/*/common.json`)

- `table.loadError` — «Не удалось загрузить данные» / KZ.
- `table.loadedCountNoTotal` — «Загружено {{loaded}}» / KZ.

## Строгий порядок деплоя (§5, критично)

**Фронт с пунктами 1–4 уходит в прод РАНЬШЕ, чем бэк флипает `transport:SEARCH`.**

На пути `/api/document-entries/{typeCode}/search` висят два маппинга: наш `POST` (данные) и легаси
`GET` с обязательным `q`. Если бэк включит `SEARCH` до фронт-дельты — старый фронт пошлёт
`GET …/search?…` без `q` → матч легаси-маппингом → **400**. Без пункта 3 (`isError`) 400 не виден:
UI показывает «Нет данных», пользователь сообщает «документы пропали» — диагностировать по жалобе
крайне тяжело. Обратный порядок безопасен: фронт умеет POST, бэк на `PAGED` `method` не шлёт → GET.

Флип флага — не наш коммит; предупреждение фиксируется в описании PR/коммита для бэка.

## Границы среза

- НЕ трогаем сам UI сортировки/фильтров/периода (это 2b/2c/2d) — только транспорт, который их понесёт.
- НЕ трогаем `PAGED`-путь по существу (только расширяем сигнатуру обратносовместимо).
- НЕ трогаем свободный поиск документов (его нет и в легаси — §10 спеки).

## План тестов (TDD)

1. **`reference-options.test.ts`** (новый) — ядро транспорта, основная ценность:
   - `method:'POST'` → `apiService.post` вызван с `data: body` и `params` c `page`/`size`.
   - без `method` → `apiService.get`, `body` не уходит (регресс `PAGED`).
2. **`list-node.test.tsx`** (новый) — мок `useInfiniteQuery`/`fetchListPage`:
   - `isError:true` → виден `table.loadError`, не «нет данных».
   - `totalElements` отсутствует → счётчик берёт `loadedCountNoTotal`.
   - Если виртуализатор в jsdom мешает data-ветке — выбор ключа счётчика вынести в чистый хелпер
     (`formatLoadedCountKey`) и покрыть его юнит-тестом вместо рендера таблицы.

## DoD (§11, прувпойнт 2a)

- Флип `transport:SEARCH` не меняет видимый порядок/состав первой страницы на пустом фильтре.
- Ошибка загрузки видна пользователю (не «Нет данных»).
- Счётчик показывает «Загружено N» без «из M».
