# SCRUM-290 — Переход на единый роутинг (Phase 2, фронт)

Дата: 2026-08-04
Тип: Задача (SDUI)
Основание: бэк-спека `frontend-spec-unified-routing.md` (задача 8 / B1, бэк Phase 1
готов и в проде, ветка `sdui-1.5`), локальный слепок —
`specs-local/scrum-290-edinyy-routing/`.

## Контекст

Сейчас фронт знает структуру URL и сам конструирует `layoutCode` серверных
конвенций (`.ФормаОбъекта`, `dict.*.OBJECT_FORM`). Бэк Phase 1 научился принимать
route-based OPEN: `layoutCode` стал необязательным, сервер сам резолвит экран по
`route`, а на немигрированные экраны отдаёт машиночитаемые ошибки. Задача Phase 2 —
перестать конструировать `layoutCode` на фронте и добавить универсальный catch-all
маршрут, не ломая ни одной работающей страницы.

Ключевой инвариант бэка: **приоритет `layoutCode > route`**. Пока страница шлёт
`layoutCode`, для неё ничего не меняется. Поэтому все шаги ниже аддитивны,
выкатываются и откатываются независимо.

## Границы (что НЕ входит — task 9 / Phase 3)

- Снос `DocumentRedirect` / `DictionaryRedirect` (мосты плоских серверных
  `navigate`-маршрутов — ловушки §5.1/5.2 бэк-спеки).
- Удаление явных `<Route>` (списки резолвятся в 422 — сломается «Записать и
  закрыть → возврат в список»).
- Полный демонтаж `resolve-page-type.ts` / `WorkspaceTabSync` / клиентского
  `TabPageType`.
- Server-driven списки, регистры, отчёты, обработки, движения.
- Снятие обработки 404-фолбэка (можно только когда **все** страницы на route-only).

## Архитектурные решения

1. **Объём:** весь §4.1–4.5 бэк-спеки за один заход.
2. **Изоляция:** `SduiCatchAllPage` + `LegacyFallback` живут в композиционном слое
   (`src/pages/`), как нынешние точки ветвления (`document-entry-page.tsx`, которая
   уже законно импортирует и SDUI, и легаси). SDUI-код легаси **не** импортирует.
   **Новый gateway не заводим** — это самый SDUI-уважающий вариант: SDUI остаётся
   чистым, вся развязка миров — в композиции.

## Дизайн по слоям

Порядок реализации: **0 → 1 → 2 → 3 → 4**. Слой 4 верифицируется отдельно и
последним (самый тонкий).

### Слой 0 — контракт ошибок в транспорте (фундамент)

`view-transport.ts`: сейчас `ViewHttpError` несёт только `status` + `message`, тело
не парсится. Расширить:

- парсить тело ошибки, добавить в `ViewHttpError` поля:
  - `code` — значение `error` (для SDUI-ошибок: `SCREEN_NOT_SDUI`, `ROUTE_UNKNOWN`)
    или `code` (для унаследованного 404 `NOT_FOUND`);
  - `kind` — из тела 422 (`DOCUMENT`, `DOCUMENT_LIST`, `DICTIONARY`, … — закрытый
    серверный enum, см. §2 бэк-спеки).
- Различение по ключу тела (`error` vs `code`) — часть контракта (§2 бэк-спеки).

### Слой 1 — §4.1 dispatch/reopen: route-only

`dispatch.ts`:

- OPEN шлёт `layoutCode` **только когда он есть** — не `null`-строкой и не пустой
  строкой (бэк трактует blank как отсутствие, но чище не слать). `route` уже
  отправляется (`location.pathname + location.search`), не трогаем.
- Гейт ошибок OPEN расширить на три ветки:
  - `404 code=NOT_FOUND` → `onOpenNotFound()` — как сейчас (легаси-фолбэк для
    страниц, ещё шлющих `layoutCode` в переходный период).
  - `422 error=SCREEN_NOT_SDUI` → `onOpenNotFound({ kind })` — **ново**: route-only
    немигрированный экран → легаси.
  - `404 error=ROUTE_UNKNOWN` → `onRouteUnknown()` — **ново**: только для catch-all
    → экран «не найдено».
