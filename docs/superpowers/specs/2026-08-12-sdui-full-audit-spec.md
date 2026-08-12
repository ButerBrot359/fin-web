# Полный аудит SDUI 2026-08-12: спека для фронта и бэка

Дата: 2026-08-12. Ветка: `dev` (HEAD 619a2c4). Статус: **спека, реализация не начата.**

**Метод.** Свежий аудит с нуля (не дельта от 2026-07-02): семь измерений (канон, shell/роутинг,
корректность состояния, таблицы/поля, граница легаси↔SDUI, мёртвый код, контракты) + карта
удаления легаси. Каждая находка прошла адверсариальную верификацию независимым скептиком
чтением кода: 43 подтверждено, 4 отклонено; после слияния дублей между измерениями — 38
уникальных (F-1…F-32 + U-1…U-6). Полный vitest: **647/647 зелёные** (2 файла падают
на импорте по EMFILE — тест-инфра, см. U-1). Каждая находка сверена с бэклогом
(`specs-local/` — 20 тикетов, `docs/BACKLOG.md`).

**Эталон.** Канон 2026-07-02 (`2026-07-02-sdui-course-audit.md` §1) + решения §8 + реестр
согласованных отклонений §9. Зарегистрированное отклонение с ненаступившим условием снятия
находкой не считается.

---

## 1. Вердикт

**Архитектура держит курс, и держит его заметно лучше, чем в июле.** Класс проблем «фронт знает
бизнес-протокол» системно закрыт волнами SCRUM-283…287: dispatch работает только по
behavior-метаданным бэка, имена команд непрозрачны, `DOMAIN_PATH_MAP` и второй формат пагинации
снесены, OPEN стал route-only, появились server-driven сайдбар (SCRUM-289 ф.1) и catch-all-роут
с гейтом 422/404 (SCRUM-290 ч.1). Транспорт каноничен: `POST /api/view` + heartbeat + beacon,
всё остальное — готовые `url`/`request`/`route` из effects.

Проблемы сегодняшнего дня — другого сорта:

1. **Жизненный цикл сессий и ревизий даёт краевые потери данных** (раздел 3.1): ревизия
   читается до flush ТЧ, ошибка flush молча стирает карту правок, discard закрытой вкладки
   воскресает из кэша, фоновые сессии умирают по TTL без предупреждения. Это самый важный
   кластер — он бьёт по пользователю.
2. **Новые ноды продолжают заносить знание протокола** (раздел 3.3): LIST собирает команды из
   шаблонов, CALENDAR хардкодит `kalendari.*`, блок проводок зашивает бизнес-биндинги. Каждый
   случай согласован спекой с бэком, но **ни один не внесён в реестр отклонений** — реестр
   перестал отражать реальность, и это процессная дыра: условия снятия никто не отслеживает.
3. **Легаси удалять пока нечего** (раздел 6): всё живое — либо за явными роутами до задачи 9
   SCRUM-290, либо реализация gateway. Зато у восьми зон миграции нет тикетов вообще.

## 2. Что держит курс (проверено, в порядке)

- **Транспорт**: `view-transport.ts` — единственная точка `POST /api/view`; heartbeat/beacon
  согласованы; язык по SCRUM-268; контракт ошибок SCRUM-290 (422 SCREEN_NOT_SDUI / 404
  ROUTE_UNKNOWN / унаследованный 404) прочитан фронтом в точности.
- **Dispatch**: никаких ветвлений по именам команд; порядок применения ответа (revision →
  clearErrors → tree patches → value patches → statePatch → effects → closeAfter) корректен;
  авторитетный `res.dirty` перекрывает клиентский флаг (SCRUM-288 §2.5); reopen не повторяет
  write-команды (`reopen-retry-policy`).
- **Граница**: направление легаси→SDUI — 8 нетестовых импортёров, все легальные точки
  монтирования; SDUI→легаси — только `kind-to-legacy.tsx` в композиционном слое pages/ (по
  спеке SCRUM-290 §3); три gateway (reference-picker, workspace-tab, report-result) — интерфейс
  у SDUI, реализация в `app/`, образцово; `src/shared/**` чист от SDUI-знаний; rules of hooks в
  точке ветвления починены (хуки до условного return).
- **Снятые находки июля**: SAVE_COMMANDS, хардкод `save`/`save-and-close`, конструирование
  `addRow:`/`ref.select:`, `needsSelectedRow`-префиксы, конвенция layoutCode, DOMAIN_PATH_MAP
  (D-2 — снят и вычищен, grep пуст), `content ?? items`, ложный dirty по клику строки, ререндер
  всего дерева на ввод (точечный `useBindingValue`), 409-хендлер панелей (`getSession` из
  живого panel-store).
