# SCRUM-291 · List Phase 2 (2b сортировка + 2c фильтры + 2d период) — дизайн

Дата: 2026-08-05. Родитель: [roadmap](2026-08-05-scrum-291-frontend-migration-roadmap-design.md) п.3.
Контракт: `specs-local/scrum-291-perevod-ekranov-na-sdui/frontend-spec-list-form.md` §6, §7, §8.
Терминал: writing-plans.

## Почему один док на три среза

2b/2c/2d делят одну модель: пользователь жмёт контрол → уходит мутирующая `list.*`-команда →
сервер отвечает патчами `setProp` на LIST-узле (`source`, плюс `sortState`/`filterChips`) + эффектом
`replaceUrl` → `list-node` рефетчит (queryKey уже завязан на `source`). Плюс общий инвариант M5 и
общий пререквизит `replaceUrl`-эффект. Разводить это на три дока — дублировать инфраструктуру.

## Пререквизиты (общие, из рекогносцировки кода)

- **P1. Эффект `replaceUrl` — ОТСУТСТВУЕТ.** `EffectType` (`types/node-types.ts`) и `effect-handler.ts`
  его не знают. Нужен: добавить `replaceUrl` в `EffectType`; в `effect-handler.play()` — ветка,
  вызывающая инъектированный `replaceUrl(route)` → на уровне app это `setSearchParams(route,{replace:true})`
  (НЕ navigate: сессию не трогает, в историю не пишет, экран не перемонтирует). Гейт зависимостей
  эффектов расширяется как `navigate`/`confirm` уже инъектируются в `dispatch.ts`.
- **P2. `setProp` generic — ЕСТЬ** (`patch-applier.ts`): `setProp` на `source`/`sortState`/`period`/
  `filterChips` применится без доп. кода; list-node рефетчит по смене `source`.
- **P3. Команды не бросают STALE_REVISION** (§6): терпимы к устаревшей `revision`. Фронт шлёт
  `revision` как сейчас; спец-обработки не нужно, но нужно подавление дублей in-flight (см. 2b).

## Инвариант M5 (общий, обязательный)

Любая замена `props.source` (ответ на sort/filter/period) обязана **сбросить выделение**:
`setSelectedRowId(null)` + снять публикацию в selection-store (`clearSelection(selectField)`).
Реализация чисто фронтовая: в `list-node` отследить смену идентичности `source` (по
`JSON.stringify(source)` или по ссылке из стора) через `useEffect([sourceKey])` и сбросить
`selectedRowId`. Без этого «выделил строку → фильтр → строка ушла» оставляет `requiresSelectedRow`-кнопку
активной, команда уйдёт по невидимой записи.

## 2b — Сортировка кликом (§6)

- Заголовок колонки с `props.sortable===true` — кликабелен; несортируемая — клик игнорируется.
- Клик → `dispatch(COMMAND 'list.applySort:{TypeCode}', value={column: attributeCode, dir})`.
  Направление: если колонка уже активна в `sortState` — переключить ASC↔DESC; иначе новая колонка, `dir='ASC'`.
- `{TypeCode}` берётся из суффикса команды в дереве — но фронт не знает TypeCode. **Решение:** команда
  приходит готовой строкой? Нет — для sort/filter/period команда собирается фронтом. TypeCode фронт
  берёт из `activateAction.command` (`list.rowOpen:{TypeCode}`) или из отдельного `props`. **Проверить
  в дереве:** есть ли на LIST `props.commandKey`/суффикс. Если нет — извлечь TypeCode из существующего
  action-команды LIST (`list.rowOpen:X` → `X`). Зафиксировать в плане как первый шаг (прочитать реальное дерево).
- Стрелка рисуется по `props.sortState={column,dir}`, ТОЛЬКО если ключ присутствует; отсутствует →
  стрелки нет нигде (не оставлять последнюю). `sortState` — утверждение сервера.
- **Подавление дублей in-flight:** повторные клики по заголовку на время незавершённого `list.*`
  запроса подавляются (флаг in-flight в узле; «последний выигрывает» не обязателен — достаточно
  игнорировать повтор).

## 2c — Фильтры (§7)

Фронт «тупой»: сервер даёт метаданные на колонке и готовые чипы, фронт рендерит контрол и шлёт команду.

