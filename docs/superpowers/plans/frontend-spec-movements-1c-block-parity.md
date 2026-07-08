# Frontend-spec: SDUI «Журнал проводок / ДтКт» — паритет со старой архитектурой (1С-блок + workspace-tab)

- **Дата:** 2026-07-08
- **Кому:** фронтендер `fin-web`
- **Область:** `fin-web/src/features/sdui/**`, `fin-web/src/features/workspace-tabs/**`, `fin-web/src/widgets/workspace-tab-bar/**`
- **Бэк-контекст:** `webbuh-api` — `MovementsComposer`, `DocumentMovementsByKindService`, `ViewController.processShowMovements`
- **Связано:** ADR-0012 (движения документа), ADR-0013 (COLUMN_GROUP), MEMORY `sdui-document-movements-spec`, `sdui-complex-tables-spec`

Цель — заставить **SDUI-движения** (ДтКт / регистры накопления и сведений) выглядеть **как старая routed-страница** `document-movements`, не отказываясь от server-driven payload. Решения владельца зафиксированы, ниже — как их реализовать.

> ⚠️ Часть пунктов требует доработки на **бэке** (координатор) — они вынесены в §5. Здесь, во §1–§4, — только фронт-работа; в §5 явно помечено, что фронт делать НЕ должен.

---

## §0. Цель и сравнение «до/после»

### Что видит пользователь сейчас (SDUI)
Кнопка «Движения»/«ДтКт» на форме документа → диспатчится `COMMAND showMovements` → бэк отдаёт `openDialog(tree)` + `setValue(binding, rows)`. Фронт (`dialog-host.tsx:96`) видит `presentation:'page'` и рисует **полноэкранную MUI `<Dialog fullScreen>`** — модалку поверх формы. Внутри — `TABS → TAB → TABLE(readOnly)`; бухрегистр рисуется **широкой таблицей** с двухуровневой шапкой ДЕБЕТ/КРЕДИТ (`ReadOnlyTable` в `table-node.tsx:165`), где каждое субконто/измерение — **отдельная широкая колонка**.

### Что было в старой архитектуре (эталон)
Routed-страница `/modules/:pageCode/document/:moduleCode/:entryId/movements` (`document-movements-page.tsx`), которая:
- открывается **реальной вкладкой рабочего стола** (`resolvePageType` → `'document-movements'`, `resolve-page-type.ts:5-7`), а не модалкой;
- бухрегистр рисует **1С-блоком** (`accounting-postings-table.tsx`): проводка = **блок из 3 строк**, субконто1/2/3 и аналитика — **вертикальной стопкой**, ДЕБЕТ/КРЕДИТ — две группы колонок, слева «N» (порядковый номер) и «Дата»;
- накопление/сведения рисует `MovementTable` (`document-movements-page.tsx:63`): колонки `Период`, `N`, затем атрибуты; период — `dd.MM.yyyy HH:mm:ss` (с секундами).

### Что должно стать (цель)
| Аспект | Сейчас (SDUI) | Должно (как старая) |
|---|---|---|
| Бухрегистр | широкая таблица, субконто — колонки | **1С-блок**: 3 строки, субконто/измерения стопкой |
| Контейнер | `<Dialog fullScreen>` | **workspace-вкладка** (bottom tab bar), honor `openInWorkspaceTab`/`tabKey` |
| Период | `dd.MM.yyyy HH:mm` (без секунд) | `dd.MM.yyyy HH:mm:ss` (**с секундами**) |
| Сумма | `12345.00` (точка, без разрядов) | `12 345,00` (запятая, разряды пробелами) |
| Колонка «N» | нет | есть (порядковый номер проводки/строки) |
| Накопл/свед | Период/ВидДвижения/…/Активность | Период/**N**/… (Активность — согласовать, §3) |

НЕ в scope: проваливание (onClick-навигация в субконто/документ) — Phase 2, отдельно.