- `opts` расширить: `{ onOpenNotFound?: (info?: { kind?: string }) => void,
onRouteUnknown?: () => void }`. Точки ветвления передают только `onOpenNotFound`
  (падают на легаси и по 404, и по 422); catch-all передаёт обе.

`conflict-handler.ts` / `reopen`: если `layoutCode` в сторе пуст — переоткрывать по
`{ route }`. Инвариант §4.1: маршрут между первичным OPEN и reopen не меняется,
поэтому route-only reopen резолвится в тот же экран.

### Слой 2 — §4.2 убрать конструирование `layoutCode`

- `sdui-document-page.tsx:125` — убрать `` `${moduleCode}.ФормаОбъекта` ``, снять
  проп `layoutCode`. Документная страница защищена гейтом `newView` в точке
  ветвления (`document-entry-page.tsx`) → route-only даёт 200.
- `sdui-dictionary-entry-page.tsx:104` — убрать `` `dict.${moduleCode}.OBJECT_FORM` ``,
  снять проп. Его `onOpenFailed` теперь срабатывает и на 422 `SCREEN_NOT_SDUI`
  (кейсы `?domain=ENUMS` §5.5; копирование `?copyFrom` §5.4 уже гейтится на легаси
  в `dictionary-entry-page.tsx`).
- Обновить тесты, ссылающиеся на `X.ФормаОбъекта` (`dispatch.test.ts`,
  `language-reopen.test.ts`).
- **Приёмка:** grep по `src/` на `ФормаОбъекта`/`OBJECT_FORM` пустой.

### Слой 3 — §4.3+4.4 catch-all

`App.tsx`: добавить **последним** (React Router v6 — конкретные маршруты выигрывают
по специфичности, 24 существующих роута продолжают работать):

```tsx
<Route path="*" element={<SduiCatchAllPage />} />
```

Существующие `<Route>` не удалять.

Новый композиционный компонент `src/pages/sdui-catch-all/`:

1. монтирует `SduiScreen` **без** `layoutCode` (route-only);
2. `200` → рендерит SDUI-дерево, хром вкладки берёт из `response.tab`
   (`kind`/`icon`/`closable`), заголовок как сейчас;
3. `422 SCREEN_NOT_SDUI` → `LegacyFallback` по `kind`: вложенный `<Routes>` с нужным
   паттерном, чтобы легаси-страница получила свой `useParams` (легаси не трогаем,
   реализацию не рефакторим);
4. `404 ROUTE_UNKNOWN` → экран «страница не найдена».

**Честная граница:** с 24 живыми явными роутами catch-all в Phase 2 практически
ловит только неизвестные URL → «не найдено». Ветка `422→легаси` — инфраструктура
под task 9 (реальные экраны сегодня перехватываются явными роутами, до catch-all не
доходят). Это оговорено в §3/§4.4 бэк-спеки как «честная граница, а не недоделка».

### Слой 4 — §4.5 понижение `resolve-page-type` (самый тонкий)

- В `ViewResponse` добавить `tab?: { kind: string; icon?: string; closable?: boolean }`
  (сейчас поля нет вовсе).
- Тип SDUI-вкладок теперь авторит **ответ OPEN** (`response.tab.kind →
TabPageType`), а не регекс. Снять регексы `document-entry`, `dictionary-entry`,
  `module` из `resolve-page-type.ts`. Легаси-регексы (списки, регистры, отчёты,
  движения) **остаются** — у легаси нет view-ответа, значит нет и `tab`.