- **Таблицы, happy-path**: flush-before-save инвариант (SCRUM-314) держится, таймаут flush
  **реджектит** (save не уходит по старым данным), реестр pending-коммитов на Symbol-токенах
  (нет коллизий корень/панель), дедуп rowActivate, хоткеи скоуплены контейнером ТЧ.
- **Мёртвых хвостов снесённых механизмов нет**: name-interception (SCRUM-288 T9) — чисто,
  мёртвые контракты SCRUM-332 — все три пункта закрыты, все NodeType/PatchOp/EffectType имеют
  потребителей.

## 3. Находки: фронт

Формат: **[серьёзность] файл:строка — суть.** Сценарий → фикс. `Бэклог:` covered — тикет уже
планирует ровно это; partial — тикет касается темы; new — тикета нет.

### 3.1 Корректность: сессии, ревизии, потеря данных

Кластер стоит чинить одной волной — находки сцеплены общим механизмом (ревизия/кэш/ретрай).

**F-1 [CRIT] `table-cell-editor.tsx:149`, `number-field-node.tsx:29` — DECIMAL-ввод съедает
разделитель: «1.5» превращается в 15.** Значение хранится числом и парсится `parseFloat` на
каждый keystroke; контролируемый инпут получает обратно `String(number)` — промежуточное «1.»
затирается до «1», следующая цифра приклеивается к целой части. → Держать строковое сырое
значение до коммита (blur/Enter), `parseFloat` только в коммите. `Бэклог: new.`

**F-2 [MAJOR] `use-table-sync.ts:219` — ошибка сети при flush стирает правки ТЧ.** В ветке
ошибки `sendEvent` вместе с `sentRowsRef` обнуляется `dirtyRef` — карта пользовательских
правок. Следующий приход канона перезаписывает `localRows` старыми данными, а
`hasPendingWork()` становится false — «Записать» уходит по старым данным без ошибки. → На
ошибке не чистить `dirtyRef` (оставить для реконсиляции и повторной отправки), обнулять только
`sentRowsRef`. `Бэклог: new.`

**F-3 [MAJOR] `dispatch.ts:50` — ревизия читается до `await flushAllPendingTableCommits()`.**
Flush сам шлёт EVENT и бампает ревизию; внешний COMMAND уходит со старой → гарантированный 409
STALE_REVISION на рутинном «правка ТЧ → Записать»: лишний roundtrip, ложный тост «данные
обновились», а `replaceAll(snapshot)` сбрасывает dirty — если авторетрай упадёт по сети,
вкладка закроется без предупреждения о несохранённом. → Перечитывать `session.getSession()`
после flush, непосредственно перед `viewTransport.post`. `Бэклог: new.`

**F-4 [MAJOR] `button-node.tsx:74` + `conflict-handler.ts:26` — двойной клик = двойное
исполнение команды.** У кнопки нет pending-блокировки, а STALE_REVISION-ретрай доисполняет
второй клик уже со свежей ревизией (двойное проведение/копирование). Показательно: reopen-путь
write-команды не ретраит, а STALE_REVISION-ретрай такого фильтра не имеет. → Локальный pending
на время dispatch + не авто-ретраить COMMAND с мутирующим behavior. `Бэклог: new.`

**F-5 [MAJOR] `perform-tab-close.ts:21` — discard закрытой вкладки не чистит sdui-cache и не
закрывает form-session: отменённые правки воскресают.** Снимается только легаси
`useFormCacheStore`; снимок sdui-cache (дерево + живой formSessionId) остаётся, повторное
открытие того же маршрута восстанавливает **явно отменённые** правки, которые можно нечаянно
сохранить. Нюанс (усугубляет): на unmount SduiScreen шлёт `onDirtyChange(route, false)`, так
что диалог «Не сохранять» для фоновой SDUI-вкладки может вообще не показаться. → По образцу
panel-tab-close-registry: при закрытии route-вкладки нотифицировать SDUI →
`useSduiCacheStore.remove(route)` + best-effort CLOSE. `Бэклог: new.`

**F-6 [MAJOR] `sdui-screen.tsx:85` — закэшированные фоновые сессии не heartbeat-ятся.**
Пингуется только смонтированная сессия; грязная вкладка в фоне умирает по idle-TTL, restore
воскрешает мёртвый formSessionId, save падает. → Пинговать все сессии из sdui-cache-store либо
проверять живость на restore и честно предупреждать. `Бэклог: new.` (Сцеплено с F-5: чинить
вместе.)

**F-7 [MAJOR] `dispatch.ts:194` — CLOSE не исключён из conflict-recovery.** 409 на CLOSE мёртвой
сессии даёт warning-тост + `reopen()` → OPEN уже размонтированного маршрута (замыкание старого
location) пишет root/session в глобальные сторы параллельно с OPEN нового экрана — кто ответил
последним, тот и победил; переоткрытая сессия никогда не закрывается (сирота). Достижимо на
`postAndClose` (двойной CLOSE: effect + cleanup) и на TTL-истёкшей сессии. → Для
`action.type === 'CLOSE'` глотать ошибки целиком (best-effort, как `closeSession` в
build-effect-deps). `Бэклог: new.`