---

## §1. Рендер бухгалтерских движений 1С-блоком

### §1.1. Как определить, что таблица — бухгалтерская
Бэк помечает **вид регистра** на узле `TAB` (не на `TABLE`!) в props `regKind` (`MovementsComposer.buildTab`, `MovementsComposer.java:576-588`; ключ `NodeProps.REG_KIND = "regKind"`). Значения: `"ACCOUNTING"`, `"ACCUMULATION"`, `"INFORMATION"`; там же `regCode` — транслит-код типа регистра.

Определение на фронте:
- **бухгалтерский** блок рисуем, если у ближайшего родителя-`TAB` `props.regKind === 'ACCOUNTING'`;
- всё прочее (`ACCUMULATION`/`INFORMATION`) — прежним `ReadOnlyTable` (см. §3).

> ⚠️ Сейчас `regKind` лежит на `TAB`, а не на `TABLE`. `TableNode` (`table-node.tsx:138`) не знает про родителя. Два пути: **(a)** прокинуть `regKind` в `TableNode` из `TabNode`/`TabsNode` через контекст/пропс; **(b)** попросить бэк дублировать `regKind` в props самого `TABLE` (в §5 помечено как желательная бэк-доработка, тривиально). Рекомендация: реализовать (b) — тогда `TableNode` самодостаточен: `node.props.regKind === 'ACCOUNTING'` → рендер 1С-блока.

### §1.2. Раскладка 1С-блока (эталон `accounting-postings-table.tsx`)
Переиспользовать структуру `AccountingPostingsTable` целиком — это уже готовый рендер. Отличие: **источник данных другой** (SDUI-строки по binding, а не `MovementGroup`), поэтому нужен **адаптер строк**, а не переписывание раскладки.

Шапка (эталон `accounting-postings-table.tsx:86-132`):
- ряд 1: `N` (rowSpan=4) · `Дата` (rowSpan=4) · **ДЕБЕТ** (colSpan=4) · **КРЕДИТ** (colSpan=4) · `Сумма` (rowSpan=4) · `Содержание` (rowSpan=4);
- ряды 2–4: `Счёт` (rowSpan=3) · [Субконто · Аналитика1 · Аналитика2] для Дт, затем то же для Кт. Метки строк — из `ROW_FIELDS`.

Тело: на каждую проводку — `<tbody class="group">` из **3 строк**; в первой строке `N`, `Дата`, `СчётДт`, `СчётКт`, `Сумма`, `Содержание` идут `rowSpan={3}` (эталон `:154-213`).

### §1.3. Маппинг SDUI-строк → ячейки 1С-блока
Бэк кладёт строки **плоской Map по binding** (`MovementsComposer.buildAccountingRows`, `MovementsComposer.java:269-329`). Строки читаются из view-state по binding таблицы `movements.acc.<regCode>` (напр. `movements.acc.ZhurnalProvodokGosUchrezhdeniya`).

**Точный список binding-ключей строки бухрегистра** (source of truth — `buildAccountingRows`):

