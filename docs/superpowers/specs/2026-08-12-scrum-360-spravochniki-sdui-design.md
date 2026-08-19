# SCRUM-360: перевод справочников на SDUI — фронт-дизайн

Дата: 2026-08-12. Ветка: `feature/SCRUM-360-spravochniki-sdui`. Статус: дизайн утверждён,
реализация не начата.

Входная спека бэка: `specs-local/scrum-360-srez-spravochnikov/frontend-spec-spravochniki-sdui.md`
(Alisher, 2026-08-12) — четыре задачи. Аудит кода 2026-08-12
(`2026-08-12-sdui-full-audit-spec.md`) показал, что спека писана по устаревшему слепку фронта;
фактический остаток меньше заявленного и уточнён здесь. Решения по скоупу приняты с владельцем
2026-08-12: **берём всю задачу 9 SCRUM-290 (снятие явных роутов), по порядку — сначала списки,
затем карточки.**

## 0. Сверка спеки бэка с фактическим кодом

| Задача бэка                                             | Заявлено                       | Фактически                                                                                                                                                                           | Остаток                                                                             |
| ------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1. Catch-all роутинг                                    | «не смонтирован, 14+ регексов» | Смонтирован (SCRUM-290 ч.1): `SduiCatchAllPage` — 200→SDUI, 422→`LegacyFallback` по kind, 404→NotFound (`sdui-catch-all-page.tsx`)                                                   | Явные легаси-роуты в `App.tsx` перехватывают URL раньше catch-all → **блоки 1 и 4** |
| 2. `allowOpen`/`allowCopy` «не читаются (0 совпадений)» | устарело                       | Читаются строго `=== true` (`reference-field-node.tsx:244,286`)                                                                                                                      | `allowCreate ?? true` в ячейке ТЧ (F-21) + судьба props-only фолбэка → **блок 3**   |
| 3. `cellKind`/`iconMap` «каждая ячейка String(value)»   | устарело                       | `cellKind="ICON"` + `iconMap` + глифы папка/элемент (SCRUM-291 3b: `cell-icon-registry.tsx`, `list-column-defs.tsx:165-170`); BOOLEAN/DATE/DATETIME по `dataType` (`format-cell.ts`) | `HIERARCHY` (отступ по уровню) → **блок 2**                                         |
| 4. Специфика справочников                               | знание                         | —                                                                                                                                                                                    | учитываем в блоках 1/4                                                              |

## 1. Блок Р-A: роутинг, этап A — снять 12 списковых/регистровых/отчётных роутов

**Что.** Из `App.tsx` удаляются явные Route, уже покрытые `KIND_TO_LEGACY` (12 kind):

| Route                                                           | kind фолбэка          |
| --------------------------------------------------------------- | --------------------- |
| `/modules/:pageCode/document/:moduleCode`                       | DOCUMENT_LIST         |
| `/modules/:pageCode/document/:moduleCode/:entryId/movements`    | DOCUMENT_MOVEMENTS    |
| `/modules/:pageCode/dictionary/:moduleCode`                     | DICTIONARY_LIST       |
| `/modules/:pageCode/informationregister/:moduleCode`            | REGISTER              |
| `/modules/:pageCode/accumulationregister/:moduleCode`           | ACCUMULATION_REGISTER |
| `/modules/:pageCode/accountingregister/:moduleCode`             | ACCOUNTING_REGISTER   |
| `/modules/:pageCode/accountplan/:moduleCode` (только списковый) | ACCOUNT_PLAN          |
| `/modules/:pageCode/accountingreport/:moduleCode`               | ACCOUNTING_REPORT     |
| `/modules/:pageCode/report/:moduleCode`                         | REPORT                |
| `/modules/:pageCode/reportalt/:moduleCode`                      | REPORT_ALT            |
| `/modules/:pageCode/dataprocessor/:moduleCode`                  | DATA_PROCESSOR        |
| `/modules/:pageCode/calculationplan/:moduleCode`                | CALCULATION_PLAN      |

Карточные Route (`document/:m/:entryId`, `dictionary/:m/:entryId`, `accountplan/:m/new|:entryId`,
плоские `/documents/*`, `/dictionaries/*`), `/`, `/modules/:pageCode`, `/treasury-export`,
`/modules/:pageCode/account-card` — **остаются** (карточные — этап B, остальные вне задачи 9).

**Поток после снятия.** URL → catch-all → OPEN → 200 (тип в enabled-types) = SDUI-список; 422
SCREEN_NOT_SDUI = легаси-страница через `LegacyFallback` (штатный путь на всё время миграции, не
ошибка); 404 ROUTE_UNKNOWN = NotFound.