**F-8 [MAJOR] `relay-selection.ts:18` — выбор не доезжает до формы-панели.** Для panel-родителя
`applyRelayResponse` обновляет только revision; patches/statePatch ответа
`applyToParentCommand` не применяются — дерево панели живёт в React-стейте PanelFormProvider,
до которого модуль не дотягивается. Выбранное в дочернем пикере значение не появляется в
форме-панели. → Реестр «sessionId → applier»: PanelFormProvider регистрирует
applyTreePatches/setFromServer/merge, relay применяет через него. `Бэклог: new.`

**F-9 [MAJOR] `confirm-store.ts:20` — параллельный `ask()` перезатирает resolve.** Второй
confirm при открытом первом теряет первый resolve — его цепочка (dispatch/confirmRequest)
молча умирает. → При живом resolve сначала резолвить его false (или очередь).
`Бэклог: partial (SCRUM-244).`

**F-10 [MAJOR] `dispatch.ts:217` — ошибка EVENT не откатывает оптимистичное значение поля.**
Скаляр пишется в viewState до отправки; на сетевой ошибке — только тост: ни отката, ни
пометки unsynced, ни досылки перед save (в отличие от табличного механизма). UI и серверный
scratch расходятся до сохранения. → Помечать binding как unsynced и досылать перед
write-COMMAND (аналог flush), либо откатывать с ошибкой поля. `Бэклог: new.`

**F-11 [MINOR] `dialog-host.tsx:134` — закрытие панели с собственной сессией никогда не шлёт
CLOSE.** Все пути закрытия (pop/remove/reset/beacon-только-root) удаляют PanelEntry, но
child form-session остаётся жить на сервере до TTL. → best-effort CLOSE при remove/pop панели
с session. `Бэклог: new.`

### 3.2 Корректность: таблицы и поля

**F-12 [MAJOR] `table-node.tsx:182` (+ `subordination-tree.tsx:49`,
`accounting-postings-block.tsx:44`, `complex-editable-table.tsx:224`) — read-only таблицы
читают строки нереактивным `getValue`.** setValue-патч сервера меняет только view-state store;
NodeRenderer мемоизирован по node — без tree-патча компонент не ререндерится и показывает
старые строки. → Заменить на `useBindingValue` (реактивная подписка уже существует и
используется редактируемыми ТЧ). `Бэклог: new.`

**F-13 [MAJOR] `date-field-node.tsx:26`, `datetime-field-node.tsx:25` — change-EVENT на каждую
цифру пикера.** По собственной документации проекта onChange MUI-пикера стреляет на каждую
введённую цифру (с '' и промежуточными датами). Для ячеек ТЧ это починено отложенным коммитом
(DateCellEditor, SCRUM-279 D6); поля шапки остались на старом паттерне — сервер получает шквал
EVENT с мусорными датами. → Коммит по onClose/blur, как в DateCellEditor; локальный setValue
оставить на onChange. `Бэклог: new.`

**F-14 [MAJOR] `editable-table.tsx:111` — дрейф дублированной табличной логики: простая
EditableTable не передаёт rowFilter-параметры в ссылочные ячейки.** Собственная копия
cell-колбэков (вместо `buildColumnDefs`) не передаёт `extraParams=resolveRowFilterParams(...)`
— per-row сужение пикера по `__rowParentIds` (SCRUM-332 §3) молча не работает во всех простых
ТЧ. → Убрать копию: строить колонки через buildColumnDefs (плоский случай — частный случай
рекурсии). `Бэклог: partial (SCRUM-332).`

**F-15 [MAJOR] `editable-table.tsx:247` — простая EditableTable не публикует
`__selectedRowId`.** Если master-таблица пары master-detail рендерится простой веткой (роутинг
в table-node смотрит только на пропсы самого узла), выбор мастера не публикуется — detail
никогда не активирует фильтр. → Публиковать `__selectedRowId` и в EditableTable (или устранить
дубль — см. F-14). `Бэклог: new.`

**F-16 [MINOR] `enum-field-node.tsx:23` — два контракта чтения enum-значения.** Шапка понимает
только строку, хотя сама шлёт объект `{id, code, presentation}`; табличный редактор той же
схемы уже завёл `resolveEnumValue`, потому что объекты реально приходят. → Вынести
resolveEnumValue в lib/utils и переиспользовать. `Бэклог: new.`