| Ключ | Тип значения | Роль в 1С-блоке |
|---|---|---|
| `rowId` | string | key строки (`e.getId()`) |
| `_period` | string | «Дата» (формат — §1.4, ⚠ секунды) |
| `_accountDtCode` | string | «Счёт» Дт (жирный) |
| `_accountKtCode` | string | «Счёт» Кт (жирный) |
| `_summa` | string | «Сумма» (формат — §1.4) |
| `_soderzhanie` | string | «Содержание» |
| `_isActive` | boolean | не отображается в блоке (см. ниже) |
| `_isActiveLabel` | string («Да»/«—») | не отображается в блоке (см. ниже) |
| `_kolichestvo` | string (опц.) | строка-2, аналитика2 Дт/Кт |
| `_valyutnayaSumma` | string (опц.) | в 1С-блоке не показываем (нет в старом) |
| `_subkontoDt1` … `_subkontoDtN` | cell `{presentation,id,entityRef}` \| `""` | Дт: субконто по строкам 1..N |
| `_subkontoKt1` … `_subkontoKtN` | cell \| `""` | Кт: субконто по строкам 1..N |
| `_fkrDt` / `_fkrKt` | cell \| `""` | строка-1, аналитика1 (ФКР) Дт/Кт |
| `_spetsifikaDt` / `_spetsifikaKt` | cell \| `""` | строка-2, аналитика1 (Специфика) Дт/Кт |
| `_istochnikFinansirovaniyaDt` / `…Kt` | cell \| `""` | строка-3, аналитика1 (Источник) Дт/Кт |
| `_podrazdelenieDt` / `_podrazdelenieKt` | cell \| `""` | строка-1, аналитика2 (Подразделение) Дт/Кт |
| `_kodPlatnykhUslugDt` / `…Kt` | cell \| `""` | строка-3, аналитика2 (Код платных услуг) Дт/Кт |
| `_organizatsiya` | cell \| `""` | общее измерение (в блок можно не выводить) |

`cell` — объект `{ id, presentation, entityRef:{domain,id,presentation} }` (`buildSubkontoCell` `:335-355`, `buildRefOptionCell` `:364-378`). Пустое значение → **пустая строка `""`**, не `null`.

**Раскладка блока по строкам** (аналог `ROW_FIELDS`, `accounting-postings-table.tsx:26-35`), но с **side-specific** ключами (в старом ФКР/Спец/Источник использовали один ключ на обе стороны — в SDUI они разделены по сторонам, что корректнее):

| Строка | Дт: субконто · аналитика1 · аналитика2 | Кт: субконто · аналитика1 · аналитика2 |
|---|---|---|
| 1 | `_subkontoDt1` · `_fkrDt` · `_podrazdelenieDt` | `_subkontoKt1` · `_fkrKt` · `_podrazdelenieKt` |
| 2 | `_subkontoDt2` · `_spetsifikaDt` · `_kolichestvo` | `_subkontoKt2` · `_spetsifikaKt` · `_kolichestvo` |
| 3 | `_subkontoDt3` · `_istochnikFinansirovaniyaDt` · `_kodPlatnykhUslugDt` | `_subkontoKt3` · `_istochnikFinansirovaniyaKt` · `_kodPlatnykhUslugKt` |

Резолв ячейки: `cell.presentation` (объект) / строка как есть / число → формат (§1.4). Использовать существующий `resolveValue` (`accounting-postings-table.tsx:38-51`) — он уже понимает `{presentation}` (через `displayName`/`nameRu`/`name`; **добавить чтение `presentation`**, т.к. SDUI-ячейка несёт именно `presentation`).

**Заголовки строк блока (шапка).** В старом коде метки субконто/аналитики берутся из `group.columns` по коду (`accounting-postings-table.tsx:61-82`). В SDUI меток колонок в строке нет — их надо взять из **дерева колонок** узла `TABLE`: бэк строит `COLUMN_GROUP «ДЕБЕТ»/«КРЕДИТ»` с листьями-колонками (`buildAccountingColumns` `:195-264`), у каждого листа `props.label` и `props.binding`. То есть:
- метка «Счёт» / «Субконто N» / «ФКР» / «Специфика» / «Источник финансирования» / «Подразделение» / «Код платных услуг» → из `props.label` листа с соответствующим `binding` (`_accountDtCode`, `_subkontoDt1`, `_fkrDt`, …);
- метку субконто бэк уже резолвит по виду субконто (`resolveSubkontoLabel` `:398-420`) — брать её из label колонки, а не хардкодить.

Собрать `binding → label` из листьев `COLUMN_GROUP` (обход как `collectLeafColumns`, `table-node.tsx:37-41`) и использовать в шапке блока.