**Вкладки.** На 200 вкладку создаёт catch-all из `response.tab.kind` (`authorTab`). На 422 вкладку,
как и сейчас, ведёт `resolve-page-type` по URL (`WorkspaceTabSync`) — регексы НЕ трогаем: они
обслуживают легаси-фолбэки и оставшиеся явные роуты. Сокращаются по мере ухода легаси (ответ на
вопрос №1 бэка).

**Ошибки.** Ничего нового: обе ветки ошибок уже реализованы в `dispatch.ts:199-213` по контракту
SCRUM-290 §2.

**Проверка.** (1) Тип в `enabled-types` → по прямому URL открывается SDUI-список; (2) соседний
непереведённый тип по такому же URL → легаси-страница без мигания ошибкой; (3) вкладки обоих
экранов ведут себя как раньше; (4) `/modules/x/unknown/y` → NotFound. Нужен бэк: добавить один
справочник в `enabled-types` на dev (вопрос Q-3 к бэку).

## 2. Блок H: `cellKind="HIERARCHY"` в списке

**Что.** В `list-column-defs.tsx` — новая ветка `cellKind === 'HIERARCHY'`: глиф папка/элемент
через существующий `getCellIcon`/`iconMap` + горизонтальный отступ по уровню вложенности строки.

**Контракт уровня — открытый вопрос бэку (Q-2).** Сегодня уровень вложенности в данных строки не
приходит. Предложение: служебное поле строки `_level: number` (0 = корень); `iconMap` на колонке —
как в ICON (`{"true":"folder","false":"listElement"}`). Ответ на вопрос №3 бэка: «`cellKind`,
который сервер проставит сам» — НЕ хватит, без уровня отступы рисовать не из чего.

**До ответа бэка** реализуем рендер с фолбэком `_level ?? 0` (плоско, но с глифами) — блок не
блокируется контрактом.

**Проверка.** Иерархический справочник в списке показывает группы/элементы визуально различимо, с
отступом по уровню.

## 3. Блок А: аффордансы — хвост

1. **F-21 (аудит):** `reference-cell-editor.tsx:225` — `allowCreate ?? true` → `allowCreate === true`
   (симметрично серверной асимметрии ReferenceAffordanceResolver: create «закрыт, пока явно не
   true»). `allowShowAll ?? true` НЕ трогаем — совпадает с серверным default true.
2. **Props-only фолбэк** `allowCreate ?? canBrowse` (`reference-field-node.tsx:221`) снимаем
   **только после** подтверждения бэком гейта C1.4 `RefActionsCompletenessIT` (вопрос Q-1) — до
   гейта снятие даст пустую кнопку вместо пикера на непокрытых полях (задокументировано в
   SCRUM-291 §18.6).
3. `allowOpen`/`allowCopy` уже строгие — добавить тест-инварианты на `undefined` (кнопки нет),
   чтобы зафиксировать правило «отсутствие флага запрещает; наличие action не разрешает».

**Проверка.** Классификатор (read-only справочник) не показывает «+» ни в шапке, ни в ячейке ТЧ;
обычный справочник показывает.

## 4. Блок Р-B: роутинг, этап B — карточки + снятие D-1

Начинается **после** регресса этапа A на dev.

1. **`KIND_TO_LEGACY` дополняется карточными kind** (заодно закрывает F-27 аудита):
   DOCUMENT → легаси-карточка документа, DOCUMENT_NEW → она же (/new),
   DICTIONARY / DICTIONARY_NEW → легаси-карточка справочника,
   ACCOUNT_PLAN → **массив** путей (list + new + :entryId); `LegacyFallback` учим
   `path: string | string[]` (несколько `<Route>` во вложенном `<Routes>`).
   Комментарий «таблица обязана быть полной» становится правдой.
2. **Снимаются**: карточные Route документов/справочников/плана счетов, плоские
   `/documents/:typeCode[...]` и `/dictionaries/:typeCode[...]`; удаляются
   `pages/documents/document-redirect` и `pages/dictionaries/dictionary-redirect` вместе с
   резолвом pageCode. **Отклонение D-1 снимается** — обновить реестр
   `2026-07-02-sdui-course-audit.md` §9 в том же PR.
3. **tabsApi в catch-all**: `SduiCatchAllPage` начинает передавать в `SduiScreen`
   `shouldPersistSession` / `onDirtyChange` / `consumePendingAction` / `onSavedAndClosed` /
   `onCloseAfter` (по образцу `sdui-document-page.tsx`) — без этого dirty-цикл форм через
   catch-all не работает (зафиксировано аудитом). Возможен вынос обвязки в общий хук
   (`use-sdui-tab-binding`), чтобы не дублировать между sdui-document-page и catch-all.