**F-17 [MINOR] `reference-field-node.tsx:105` — single-режим слепо кастует значение, multiple —
нормализует.** У скаляра нет `.id`/`.presentation`. → Единый путь через `toReferenceValue`.
`Бэклог: new.`

### 3.3 Канон: знание протокола

Общий паттерн (F-18…F-25): каждый пункт согласован спекой с бэком, но не внесён в реестр
отклонений §9 — условия снятия не отслеживаются. Минимальное действие по каждому — регистрация
с условием снятия; целевое — контрактный фикс (см. раздел 4). F-26/F-27 — смежные пробелы той
же зоны.

**F-18 [MAJOR] `list-node.tsx:51,253,261`, `list-column-defs.tsx:102,134`,
`list-period-control.tsx:23` — LIST парсит имя серверной команды и собирает 5 команд из
шаблонов.** Фронт извлекает `{TypeCode}` из суффикса `list.rowOpen:{TypeCode}` и собирает
`list.applySort/applyFilter/applyPeriod/clearFilter/clearAllFilters:{typeCode}`. Прямой запрет
канона п.3; знание размазано по трём файлам. Смягчение: fail-closed (без двоеточия контролы не
рендерятся), формат согласован спекой SCRUM-291. → Бэк присылает готовые actions на LIST-ноде
(п. B-1). `Бэклог: new.`

**F-19 [MAJOR] `calendar-node.tsx:41,54` + `calendar-types.ts:2-15` — CALENDAR: хардкод
бизнес-команд `kalendari.den.toggle`/`kalendari.god.change` и транслит-пропсы
(`god/godMin/godMax/redaktiruemyy/dni/vklyuchen/ruchnoy`).** Generic-механизм уже существует
(ViewNodeAction с серверным command — так работают reference-field и table-toolbar), CalendarNode
node.actions игнорирует. → Команды из node.actions, пропсы переименовать в generic (п. B-2).
`Бэклог: partial (SCRUM-278).`

**F-20 [MAJOR] `accounting-block-logic.ts:34-59,101` + `accounting-postings-block.tsx` —
захардкоженная карта бизнес-биндингов бухблока.** ROW_LAYOUT зашивает `_subkontoDt1…`,
`_fkrDt/Kt`, `_podrazdelenie`, `_spetsifika`…; SUBKONTO_RE парсит/конструирует имена;
плюс `_period/_summa/_soderzhanie/_accountDtCode/_accountKtCode`. Переименование биндинга
бэком → молча пустые ячейки; новая аналитика → фронт-релиз. Не «легальное master-detail
исключение»: ключи НЕ приходят от бэка в пропсах. → Роли/раскладка от бэка (п. B-3).
`Бэклог: new.`

**F-21 [MAJOR] `reference-cell-editor.tsx:225` — разрешающий дефолт `allowCreate ?? true` в
ячейке-ссылке ТЧ.** Инвертирует серверную асимметрию (ReferenceAffordanceResolver: create
«закрыт, пока явно не true»); та же пропущенная эмиссия у бэка в шапке даёт «закрыто», в
ячейке — «открыто». Фикс чисто фронтовый: `allowCreate === true`; `allowShowAll ?? true`
оставить — совпадает с серверным default true. `Бэклог: partial (SCRUM-287).`

**F-22 [MINOR] `button-node.tsx:16`, `menu-item-node.tsx:12`, `tabs-node.tsx:16` — разрешающие
дефолты enabled/visible вне реестра D-3.** D-3 покрывает только поля (use-field-node); кнопки,
пункты меню и вкладки — нет, волна A7 их тоже не покрывала. Смягчение: сервер отбивает
неготовые команды warning-notify. → Включить в следующую волну запрещающих дефолтов (п. B-4).
`Бэклог: partial (SCRUM-287).`

**F-23 [MINOR] `toolbar-node.tsx:11,35`, `button-node.tsx:39`, `compute-overflow.ts:24` —
хардкод node ID `btn.postClose`/`btn.more`/`spacer.more`.** Пиннинг и хост меню «Ещё» решаются
по бизнес-именованным ID; тулбар без `btn.more` при узкой ширине теряет доступ к свёрнутым
кнопкам полностью. ID предписаны спекой SCRUM-265 §2, но реестр молчит. → Generic-пропсы
`pinned`/`overflowHost` от бэка (п. B-5) либо регистрация. `Бэклог: new.`

**F-24 [MINOR] `subordination-tree.tsx:82-86` — фолбэк-конструирование URL
`/documents/{typeCode}/{id}` из entityRef.** По контракту SCRUM-301 ветка мёртвая (`_route`
отсутствует только у truncated-строк, отсечённых ранним return), но кодирует серверную
конвенцию плоских ссылок в новом SDUI-коде. → Удалить фолбэк (fail-closed no-op + warn),
бэку — гарантия `_route` инвариант-тестом (п. B-6). `Бэклог: partial (SCRUM-301).`