### §1.4. Формат (секунды, разряды, N)
- **Период (`_period`).** Бэк сейчас форматирует `dd.MM.yyyy HH:mm` **без секунд** (`MovementsComposer.PERIOD_FMT`, `:62`) — секунды уже потеряны в строке, фронт их не восстановит. ⇒ **бэк-доработка** (§5): либо форматировать `dd.MM.yyyy HH:mm:ss`, либо слать сырой ISO-datetime, а фронт отформатирует `formatDate(val, 'dd.MM.yyyy HH:mm:ss')` (утилита уже есть, `document-movements-page.tsx:82-85`). До бэк-фикса секунды не появятся.
- **Суммы (`_summa`, `_kolichestvo`, `_valyutnayaSumma`).** Бэк шлёт `toPlainString()` → `"12345.00"` (точка, без разрядов). Фронт приводит к `"12 345,00"` через **`formatWithSpaces`** (`format-cell-value.ts:6-16` — умеет точку→запятая + разряды). Это **фронт-работа**, делать в адаптере 1С-блока. Числовые ячейки — выравнивание вправо (`numeric` в старом `Val`, `accounting-postings-table.tsx:68-76`).
- **«N».** Порядковый номер проводки = `idx + 1` (эталон `:157`). **Фронт-работа**, чисто из индекса строки; в данных его нет.

### §1.5. Активность в бухрегистре
Бэк добавляет колонку «Активность»/`_isActiveLabel` (`:261`). **В старом 1С-блоке Активности нет** (см. шапку `accounting-postings-table.tsx:86-132`) — в блоке её **не рисуем**. Ключи `_isActive`/`_isActiveLabel` игнорируем.

### §1.6. Переиспользование vs адаптация
Рекомендация: **вынести раскладку в общий компонент** и подать в неё SDUI-строки.
- Вариант 1 (минимальные правки): скопировать/адаптировать `AccountingPostingsTable` в `features/sdui/ui/nodes/composite/accounting-postings-block.tsx`, заменив `MovementGroup` на `{ rows: Row[]; columnLabels: Map<binding,label>; subkontoCount: {dt,kt} }`. Число строк блока = `max(3, maxSubkontoDt, maxSubkontoKt)` — по данным колонок (бэк уже отдаёт `_subkontoDt1..N` динамически, `maxSubkontoCount` `:383-391`); для БГУ обычно 3, пустые ячейки рендерятся `""`.
- `TableNode` при `regKind==='ACCOUNTING'` → возвращает `<AccountingPostingsBlock>` вместо `ReadOnlyTable` (ветка в `table-node.tsx:161-162`).
- `resolveValue` расширить чтением `presentation` (SDUI-ячейка). Остальное (`formatWithSpaces`, `formatDate`, `cn`, `Typography`) переиспользуется из `shared`.

---

## §2. Контейнер: workspace-tab вместо `<Dialog>`

### §2.1. Что шлёт бэк (уже есть)
`MovementsComposer.compose` (`:165-176`) кладёт в props корневого `PAGE`:
- `title = "Движения документа"`;
- `presentation = "page"`;
- `openInWorkspaceTab = true` (`NodeProps.OPEN_IN_WORKSPACE_TAB`);
- `tabKey = "movements:<documentEntryId>"` (`NodeProps.TAB_KEY`).

`ViewController.processShowMovements` (`:802-828`) отдаёт `setValue(binding, rows)` (в родительскую сессию) + `openDialog(tree)`.

### §2.2. Как сейчас (проблема)
`dispatch.ts:46-64` (`openDialog`) читает только `presentation` и пушит `PanelEntry` в `panel-store`; `openInWorkspaceTab`/`tabKey` **не читаются нигде** (grep: единственное упоминание `presentation==='page'` — `dialog-host.tsx:96`). `DialogHost` рисует page как **fullScreen `<Dialog>`** (`:96-125`). Workspace-вкладка не заводится.