4. Клиентские развилки `newView` (`document-entry-page.tsx`, `dictionary-entry-page.tsx`) умирают
   вместе с явными роутами — серверная развилка (200/422) их заменяет.
5. **Риск `?copyFrom`** (SCRUM-217: копия остаётся на легаси-форме): при снятии роутов запрос
   `/documents/:type/new?copyFrom=N` уйдёт в OPEN — бэк должен вернуть 422 DOCUMENT_NEW, пока
   SDUI-копирование не сделано (вопрос Q-4). До подтверждения бэка карточные роуты с `?copyFrom`
   НЕ снимаем (точечно оставить редирект копии либо гейтить в catch-all — решится в плане по
   ответу бэка).

**Проверка.** Полный регресс форм: открытие/создание/копирование документа и справочника
(newView=true и false), план счетов (list/new/entry), dirty-цикл (крестик вкладки → диалог →
дозапись), плоские ссылки из «Показать в списке»/related-docs.

## 5. Блок О: ответ бэку (уходит первым, не ждёт кода)

Комментарий в SCRUM-360 + встречная спека-файл `SCRUM-360-spec-v1-<дата>-front.md` в
`specs-local/scrum-360-srez-spravochnikov/`:

- Корректировка картины: catch-all смонтирован (SCRUM-290 ч.1), `cellKind="ICON"`/`iconMap`/
  форматирование по dataType сделаны (SCRUM-291 3b), `allowOpen`/`allowCopy` читаются строго,
  сайдбар server-driven (не «div-стаб»). Реальный фронт-остаток — этот дизайн.
- Ответы на вопросы бэка: (1) `resolve-page-type` целиком снять нельзя — обслуживает вкладки
  422-фолбэков и оставшихся явных роутов, сокращается по мере миграции; (2) резолверов иконок уже
  два по назначению (`cell-icon-registry` для ячеек, `lib/shell/icon-resolver` для сайдбара) —
  объединение не требуется; (3) `cellKind=HIERARCHY` недостаточно — нужен уровень в строке.
- Встречные вопросы: **Q-1** сдан ли гейт C1.4 `RefActionsCompletenessIT` (снятие props-only
  фолбэка `allowCreate`); **Q-2** контракт уровня иерархии — ок ли `_level: number` в данных
  строки; **Q-3** добавить один справочник в `enabled-types` на dev для приёмки этапа A;
  **Q-4** гарантирует ли бэк 422 на `?copyFrom`-маршрутах до SDUI-копирования.

## 6. Порядок, тесты, риски

**Порядок:** О (ответ бэку) → Р-A → H → А → Р-B. Блоки H и А независимы, могут идти параллельно
Р-A. Р-B стартует после регресса Р-A и ответов на Q-1/Q-4.

**Тесты.**

- Р-A: тесты `sdui-catch-all-page` расширяются кейсами снятых URL (мок 200 → SDUI; 422 с каждым
  из 12 kind → соответствующая легаси-страница; 404 → NotFound); тест «в App.tsx нет Route,
  дублирующих KIND_TO_LEGACY» (grep-инвариант по образцу существующих).
- H: рендер HIERARCHY-ячейки — глиф из iconMap, отступ по `_level`, фолбэк level=0.
- А: undefined-кейсы всех четырёх allow\* (кнопки нет), `allowCreate === true` в ячейке.
- Р-B: kind-to-legacy покрывает 16/16 серверных kind (тест полноты по enum из спеки SCRUM-290);
  dirty-цикл через catch-all (persist/consumePendingAction).
- Перед каждым мержем: полный vitest + `npm run build` (правило проекта) + e2e-чеклист на dev-api.

**Риски.**

1. Легаси-страницы через `LegacyFallback` рендерятся без прежнего окружения явного Route — просадки
   в useParams/квери исключаем вложенным `<Routes>` (уже так) и регрессом каждого из 12 kind.
2. Двойной рендер-путь на переходе (вкладка открыта до деплоя, URL уже в истории) — catch-all
   обрабатывает любой URL, риска нет.
3. Р-B меняет судьбу всех форм — потому последний, за отдельным регрессом и ответами Q-1/Q-4.
4. EMFILE-тесты (U-1 аудита): тесты catch-all уже страдают от барреля иконок — при расширении
   тестов применить deep-импорт/мок (иначе новые тесты будут флаковать).

**Вне скоупа:** F-18 (шаблоны `list.*:{typeCode}` — ждёт B-1 из SCRUM-362), U-2 (layoutCode),
миграция самих легаси-страниц, `resolve-page-type` (сокращается позже), фаза 2 shell.