**F-25 [MINOR] `movements-api.ts:11` — фронт знает `/api/view/movements/{id}` сверх
канонического транспорта.** Жив только из легаси-тулбара списка; SCRUM-288 v2 §1.3 фиксирует
«уйдёт вместе с легаси-списком». Попутно: легаси-виджет импортирует SDUI-баррель напрямую
(`openMovementsForEntry`) — мост без gateway. → Зарегистрировать как D-4 с условием снятия
(SDUI-список с построчной командой за флагом `sdui.list-form.row-commands`).
`Бэклог: partial (SCRUM-288).`

**F-26 [MINOR] `report-result-node.tsx:35,122,241` — пагинация ветвится по бизнес-значению
`reportLayout === 'LEDGER'`.** Новый пагинируемый вид отчёта не получит «Показать ещё» без
фронт-релиза. Фиксится и без бэка: generic-сигнал `lastPage.hasMore` уже читается на :122 —
можно унифицироваться на нём. `Бэклог: new.`

**F-27 [MINOR] `kind-to-legacy.tsx:73` — карта неполна против серверного enum, а комментарий
утверждает «обязана быть полной».** 12 kind из 16: нет DOCUMENT/DOCUMENT_NEW/DICTIONARY/
DICTIONARY_NEW, ACCOUNT_PLAN — только списковый path. Сегодня дыра дремлет (явные роуты
перехватывают), при задаче 9 SCRUM-290 → NotFound вместо легаси-карточки. → Дополнить карту
либо честно переписать комментарий (границу — задокументировать). `Бэклог: covered (SCRUM-290).`

### 3.4 Контракт-гигиена на границе (фронт-часть)

**F-28 [MINOR] `effect-handler.ts:68,72` — effects[] не валидируются; navigate исполняется
через `effect.route!`.** Zod закрывает только патчи; все поля ViewEffect опциональны, assertion
маскирует дыру. → Минимум: guard `if (!effect.route) warn+break` (до closeSession!). Максимум:
validateEffects — discriminated union по type, по образцу validatePatches. `Бэклог: new.`

**F-29 [MINOR] `effect-handler.ts:110` — download игнорирует `request.method`.** Спека SCRUM-288
§3.1: «method == null ⇒ GET, та же конвенция»; фронт при наличии request безусловно POST.
Парный исполнитель `action-request.ts:25` конвенцию соблюдает — два исполнителя одного DTO
трактуют контракт по-разному. → Ветвиться по method, как в action-request.
`Бэклог: partial (SCRUM-288).`

**F-30 [MINOR] `action-request.ts:25` — всё, что не строго 'POST', молча исполняется как GET.**
`method?: string` без ограничений; 'put'/'post' в другом регистре тихо деградируют. → Сузить
тип до 'GET' | 'POST', на неизвестное — warn + не исполнять (запрещающий дефолт); бэку — enum
в DTO (п. B-7). `Бэклог: partial (SCRUM-288).`

**F-31 [MINOR] `effect-handler.ts:3` — features/sdui импортирует `@/app/config/i18n` — инверсия
слоёв FSD** (app/App.tsx сам импортирует @/features/sdui). → `import i18n from 'i18next'`, как
в sdui-screen. `Бэклог: new.`

**F-32 [MINOR] `CLAUDE.md:59` — карта границы устарела.** В SDUI-зоне не перечислены
`src/pages/sdui-catch-all/`, `src/pages/dictionaries/dictionary-entry/ui/sdui-dictionary-entry-page.tsx`
(вторая точка ветвления!), dictionary-redirect; `features/table-filter` числится «Общее», хотя
фактические импортёры — только легаси. → Обновить таблицу. `Бэклог: new.`

## 4. Что нужно от бэка

Раздел самодостаточен — можно выдёргивать в Jira. Каждый пункт закрывает конкретное знание
фронта; пока пункт не сделан, соответствующее отклонение регистрируется в реестре §9.