Дополнительно: строки движений лежат в **родительской** SDUI-сессии (панель page рендерится без своей сессии — `dialog-host.tsx:88`, `content = panel.session ? <PanelFormProvider> : <NodeRenderer>` — и читает `getValue` из **ambient** сессии формы-родителя). Диалог висит поверх ещё смонтированной формы, поэтому строки доступны.

> 🔑 **Ключевой риск при переносе в отдельную вкладку:** workspace-вкладки route-driven (`WorkspaceTabSync` создаёт вкладку из `location`, активация — `navigate(tab.path)`, `workspace-tab-bar.tsx:38-44`). Если движения станут отдельной вкладкой, **форма-родитель может размонтироваться** при переключении вкладок → строки в её view-state пропадут. Значит панель движений должна стать **самодостаточной по данным** (§2.4).

### §2.3. Как завести реальную вкладку
Workspace-tabs сегодня — только маршрутные (`WorkspaceTab.path`, `resolvePageType`). Движения — in-memory node-tree, не маршрут. Нужно **небольшое расширение** модели под «панельные» вкладки. Минимальный план:

1. **Тип вкладки.** В `workspace-tab.ts` добавить `TabPageType 'sdui-panel'` (или поле `panelId?: string`), чтобы вкладку можно было завести без маршрута.
2. **dispatch openDialog** (`dispatch.ts:46-64`): если `effect.node.props.openInWorkspaceTab === true`:
   - пушим `PanelEntry` в `panel-store` как сейчас (источник контента), но помечаем его (`openInWorkspaceTab:true`, `tabKey`);
   - регистрируем вкладку в `useWorkspaceTabsStore` по стабильному id = `tabKey` (напр. `"movements:123"`), с title из `props.title`, `pageType:'sdui-panel'`, и делаем её активной. Повторный показ того же документа переиспользует вкладку (совпадение id по `tabKey` — как `activateOrCreate` уже делает по `path`, `use-workspace-tabs-store.ts:41-48`). Нужна **panel-версия** `activateOrCreate`, которая не требует маршрута и не навигирует.
3. **Рендер контента вкладки.** В layout-области рабочего стола (там, где сейчас `<Outlet/>` для маршрутных страниц) при активной панельной вкладке рендерить контент панели (её `node` + состояние) **на всю область**, а не как `<Dialog>`. `DialogHost` для таких панелей `<Dialog>` **не рисует** (пропускает `openInWorkspaceTab`-панели). Т.е. `dialog-host.tsx:96` ветку `presentation==='page'` разделить: page **без** `openInWorkspaceTab` → как раньше (fullScreen Dialog); page **с** `openInWorkspaceTab` → рисуется layout'ом как вкладка.
4. **Активация/закрытие** (`workspace-tab-bar.tsx`): для панельных вкладок `handleActivate`/`performClose` не навигируют, а `setActiveTab` + при закрытии удаляют панель из `panel-store` (`usePanelStore.remove(panelId)`). Для маршрутных — прежнее поведение.

### §2.4. Самодостаточность данных панели (обязательно)
Чтобы вкладка пережила размонтирование формы-родителя, строки должны жить **в самой панели**, а не в родительской сессии. Два пути:
- **(A, рекоменд., бэк-доработка §5):** бэк отдаёт строки как **`childState` эффекта `openDialog`** (панель получает своё view-state; `dispatch.ts:53` уже кладёт `viewState: effect.childState ?? {}`). Тогда панель рендерится через провайдер собственного состояния и не зависит от родителя.
- **(B, без бэк-правок):** на фронте при открытии `openInWorkspaceTab`-панели **снять снимок** нужных bindings из родительской сессии в `PanelEntry.viewState`: обойти дерево, собрать binding'и всех `TABLE`, прочитать `session.getValue(binding)` и записать в `viewState` панели. Далее рендерить панель через локальный провайдер (расширить условие обёртки в `dialog-host.tsx:88`, чтобы page-панели всегда получали провайдер состояния, даже без `formSessionId`).

