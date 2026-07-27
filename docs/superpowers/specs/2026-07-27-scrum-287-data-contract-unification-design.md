# SCRUM-287 — унификация контрактов данных: убрать фронтовые фолбэки (A5/A6 + A7)

**Тикет:** [SCRUM-287 «Унификация контрактов данных»](https://sulubaiguskarova.atlassian.net/browse/SCRUM-287)
**Дата дизайна:** 2026-07-27
**Источники правды:** два бэкенд-хендовера в `specs-local/scrum-287-unifikatsiya-kontraktov/`:
- `frontend-spec-data-contract-dropdown.md` (A5/A6) — единый контракт дропдауна, `presentation` обязателен.
- `frontend-spec-restrictive-defaults.md` (A7) — флип разрешающих дефолтов на запрещающие.

Обе — чистый фронт-cleanup: бэк уже соответствует (A7 дополнительно защищён CI-гейтом). Убираем мёртвые компенсаторы и разрешающие дефолты, кодирующие знание модели.

## Контекст

SDUI: сервер — источник истины. Раньше фронт «угадывал» формат данных (пагинация content/items, поле презентации presentation/name/nameRu/…) и подставлял разрешающие дефолты (editable/allow*/domain/presentation). Теперь бэк присылает контракт явно и всегда → фронтовые запасные сценарии становятся мёртвым кодом, который надо убрать. Принцип A7: забытый бэком проп → **видимый** отказ (кнопки нет), а не тихая дыра (можно удалять).

Все правки — только `src/features/sdui`. Изоляция SDUI↔легаси не нарушается. Новых gateway нет.

---

## Часть 1 — единый контракт дропдауна (A5/A6)

### 1.1. `api/reference-options.ts`
- Убрать мёртвый `?? res.data.items`:
  ```ts
  const items = res.data.content ?? res.data.items ?? []   // было
  const items = res.data.content ?? []                     // стало
  ```
  Ни один SDUI-эндпоинт не возвращает `items` — ветка недостижима.
- Схлопнуть каскад презентации:
  ```ts
  label: item.presentation ?? item.name ?? String(item.id),  // было
  label: item.presentation ?? String(item.id),               // стало
  ```
  `?? item.name` убрать (знание модели). `?? String(item.id)` оставить — тривиальный тех-предохранитель от битого ответа, не знание модели.
- Из типа `EntriesResponse` убрать `items?` (оставить только `content?`).

### 1.2. `ui/nodes/composite/list-node.tsx:149` (фаза 2 A6, бэк готов)
Строки `/paged` теперь несут готовый `presentation` (never-empty). Каскад убрать:
```ts
return (obj.presentation ?? obj.displayName ?? obj.nameRu ?? obj.name ?? String(obj.id ?? '')) as string  // было
return (obj.presentation ?? String(obj.id ?? '')) as string                                               // стало
```
`displayName`/`nameRu`/`name` — поля модели, убрать; `?? String(obj.id)` — оставить.

---

## Часть 2 — запрещающие дефолты (A7)

### 2.1. `ui/nodes/composite/table-node.tsx:138` — `editable`
```ts
const editable = (node.props?.editable as boolean | undefined) ?? true  // было
const editable = node.props?.editable === true                          // стало
```
Бэк эмитит `editable` на всех TABLE (ТЧ → true; movements/related → false).

### 2.2. `editable-table.tsx:36-38` и `complex-editable-table.tsx:50-52` — триада `allow*`
```ts
const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? true       // было (×3)
const allowAdd = node.props?.allowAdd === true                               // стало (×3)
// то же для allowDelete, allowReorder
```
Бэк эмитит триаду на каждой редактируемой ТЧ. Read-only таблицы триаду не несут → `=== true` даёт `false` (кнопки не рендерятся) — корректное read-only-поведение. `complex-editable-table.tsx:208` `allowReorder && !isMasterDetail` — логику не трогаем, меняется только источник `allowReorder`.

### 2.3. `ui/nodes/fields/reference-field-node.tsx:38` — `domain` (с обработкой downstream)
```ts
const domain = (node.props?.domain as string | undefined) ?? 'DICTIONARY'  // было
const domain = node.props?.domain as string | undefined                    // стало
```
Downstream (в этом же файле) требует правок, т.к. `domain` теперь может быть `undefined`:
- Стр. 61 `DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'` → guard индексации: `const domainPath = domain ? (DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries') : 'dictionary-entries'` (при пустом domain работает legacy-путь; но приоритет всё равно у `optionsSource.url` с бэка — дропдаун грузится).
- `openReferencePicker({ domain, … })` (стр. 115/125/196): пикер вызывается только по `canBrowse` (targetTypeCode есть). Передать `domain` как есть; проверить тип `domain` в интерфейсе gateway `openReferencePicker`/`reference-picker-gateway` — если он `string`, расширить до `string | undefined` (по спеке: пустой domain → пикер может не открыться, но это видимый отказ, не подстановка модели). НЕ подставлять `'DICTIONARY'`.

### 2.4. `lib/open-dialog-panel.ts:13` — `presentation` (резерв + dev-warn)
```ts
const presentation = (props?.presentation as string) ?? 'modal'  // было
// стало:
const presentation = props?.presentation as string | undefined
if (import.meta.env.DEV && !presentation) {
  console.warn('[sdui] openDialog без presentation — баг бэк-композера (A7)', effect.node?.id)
}
// ... presentation: (presentation ?? 'modal') as 'drawer' | 'modal' | 'page',
```
**Решение (с учётом SDUI):** `presentation` — режим отрисовки, не разрешение; забытый presentation не создаёт дыру (максимум диалог в неверном режиме). Полное удаление ломает обязательный тип `PanelEntry.presentation` и просто переносит дефолт в рендерер панели (где он менее заметен). Оставляем `?? 'modal'` как **явный последний резерв** + `console.warn` в dev — забытый presentation становится «заметен» (намерение владельца A7) без хирургии типов и без риска в проде. Спека §1.4 резерв разрешает.

---

## Границы (не трогаем)

- Тех-предохранители `?? String(item.id)` / `?? String(obj.id)` — оставляем (не знание модели).
- `cell-value.ts` / `accounting-block-logic.ts` (`presentation ?? ''`) — уже соответствуют.
- `table-node.tsx:170-171` (ReadOnlyTable `allowAdd`/`allowDelete` без дефолта) — уже `undefined`→falsy, мёртвый путь, не трогаем.
- Конверт account-plan `{list, …}` — легаси-поле, фронт читает `content`, бэк не трогаем.
- Регистр бухгалтерии: `presentation` = голый `id` (нет естественного имени) — на контракт не влияет, follow-up бэка.

---

## Тесты и критерии приёмки

**Тесты (Vitest):** существующие тесты `reference-options`/`use-reference-options`, `table-node`, `editable-table`, `complex-editable-table`, `reference-field-node`, `open-dialog-panel` — моки перевести на явные props (бэк теперь всегда шлёт): ответ `{content, totalSize}` со строками `{id, presentation}`; таблицы несут `editable`/`allow*`; ссылочные поля несут `domain`; openDialog несёт `presentation`. Где полезно — добавить кейс на новое поведение (read-only таблица без триады → нет кнопок; дропдаун без `items`).

**Критерии приёмки:**
1. A5: `grep -rn "\.items\b\|?? item.name\|res.data.items" src/features/sdui/api/reference-options.ts` → пусто; `EntriesResponse` без `items`.
2. A6: дропдаун (dictionary/document/account-plan) и строки `/paged` показывают `presentation` единообразно.
3. A7: `grep -rn "?? true\|?? 'DICTIONARY'\|editable ?? \|allowAdd ?? \|allowDelete ?? \|allowReorder ?? " src/features/sdui` → в table/reference-местах пусто. (`?? 'modal'` остаётся как явный резерв с dev-warn — осознанно.)
4. Редактируемая ТЧ (ГП «График платежей», ИПН): кнопки добавить/удалить/reorder на месте — регресса нет.
5. Read-only таблица (движения, связанные документы): add/delete/reorder не появляются.
6. Ссылочное поле: дропдаун грузит опции по `optionsSource.url`; `domain` не подставляется как `'DICTIONARY'`.
7. Диалоги (drawer/page) открываются с презентацией от бэка; при отсутствии — dev-warn.
8. Все существующие sdui-тесты зелёные.

---

## Deploy-зависимость

Как A3 (SCRUM-285): fallback'ов больше нет. Бэк A5/A6/A7 уже задеплоен (A7 + CI-гейт). На старом бэке без явных props редактируемые ТЧ показались бы read-only (кнопок нет) — видимый отказ, не дыра (это и есть цель A7). Ручная e2e-приёмка — на стенде с актуальным webbuh.

## Вопрос к бэку

Если дропдаун вернёт строку без `presentation`, редактируемая ТЧ придёт без триады `allow*`, ссылочное поле без `domain`, или openDialog без `presentation` — это баг бэк-композера/нарушение CI-гейта, не повод возвращать фронтовые фолбэки. Сообщить — поправят композер.