| #    | Требование                                                                                   | Закрывает                                        | Что шлёт бэк                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B-1  | LIST: готовые actions для sort/filter/period/clear вместо конвенции имён `list.*:{typeCode}` | F-18                                             | actions на LIST-ноде: `{trigger: 'sort'\|'filter'\|'period'\|'clearFilter'\|'clearAllFilters', command: '<готовая строка>'}` — по образцу activate/select                                                    |
| B-2  | CALENDAR: команды в node.actions + generic-пропсы                                            | F-19                                             | actions `{trigger:'toggleDay'\|'changeYear', command}`; props `year/minYear/maxYear/editable/days:[{date,active,manual}]` вместо транслита                                                                   |
| B-3  | Бухблок: раскладка/роли от бэка                                                              | F-20                                             | либо `props.rows:[{subDt,subKt,a1Dt,…}]` с биндингами, либо `role` на TABLE_COLUMN (`subkontoDt:1`, `analytics1Dt`, `sum`, `content`)                                                                        |
| B-4  | Волна запрещающих дефолтов №2 (по образцу A7 SCRUM-287)                                      | F-21, F-22, D-3                                  | гарантия эмиссии `enabled` на BUTTON/MENU_ITEM, `visible` на TAB, `visible`/`enabled` на полях + CI-гейт; фронт синхронно флипает `?? true` → `=== true`/`!== false`                                         |
| B-5  | Тулбар: generic-пиннинг                                                                      | F-23                                             | `props.pinned: true` на несворачиваемых узлах, `props.overflowHost: true` на кнопке «Ещё» — вместо конвенции ID                                                                                              |
| B-6  | related-docs: `_route` обязателен                                                            | F-24                                             | `_route` non-null на каждой строке с `_isTruncated != true` + бэк-инвариант-тест (по образцу ActionRequestUrlIsReadyTest)                                                                                    |
| B-7  | ActionRequest.method — закрытый enum                                                         | F-29, F-30                                       | `method: 'GET' \| 'POST'` (uppercase) в ActionRequestDto + контрактный тест                                                                                                                                  |
| B-8  | Единый ключ кода ошибки                                                                      | parse-view-error.ts:10, normalize-conflict.ts:11 | унаследованный 404 NOT_FOUND переводится на ключ `error` (или дублирует на переходный период) + тест «все ошибки /api/view несут error»; фронт удаляет двойной хедж                                          |
| B-9  | Снятие двойной отдачи print/export                                                           | report-result-node.tsx:147                       | после e2e SCRUM-288: `printEffect`/`exportEffect` — единственный контракт (инвариант-тест), эмиссия `printSource`/`exportEnabled` прекращается; фронт удаляет legacy-ветку (gateway.print / клиентский XLSX) |
| B-10 | Движения как серверная команда                                                               | F-25                                             | на SDUI-списке кнопка ДтКт приходит построчной командой с готовым `request` (флаг `sdui.list-form.row-commands`) — `movements-api.ts`/`open-movements.ts` удаляются                                          |

Приоритет: B-4 (безопасность прав) и B-6/B-7 (дёшево, закрывают классы) — в ближайшую волну;
B-1/B-2/B-3 — при следующем заходе в соответствующие ноды; B-8/B-9/B-10 — плановое снятие
хеджей.

## 5. Подчистка (без изменения поведения)

**U-1 [тест-инфра] EMFILE в двух тестах через баррель @mui/icons-material.**
`sidebar-node.tsx:3` импортирует `{ChevronLeft, ChevronRight}` из барреля — vitest без
tree-shaking тянет тысячи модулей; `workspace-tab-binding.test.ts` и
`sdui-catch-all-page.test.tsx` падают на импорте стабильно (проверено на свободной системе).
→ Правильный фикс — deep-импорты `@mui/icons-material/ChevronLeft` в sidebar-node (лечит все
будущие тесты разом, в отличие от точечных моков 619a2c4).

**U-2 Зомби-механизм layoutCode** (`dispatch.ts:115,142-144,151`, tree-store,
SduiSessionValue.getLayoutCode/setLayoutCode, sdui-screen.tsx:94,203-204, LanguageReopenDeps).
После SCRUM-290 OPEN route-only: layoutCode всегда null в продакшн-потоке, ненулевое значение
подают только тесты. Оставить только константу `APP_SHELL` в fetch-app-shell.
`Бэклог: covered (SCRUM-290).`

**U-3 Мёртвый экспорт** `isStrongSpanRow` (`report-result-view/lib/cell-helpers.ts:69`) — ноль
потребителей во всём src. Удалить.

**U-4 Неиспользуемые поля wire-типов**: `RelatedTreeRow._direction`/`._parentRowId`
(`related-docs.ts:17` — комментарий обещает несуществующий рендер-бранч),
`ViewTabMeta.icon`/`.closable` (`view.ts:84` — потребляется только kind). Либо удалить, либо
честный комментарий «зеркало wire-контракта, фронт не читает / резерв фазы 2» (по образцу
`TableCommandDescriptor.column`).

**U-5 Дубль форматтера ячейки**: `formatSduiCellValue` (format-cell.ts) vs
`formatReadonlyValue` (table-cell-editor.tsx:69) — BOOLEAN продублирован дословно,
DATE/DATETIME форматируются каждым по-своему. Свести к одному.

**U-6 Дубль табличной логики** editable-table vs buildColumnDefs — устраняется фиксом F-14
(колонки через buildColumnDefs), закрывает заодно F-15.

## 6. Карта удаления легаси