Рекомендация: (A) как надёжный контракт; (B) — если нужен фронт-only промежуточный результат.

### §2.5. Fallback (если расширять tab-модель дорого)
Промежуточно можно honor'ить `openInWorkspaceTab` минимально: оставить `panel-store`, но page-с-`openInWorkspaceTab` рисовать **не** `<Dialog fullScreen>`, а full-bleed контейнером в области контента + завести запись в `WorkspaceTabBar` как «указатель» на активную панель. Это даёт вкладку в нижней панели и не-модальный вид. Полный паритет (переключение между формой и движениями как между вкладками) требует §2.3–§2.4.

---

## §3. Накопление / сведения: выравнивание колонок

Эти вкладки (`regKind` `ACCUMULATION`/`INFORMATION`) остаются на `ReadOnlyTable` (`table-node.tsx:165`). Отличия от старого `MovementTable` (`document-movements-page.tsx:63-176`):

| Колонка | Старый `MovementTable` | SDUI сейчас | Действие |
|---|---|---|---|
| Период | есть, `dd.MM.yyyy HH:mm:ss` | есть, `_period` (без секунд) | секунды — §5 (бэк) |
| **N** | есть (`numberCol`, `:90-99`) | **нет** | добавить (см. ниже) |
| Вид движения (накопл) | нет | есть (`_movementKind`) | оставить (корректнее); согласовать с владельцем |
| атрибуты | по `sortOrder` | по `sortOrder` (метаданные) | ок |
| **Активность** | нет | есть (`_isActive`, «Да»/«—») | согласовать (§5) |

**«N» — фронт-работа.** Рекомендую **generic-механизм**: `ReadOnlyTable` honor'ит `props.showRowNumbers` (`NodeProps.SHOW_ROW_NUMBERS = "showRowNumbers"`, уже в контракте) → рисует ведущую колонку «N» = индекс+1. Это переиспользуемо и для ТЧ. Бэк проставляет `showRowNumbers=true` на таблицах движений (§5). Если бэк не проставит — фронт может форсить «N» для movement-таблиц по `regKind != null`.

**Активность / Вид движения — решение в §5** (бэк добавляет/убирает колонку). Фронт просто рисует те колонки, что пришли в дереве; отдельной фронт-работы (кроме «N») здесь нет.

---

## §4. Приёмка

Открыть проведённый документ (напр. РКО / поступление ОС), нажать «Движения»/«ДтКт», сверить с routed-страницей `…/movements` (старой):