- **Тонкость тайминга:** сейчас вкладка создаётся синхронно на навигации
  (`WorkspaceTabSync` → `resolvePageType(pathname)`), **до** прихода view-ответа.
  После снятия трёх регексов `resolvePageType` для этих маршрутов вернёт `null`,
  поэтому авторство SDUI-вкладки переезжает в обработку OPEN (маппинг
  `tab.kind → TabPageType`, создание/обновление вкладки через стор
  `workspace-tabs`, который в зоне «Общее» и доступен SDUI). Требует аккуратной
  сверки с redirect-потоком (`/documents/:type/new → /modules/...`, §5.1/5.2) —
  этот слой верифицируется отдельно и последним.
- `tab` защитить от `null` (§5.6: на `/` и на всех EVENT/COMMAND `tab` не приходит).

## Ловушки (из §5 бэк-спеки — соблюдаем)

- §5.1/5.2: не удалять `<Route>` списков и `DocumentRedirect`/`DictionaryRedirect`.
- §5.3: не снимать обработку 404-фолбэка, пока не все страницы на route-only.
- §5.4: копирование справочника (`?copyFrom`) → 422 → легаси (уже гейтится).
- §5.5: универсальные домены (`?domain=ENUMS|CALCULATION_PLAN|…`) → 422 → легаси.
- §5.6: `tab` бывает `null` — защищаться, не считать обязательным.

## Тестирование

- **Unit:** ветки гейта ошибок OPEN в `dispatch` (404 NOT_FOUND / 422
  SCREEN_NOT_SDUI / 404 ROUTE_UNKNOWN); парсинг тела ошибки в транспорте; маппинг
  `kind → TabPageType`; `resolve-page-type` (снятые и оставшиеся паттерны).
- **Интеграция:** route-only OPEN даёт дерево/поведение идентично текущему;
  catch-all неизвестный URL → «не найдено»; словарь `?domain=ENUMS` → легаси
  через 422.
- **Ручная приёмка (§7 бэк-спеки):**
  1. OPEN без `layoutCode` открывает карточку документа и справочника — дерево и
     поведение идентичны текущим.
  2. grep по `src/` не находит `ФормаОбъекта`/`OBJECT_FORM`.
  3. Прямой вход по URL, F5, расшаренная ссылка на карточку — без redirect-компонентов.
  4. Немигрированный экран через catch-all → легаси (не белый экран, не 404).
  5. Несуществующий URL → «не найдено».
     5-bis. Fallback отрабатывает и по 404 (страница ещё шлёт `layoutCode`), и по 422
     (страница на route-only).
  6. Потеря сессии (`SESSION_NOT_FOUND`) на странице без `layoutCode` → reopen по
     `route`.
  7. Вкладка `/modules/:pageCode` получает тип из `response.tab.kind === 'MODULE'`.
  8. Регресса нет: страницы, продолжающие слать `layoutCode`, ведут себя как раньше.

## Затрагиваемые файлы

- `src/features/sdui/api/view-transport.ts` — парсинг тела ошибки, поля в `ViewHttpError`.
- `src/features/sdui/lib/dispatch.ts` — route-only OPEN, гейт ошибок на 3 ветки.
- `src/features/sdui/lib/conflict-handler.ts` — reopen по route при пустом `layoutCode`.
- `src/features/sdui/types/view.ts` — поле `tab` в `ViewResponse`.
- `src/pages/documents/documents-entry/ui/sdui-document-page.tsx` — снять конвенцию.
- `src/pages/dictionaries/dictionary-entry/ui/sdui-dictionary-entry-page.tsx` — снять конвенцию, 422 в `onOpenFailed`.
- `src/app/App.tsx` — catch-all `<Route path="*">`.
- `src/pages/sdui-catch-all/` — новый компонент `SduiCatchAllPage` + `LegacyFallback`.
- `src/features/workspace-tabs/lib/utils/resolve-page-type.ts` — снять 3 SDUI-регекса.
- маппинг `tab.kind → TabPageType` + авторство SDUI-вкладки из ответа OPEN.
- тесты: `dispatch.test.ts`, `language-reopen.test.ts` + новые.