Проверка каждой записи: grep импортёров + роуты App.tsx + `kind-to-legacy.tsx` (что всё ещё
рендерит легаси на 422-фолбэке).

### 6.1 Удалять прямо сейчас: НИЧЕГО

Всё легаси либо на живом пути (явные роуты до задачи 9 SCRUM-290, kind-фолбэки, развилки
newView), либо является реализацией gateway для самого SDUI.

### 6.2 Удалять после конкретного условия

| Зона                                                                                                     | После чего                                                          | Примечание                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `widgets/sidebar`                                                                                        | SCRUM-289: стабильная работа APP_SHELL на среде                     | **ближайший кандидат** — живёт только как fallback у ShellSidebarHost (App.tsx:341)                                                  |
| `pages/documents/document-redirect`, `pages/dictionaries/dictionary-redirect`                            | SCRUM-290 задача 9 (снятие явных Route)                             | D-1; navigate-эффект бэка станет полным роутом                                                                                       |
| `pages/documents/document-list` + `widgets/document-list-toolbar`                                        | SCRUM-291 флип (SEARCH + enabled-types на все типы) + задача 9      | двойной рендер: Route + kind DOCUMENT_LIST                                                                                           |
| `pages/dictionaries` (list + legacy-entry)                                                               | SCRUM-291 (DICTIONARY_LIST) + newView-флипы + SCRUM-217 (?copyFrom) |                                                                                                                                      |
| `pages/reports`                                                                                          | SCRUM-291 флип enabled-codes                                        | **блокер**: `features/report-result-view` (gateway-реализация!) импортирует из pages/reports 9 файлов — сначала вынести общие модули |
| `pages/osv-report` + `pages/account-card` + `features/report-settings`                                   | SCRUM-291 (если ОСВ в enabled-codes; иначе тикета нет)              | account-card достижим только drill-down из ОСВ                                                                                       |
| `pages/reportalt` (только страница/роут)                                                                 | SCRUM-291                                                           | lib и settings-drawer остаются реализацией REPORT_RESULT-gateway                                                                     |
| `legacy-document-entry-page` + `features/tarifikatsiya` + `widgets/document-form-toolbar`                | пер-тип newView-флипы (сводного тикета нет)                         | вместе с ними умирает развилка document-entry-page                                                                                   |
| `features/form-renderer`, `features/generate-form-config`, `entities/form-config`                        | кластер newView-флипов + миграция dict-sidebar                      | form-config удаляется последним из кластера                                                                                          |
| `features/dict-sidebar`                                                                                  | endgame SCRUM-286: SDUI-пикер (таска не заведена)                   | самый глубокий узел: глобальный drawer + реализация reference-picker-gateway                                                         |
| `pages/documents/document-movements`                                                                     | тикета нет — завести                                                | report-result-view импортирует из него 2 модуля — переносить                                                                         |
| `pages/information-register`, `accumulation-register`, `accounting-register`, `widgets/eav-entity-table` | тикетов миграции регистров нет                                      |                                                                                                                                      |
| `pages/account-plan` + `widgets/account-plan-list-toolbar`                                               | тикета нет                                                          | связка с dict-sidebar-form-view                                                                                                      |
| `pages/financing-plan-upload` (DATA_PROCESSOR), `pages/universal-domain` (CALCULATION_PLAN)              | тикетов нет                                                         |                                                                                                                                      |
| `pages/module` + `widgets/module-toolbar`, `pages/main`                                                  | SCRUM-289 фаза 2 (WORKSPACE/TOP_BAR)                                |                                                                                                                                      |
| `widgets/top-bar`, `widgets/workspace-tab-bar`                                                           | SCRUM-289 фаза 2                                                    | resolve-page-type уходит вместе с tab-bar                                                                                            |
| `features/table-filter`, `shared/lib/eav`, `shared/lib/filter`, `shared/lib/dictionary-entry`            | после ухода всех EAV-списков и отчётно-регистровых страниц          | eav умирает последним из shared-легаси                                                                                               |

### 6.3 Остаётся (generic / реализация gateway)

`features/workspace-tabs` (generic-вкладки, SDUI использует легально),
`features/report-result-view` (реализация REPORT_RESULT-gateway — удаляемо только после
SDUI-нативного рендерера, не запланирован), `features/treasury-export` (узаконенный
легаси-контур, SDUI-эффект navigate от бэка ведёт на него; фаза 2 SCRUM-265),
`widgets/page-header`, `features/navigation-buttons`, `features/favorite-button` (generic-хром,
сжимается естественно).

### 6.4 Дыры бэклога — миграции без тикетов

Завести (или явно решить «не мигрируем»): движения (document-movements) · три регистра ·
план счетов · карточка счёта (drill-down ОСВ) · DATA_PROCESSOR · CALCULATION_PLAN ·
dict-sidebar endgame (SCRUM-286) · сводный тикет newView-флипов по типам документов.