1. **Бухрегистр — 1С-блок:** проводка = блок из 3 строк; субконто1/2/3 и аналитика — вертикальной стопкой; ДЕБЕТ/КРЕДИТ — две группы; слева «N» и «Дата». Ширина не «расползается» в широкую таблицу.
2. **Период** — `dd.MM.yyyy HH:mm:ss` (**секунды видны**) во всех вкладках (после бэк-фикса §5).
3. **Суммы** — `12 345,00` (пробелы-разряды, запятая), выравнивание вправо.
4. **Контейнер** — **вкладка** в нижней панели рабочих столов (не модалка); переключение между формой и движениями как между вкладками; повторный клик «Движения» того же документа переиспользует вкладку (`tabKey`), не плодит дубли; крестик закрывает вкладку.
5. **Накопление/сведения** — есть «N»; состав колонок согласован (Активность — по решению §5).
6. `npm run build` — без ошибок TypeScript.
7. Регресс: обычные SDUI-диалоги (`presentation:'modal'`/`'drawer'`, ссылочные drawer'ы) работают как прежде — ветка `openInWorkspaceTab` их не задевает.

---

## §5. Нужно от БЭКА (для координатора — это НЕ фронт-работа)

Список бэк-доработок в `webbuh-api`, без которых фронт не добьёт паритет:

1. **Период с секундами.** `MovementsComposer.PERIOD_FMT` (`MovementsComposer.java:62`) сейчас `dd.MM.yyyy HH:mm`. Старая страница показывает **`dd.MM.yyyy HH:mm:ss`**. Решение: поменять формат на `dd.MM.yyyy HH:mm:ss` (единообразно в `formatPeriod` `:634-636` и в `buildRegisterRows` `:500-502`, а также в `formatRegisterValue` для `LocalDateTime` `:560-561`). Затрагивает бух-, накопл- и свед-строки. *(Альтернатива: слать сырой ISO-datetime и дать фронту форматировать — но это ломает нынешний контракт «фронт делает только String(value)», поэтому проще форматировать секунды на бэке.)*

2. **`regKind` на узле `TABLE`.** Сейчас `regKind`/`regCode` только на `TAB` (`buildTab` `:576-588`). Чтобы `TableNode` был самодостаточен (не тянул родителя), продублировать `regKind` (и при желании `regCode`) в props самого `TABLE` (`buildTable` `:590-601`). Тривиально; ключ `NodeProps.REG_KIND` уже документирует «(TAB, TABLE)».

3. **Колонка «N» / `showRowNumbers`.** Проставлять `props.showRowNumbers = true` (`NodeProps.SHOW_ROW_NUMBERS`) на всех `TABLE` движений (в `buildTable` для движений). Тогда фронт-`ReadOnlyTable` и 1С-блок рисуют «N» по общему контракту. *(Фронт может форсить «N» и без этого, но флаг чище.)*

4. **Самодостаточные данные панели (для workspace-tab).** Сейчас строки едут `setValue(binding, rows)` в **родительскую** сессию (`ViewController.processShowMovements` `:817`), а панель page рендерится без своей сессии и читает из родителя. Для переноса в отдельную вкладку (которая переживает размонтирование формы) отдавать строки как **`childState` эффекта `openDialog`** (панель = своё view-state). Т.е. `MovementsResult.rowsByBinding` класть в `openDialog`-эффект как childState, а не (только) в родительский `setValue`. *(Фронт-only обходной путь — снимок из родительской сессии, §2.4-B — но бэк-childState надёжнее.)*

5. **Активность в накопл/свед — решение по составу колонок.** Старый `MovementTable` **не показывает** «Активность» (колонки только Период/N/атрибуты, `document-movements-page.tsx:114`). SDUI-композитор добавляет «Активность»/`_isActive` (`buildAccumulationColumns` `:440`, `buildInformationColumns` `:457`). Нужно **согласовать с владельцем**: для строгого паритета — убрать колонку «Активность» из `buildAccumulationColumns`/`buildInformationColumns`; либо оставить (1С в журнале регистра её показывает) с явным sign-off. Аналогично «Вид движения»/`_movementKind` в накоплении (`:433`) — в старом его нет; вероятно оставить (корректнее), но подтвердить.

6. **Активность в бухрегистре — не критично.** Композитор добавляет «Активность»/`_isActiveLabel` в бухрегистр (`:261`); в старом 1С-блоке её нет. Фронт её просто не рисует (§1.5) — бэк можно не трогать, но при желании убрать колонку для чистоты дерева.

### Разделение труда
- **Фронт:** §1 (1С-блок: адаптер строк, `resolveValue` + `presentation`, `formatWithSpaces`, «N» из индекса, игнор Активности), §2 (honor `openInWorkspaceTab`/`tabKey`: panel-tab модель, layout-рендер, активация/закрытие, снимок состояния если без бэк-childState), §3 («N» через `showRowNumbers`).
- **Бэк (координатор):** §5.1 (секунды), §5.2 (`regKind` на TABLE), §5.3 (`showRowNumbers`), §5.4 (childState), §5.5/§5.6 (согласование Активность/ВидДвижения).