**Метаданные колонки** (`TABLE_COLUMN.props`): `filterField` (код в команду; ВСЕГДА брать его, не
`attributeCode` — алиас «Номер»→`code`), `filterOps` (подмножество 12 операций), `filterValueSource`
(`{url,params}` для ссылки — реюз `fetchReferenceOptions`/пикер-контрол), `filterValueOptions`
(инлайн для ENUMS: `[{value,label,id,code}]`, слать `value`-строку). `filterOps` пусто/нет → воронки нет.

**Контрол воронки** (popover на заголовке):

- Выбор операции из `filterOps` (лейблы — из `LIST.props.filterOpLabels`, приходят с сервера).
- Контрол значения по `dataType` + источнику:
  - ссылка (`filterValueSource`) → ссылочный селект (реюз механизма reference-options), значение — голый `id` (число).
  - `ENUMS` (`filterValueOptions`) → селект, значение — строковый `value`.
  - `between` → два инпута (для дат — `DateTimeInput`; массив из двух границ; T00/T23 не собирать — сервер сам).
  - `isNull`/`isNotNull` → без значения.
  - иначе (текст/число/дата) → соответствующий инпут.
- Применить → `dispatch(COMMAND 'list.applyFilter:{TypeCode}', value={field: filterField, op, value})`.
- Одно условие на колонку (замена).

**Чипы** (`LIST.props.filterChips=[{field,label}]`): рендерить `label` как есть (готов сервером, не
пересобирать). Крестик на чипе → `dispatch('list.clearFilter:{TypeCode}', value={field})`. Кнопка
«Сбросить все» → `dispatch('list.clearAllFilters:{TypeCode}')` (без value).

**Персист:** эффект `replaceUrl` (P1) после каждой команды → `setSearchParams(route,{replace:true})`.
`?ls=` токен непрозрачен — фронт только возит его в `route` следующего OPEN (уже работает: `route =
location.pathname + location.search`).

## 2d — Период (§8)

- `LIST.props.period={from,to}` присутствует ВСЕГДА при `transport=SEARCH` (даже пустой `{null,null}`).
- Контрол — на LIST (не в TOOLBAR): два `DateTimeInput` (from/to), обе границы независимо опциональны.
- Изменение → `dispatch(COMMAND 'list.applyPeriod:{TypeCode}', value={from,to})` (`"yyyy-MM-dd"`|null).
- `{from:null,to:null}` — тот же вызов, снимающий период (отдельной `clearPeriod` нет).
- У периода НЕТ чипа; период и колоночный фильтр по дате действуют одновременно (AND) — фронту просто
  два независимых контрола.

## Границы среза

- НЕ трогаем 2e (команды строки — за флагом), 3a/3d (ноль дельты).
- НЕ реализуем `logic=OR`, мультисортировку, пресеты периода (вне пакета, §10).
- НЕ импортируем легаси `table-filter` (клиент-авторитарный, конфликтует с server-driven source).
- Свободного поиска документов не вводим (searchable уже управляется деревом).

## Декомпозиция (для writing-plans)

1. **P1 `replaceUrl`-эффект** — `EffectType`, `effect-handler`, инъекция в `dispatch`/app. Юнит на эффект.
2. **M5 сброс выделения** — в `list-node`, тест на смену source.
3. **2b сортировка** — кликабельные заголовки, стрелка по sortState, applySort, in-flight suppress. TypeCode-extraction — первый шаг (прочитать дерево).
4. **2d период** — контрол from/to, applyPeriod. (Проще фильтров, идёт раньше 2c.)
5. **2c-value-controls** — контрол значения по dataType/источнику (ссылка/enum/between/null/скаляр).
6. **2c-funnel+commands** — popover воронки, applyFilter.
7. **2c-chips** — панель чипов + clearFilter/clearAllFilters.

Каждая — свой TDD-цикл. Общий прогон `npx vitest run --dir src/features/sdui` в конце.

## Открытый вопрос (решить в плане на реальном дереве)

Откуда фронт берёт `{TypeCode}` для сборки `list.applySort:{TypeCode}` и т.п.? Кандидаты: суффикс
существующей команды LIST (`activateAction.command = list.rowOpen:{TypeCode}`), либо отдельный
`LIST.props`. Первый шаг плана 2b — прочитать реальный ответ `/api/view` для списка (или тест-фикстуру)
и зафиксировать источник TypeCode; если его нет — это вопрос к бэку (не подставлять догадку).