## 7. Правки реестра отклонений (course-audit §9)

Реестр отстал от кода — предлагаемые записи:

- **D-2 — перевести в «снято»** (SCRUM-286: DOMAIN_PATH_MAP вычищен, grep пуст).
- **D-4 (new)**: `movements-api.ts` — знание `/api/view/movements/{id}`. Условие снятия: движения
  в SDUI-списке построчной командой (B-10).
- **D-5 (new)**: конвенция `list.*:{typeCode}` (F-18). Условие снятия: B-1.
- **D-6 (new)**: команды/пропсы CALENDAR (F-19). Условие снятия: B-2.
- **D-7 (new)**: ROW_LAYOUT бухблока (F-20). Условие снятия: B-3.
- **D-8 (new)**: PINNED_IDS/btn.more (F-23). Условие снятия: B-5.
- **D-9 (new)**: фолбэк entityRef в subordination-tree (F-24). Условие снятия: B-6.
- **D-3 — расширить** формулировку: кнопки/меню/вкладки (F-21, F-22) со снятием волной B-4.

Процессное правило (предложение): нода/спека, вводящая новое знание протокола, обязана в том же
PR добавлять строку в реестр — иначе через месяц снова «согласовано, но не отслеживается».

## 8. Сверка с аудитом 2026-07-02

| Было (2026-07-02)                                                                    | Статус 2026-08-12                                                                                                           |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1.1–1.5 имена команд/событий (SAVE_COMMANDS, addRow:, ref.select:, needsSelectedRow) | **Закрыто** (SCRUM-283/284/285)                                                                                             |
| 1.6 конвенция layoutCode                                                             | **Закрыто** (SCRUM-290), остался зомби-код — U-2                                                                            |
| 2.1 DOMAIN_PATH_MAP / D-2                                                            | **Закрыто и вычищено** — перевести D-2 в «снято»                                                                            |
| 2.2 dict-sidebar (7 эндпоинтов)                                                      | Живо за gateway; endgame-таска не заведена (§6.4)                                                                           |
| 2.3 двойная пагинация                                                                | **Закрыто** (SCRUM-287, единый `content`)                                                                                   |
| 3.2 каскад presentation                                                              | Схлопнут до `presentation ?? String(id)`                                                                                    |
| 3.3 разрешающие дефолты / D-3                                                        | Частично (волна A7: TABLE editable + allow\*); поля + кнопки/вкладки — F-21/F-22, волна B-4                                 |
| Shell 100% фронтовый                                                                 | Sidebar server-driven (289 ф.1), catch-all есть (290 ч.1); TopBar/Workspace — фаза 2 в бэклоге                              |
| C1 render-loop, C2 дедлок таблиц                                                     | Переработано (flush-таймаут реджектит, Symbol-реестр); **новые** баги той же зоны — F-2                                     |
| C3/B3 rules of hooks в развилке                                                      | **Закрыто** (хуки до условного return)                                                                                      |
| C4 409 чинит не ту сессию                                                            | Частично: panel getSession починен; **новое** — F-7 (CLOSE), F-8 (relay в панель)                                           |
| M1/M2 ререндер, stale revision в контексте                                           | **Закрыто** (useBindingValue, memo по tree/dirty); **новое** зеркало — F-12 (read-only нереактивны), F-3 (ревизия vs flush) |
| M8 нет runtime-валидации                                                             | Частично: патчи под zod; effects/tree — F-28                                                                                |
| M9 ложный dirty                                                                      | **Закрыто** (setFromServer)                                                                                                 |
| B1 SDUI→dict-sidebar напрямую                                                        | **Закрыто** (reference-picker-gateway, реализация в app/)                                                                   |
| B2 связка с workspace-tabs                                                           | **Закрыто** (пропсы-колбэки + workspace-tab-gateway)                                                                        |

Итог: из ~30 июльских пунктов закрыто или переработано ~22. Новая волна находок — не рецидив
старых, а следующий слой: жизненный цикл сессий, дубли табличной ветки, реестр отклонений.

## 9. Открытые вопросы

1. **Приоритизация волны 3.1** (сессии/ревизии): чинить кластером в один тикет или размазать?
   Рекомендация — один тикет «SDUI session lifecycle» на F-3…F-7 + отдельно F-1 (hot-fix).
2. **B-4 (запрещающие дефолты №2)** — согласовать с Alisher: одна волна фронт+бэк, как A7.
3. **Судьба дремлющей kind-to-legacy** (F-27): дополнять карточными kind или задокументировать
   границу? Зависит от плана задачи 9 SCRUM-290.
4. **Реестр отклонений**: принять процессное правило из §7?
5. Тикеты из §6.4 — заводить сейчас или после закрытия SCRUM-291?
