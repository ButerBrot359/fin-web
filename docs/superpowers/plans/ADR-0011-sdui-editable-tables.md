# ADR-0011 — Редактируемые табличные части (ТЧ) в SDUI

- **Статус:** Proposed (challenger round-trip 2 раунда + разворот на server-driven, PM-директива владельца — см. §2.5, §9)
- **Дата:** 2026-06-22 (ревизия: server-driven рамка по образцу ADR-0010 раунд 5)
- **Owner (предложил):** пользователь (цель, анализ, server-driven-директива); формализация — architect
- **Затрагивает:** webbuh-contract (`NodeProps`, `ViewActionDto`, при необходимости `ViewPatchDto`), webbuh-api (`view/` — `NodeBuilder`, `WidgetResolver`, `ViewComposer`, `ViewController`, новый `TableRowComposer`/расширение handler-контракта; SDUI-handler заявки ГП), frontend (`fin-web` — `table-node.tsx`, переиспользование редакторов из `form-renderer/table-field.tsx`), data-engineer (атрибуты ТЧ графика, layout-сид), 1С-агенты (структура ТЧ)
- **Опирается на (НЕ переоткрывает):** [ADR-0005 — SDUI architecture](ADR-0005-sdui-architecture.md), [ADR-0006 — SDUI stateful form-session](ADR-0006-sdui-stateful-form-session.md) (scratch-модель, §3.5.7), [ADR-0009 — server-driven ссылочное поле](ADR-0009-sdui-server-driven-reference-field.md) (ссылочные ячейки, `RefEndpointResolver`/`optionsSource`), [ADR-0010 — командная панель](ADR-0010-sdui-command-bar.md) (ТЧ-кнопки каталога **исключены**, тут только add/delete/move строк)
- **Связано с:** [docs/project/sdui/frontend-spec-tables.md](../sdui/frontend-spec-tables.md) (фронт-контракт), [sdui-architecture.md](../sdui/sdui-architecture.md), MEMORY: [[sdui-sync-contract]], [[sdui-render-contract]]

---

## 1. Контекст

### 1.1 Цель (решено с пользователем)

Полностью **редактируемая** табличная часть (ТЧ) в SDUI: инлайн-правка ячеек + add/delete/reorder строк + построчный пересчёт (`Кол-во × Цена = Сумма`, итоги документа) + сохранение строк. Прувпойнт — реальная ТЧ **«График платежей»** в пилоте `ZayavkaNaRegistratsiyuGPSdelki` (в старой форме была; флаг `IspolzovatGrafikPlatezhey` и вкладка уже в layout-сидах).

### 1.2 Что есть сейчас

**Фронт (fin-web) — два движка таблиц:**

- SDUI `sdui/ui/nodes/composite/table-node.tsx` — **read-only, push-модель**. Строки из `getValue(node.binding)` (массив `{rowId, [colBinding]:val}`), колонки = дочерние `TABLE_COLUMN` (props `label`/`binding`/`flex`), ячейка = `String(row[col.binding])`. Add/Delete — COMMAND `addRow:${binding}` / `deleteRow:${binding}:${rowId}` (props `allowAdd`/`allowDelete`). НЕТ инлайн-правки, НЕТ reorder. Патчи insertNode/removeNode/replaceNode/setValue применяются.
- Легаси (вне SDUI) `form-renderer/ui/table-field.tsx` — **полностью редактируемая ТЧ** на react-hook-form `useFieldArray` + TanStack Table: инлайн-редакторы ячеек (`TableCellRenderer` по `col.dataType`), add/delete/**reorder (move up/down)**, выбор строки, регистрация `replace` для обновления данных из event-ответов. Это и есть функциональность, которую нужно перенести в SDUI table-node.

**Бэк (webbuh-api) — EAV-фундамент ТЧ готов, но к SDUI не подключён:**

- Модель строк: `AttributeDataType.TABLE`; строки = дочерние `DocumentEntry`, FK `tableValueOwner` → родительский `DocumentValue` TABLE-атрибута; тип строки — `attribute.allowedTypes[0]` (domainKind=DOCUMENT); колонки строки = `DocumentValue` на row-entry; порядок — `sortOrder`. `ValueFieldHelper` для TABLE — no-op (`case TABLE -> { /* вне области ответственности */ }`, строки 205/264) и `getObjectAsSduiValue` → `null` (строка 345).
- `TablePartHelper` — готовый CRUD: `getRows`/`getRow`/`countRows`/`findRows`, `getDecimal`/`getLong`/`getString`, `sumColumn`/`sumColumns`/`setHeaderTotal`, `recalcRowSum(row,priceCol,qtyCol,sumCol)`, `addRow(parent,tableCode,Map)`/`removeRow`/`clearRows`/`collapseByKeys`. Зовётся только легаси-хендлерами; к SDUI не подключён.
- `NodeBuilder` распознаёт `LayoutNodeType.TABLE/TABLE_COLUMN` → `NodeType.TABLE/TABLE_COLUMN`, но строки в `value` **не сериализует**; `ViewComposer.buildStateSnapshot` для TABLE кладёт `null` (через `serializeValueAsDto` → `getObjectAsSduiValue` → `null`). Строки сейчас доезжают только через `setValue(binding, List<Map>)` — паттерн read-only диалога ДтКт (`dtkt.rows`).
- **Синхронизация правок ячеек НЕ реализована.** `applyActionValueToEntryAndScratch` резолвит только плоские `sourceNodeId`→attrCode через `handler.resolveAttributeCode`; scratch — **плоский** `Map<attrCode,value>` (ADR-0006 §3.5.7), вложенных строк не держит; `captureSetValuePatchesToScratch` **намеренно исключает** binding с точкой (чтобы синтетические `dtkt.rows` не оседали в scratch).
- **Save (ключевое уточнение к анализу):** `SduiSaveService` → `DocumentService.saveEntry` **УЖЕ умеет** persist'ить одноуровневые строки ТЧ. `saveTableAttributes`/`saveTableRows` (`DocumentService.java:244,567-617`): берёт из `dto.attributes` значение TABLE-атрибута как `List<Map<String,Object>>`, **full-replace** (bulk-delete старых строк `bulkHardDeleteByTableValueOwnerId` + recreate), `saveTableRowValues` пишет колонки строки. **Не поддерживается только ТЧ-в-ТЧ** (`saveTableRowValues:648-650` — `log.warn` и skip). Значит save строк из scratch работает **без правок saveEntry**, если scratch отдаёт `attributes[tableCode] = List<Map>`.

### 1.3 Структура ТЧ «График платежей» (от analyst-1c, по OData-метаданным БГУ КЗ)

Подтверждено живыми OData-метаданными конфигурации (`Document_ЗаявкаНаРегистрациюГПСделки_ГрафикПлатежей`, источник `docs/project/sverka-1c/odata/1c-odata-metadata-full.xml`). ТЧ `ГрафикПлатежей` → 4 реквизита:

| 1С-имя | OData-тип | `AttributeDataType` | Java-код (транслитерация) | Виджет ячейки |
|---|---|---|---|---|
| `НазначениеПлатежа` | `Edm.String` | `STRING` | `NaznacheniePlatezha` | TEXT_FIELD |
| `ДатаОплаты` | `Edm.DateTime` | `DATE` | `DataOplaty` | DATE_FIELD |
| `ПроцентОплаты` | `Edm.Int16` | `INTEGER` | `ProtsentOplaty` | NUMBER_FIELD |
| `СуммаОплаты` | `Edm.Double` | `DECIMAL` | `SummaOplaty` | NUMBER_FIELD |

ТЧ-атрибут шапки: `ГрафикПлатezhey` → `GrafikPlatezhey` (`AttributeDataType.TABLE`). Флаг: `IspolzovatGrafikPlatezhey` (`AttributeCodes.ISPOLZOVAT_GRAFIK_PLATEZHEY`, уже есть).

**Транслитерация (сверена посимвольно по [docs/project/transliteration-1C-java.md](../transliteration-1C-java.md)):**
- `ПроцентОплаты`: Процент = П-р-о-**ц**-е-н-т → `Protsent` (Ц→`Ts`, строка 46 таблицы), + `Oplaty` = **`ProtsentOplaty`**. ⚠ analyst-1c прислал `ProtsentsOplaty` (лишняя `s`) — **исправлено**, в коде/сиде использовать `ProtsentOplaty`.
- `НазначениеПлатежа` → `NaznacheniePlatezha`; `ДатаОплаты` → `DataOplaty`; `СуммаОплаты` → `SummaOplaty`; `ГрафикПлатежей` → `GrafikPlatezhey`. (Ж→`zh`, я→`ya`.)
- CI-гейт `TransliterationConsistencyTest` прогнать после заведения кодов.

**Бизнес-логика (от analyst-1c + developer-1c, ИТС-ссылки в §8):**
- Сумма документа в типовой конфигурации пересчитывается **не из ТЧ графика**, а из шапки (`СуммаГод1+2+3`); график — плановый/информационный (в проводки `onPost` **не** участвует — подтверждено ObjectHandler пилота). Для прувпойнта применяем **синтетический, но реалистичный** построчный пересчёт `СуммаОплаты = СуммаДокумента × ПроцентОплаты / 100` и контроль `Σ(ПроцентОплаты)=100` / `Σ(СуммаОплаты)=СуммаДокумента` — это и демонстрирует механику пересчёта, и соответствует типовой логике «график по процентам» (отмечено как design-выбор пилота, не как 1С-инвариант).
- Контроль (`onCheckFilling`): при `IspolzovatGrafikPlatezhey=true` ТЧ непустая; в строке `ДатаОплаты` обязательна, `СуммаОплаты>0`; `НазначениеПлатежа` — Nullable, **не** required.

### 1.4 Что не переоткрывается

Stateful form-session, revision, patch-first, scratch (ADR-0006); инварианты SDUI (сервер — авторитет, клиент — рендерер, layout — метаданные); ссылочные поля и `RefEndpointResolver`/`optionsSource`/`ref.*` (ADR-0009) — используем для ссылочных ячеек как есть; командная панель (ADR-0010) — ТЧ-кнопки каталога вне scope. LIST-узел (PULL, ADR-0009) — **другой паттерн** (paged read-grid выбора), ТЧ его не трогает.

---

## 2. Решение — обзор

ТЧ становится **редактируемым TABLE-узлом**, чья истина строк до save живёт в **scratch** (новый документ id=null — в БД писать нельзя), сериализуется на провод как `List<Map>` под `binding=tableCode`, сохраняется штатным `saveEntry` (который уже умеет TABLE-строки). Гранулярность синхронизации — **table-level change** (фронт шлёт весь массив строк одним EVENT), не per-cell. Обоснование обоих ключевых решений — §9 (challenger).

Семь рабочих частей: модель строк на проводе (§3), колонки и виджеты ячеек (§4), гранулярность sync + резолв (§5), вложенный scratch (§6), row CRUD + reorder (§7), пересчёт (§8 в коде / §3.6), save (§3.7), валидация (§3.8). Прувпойнт ГП — §3.9.

**Рамка решения — server-driven дисциплина (§2.5), по образцу ADR-0010 раунд 5.** Структура таблицы — серверные **метаданные** (не Java-код handler'а); **вся** табличная логика (пересчёт, итоги, валидация, производные значения, правила CRUD) исполняется **на бэке**; фронт — **чистый рендерер** (рисует присланную таблицу, шлёт EVENT, применяет патчи). Тот же шов «статика → данные / поведение → код», что у командной панели.

---

## 2.5 Server-driven дисциплина для таблиц (PM-директива владельца; согласовано с ADR-0010 §3.4.7)

Цитата владельца: «Логику построения таблиц, их рендеринг и все взаимодействия необходимо проводить на бэке». Применяем **ту же** рамку, что закреплена для командной панели в ADR-0010 раунд 5 (разворот на data-driven). Это не меняет механику §3–§8, а задаёт дисциплину источников.

### 2.5.1 Структура таблицы = ДАННЫЕ/МЕТАДАННЫЕ, не Java

**Ни один handler НЕ объявляет структуру таблицы в коде.** Состав и вид таблицы — серверные метаданные:
- **какие колонки, порядок, заголовки RU/KZ, ширина/flex, editable/readonly, required, тип-виджет ячейки** → `layout_nodes`(TABLE/TABLE_COLUMN) + `layout_node_props` + `dataType` EAV-атрибута колонки (тип строки `allowedTypes[0]`);
- для ссылочных ячеек (Phase 2) **домен/typeCode/фильтр** → метаданные колонки (`optionsSource` через `RefEndpointResolver`, как в ADR-0009) — **не** хардкод в handler'е.

**Подтверждение data-driven (усиление):** колонки **уже** идут из layout (`TABLE_COLUMN` из `layout_nodes`, читаются `NodeBuilder`'ом) — это data-driven by construction. `TableRowComposer` **только сериализует данные строк** (читает EAV через `getRows` → `List<Map>`), **не декларирует UI**. `editable/readonly/required/label/flex` — из `layout_node_props` колонки + флагов EAV-атрибута (`isRequired`, `readonly`). Handler в этой части **не участвует**.

**Cell-widget: явный override в метаданных поверх Java-дефолта (поправлено после challenger C6).** Честно: `WidgetResolver.resolveFieldNodeType(dataType)` — это жёсткий `switch(dataType)` **в Java** (`WidgetResolver.java:45-63`), маппинг `dataType→widget` 1:1. Для дефолтного случая (DATE→DATE_FIELD и т.п.) — это детерминированная функция от метаданных-входа, приемлемо. Но **нестандартный виджет** колонки (DATE-атрибут с текст-маской, DECIMAL со slider, STRING с автоподстановкой) был бы невыразим в данных и потребовал бы правки `WidgetResolver` (=Java определяет UI) — ровно та дыра, что ADR-0010 закрыл для кнопок. Закрываем симметрично: **prop `cellWidget` в `layout_node_props` колонки ПЕРЕКРЫВАЕТ `resolveFieldNodeType`.** Резолв: `cellWidget = layout_node_props["cellWidget"] ?? resolveFieldNodeType(colAttr.dataType)`. Тогда **вид ячейки реально в данных**: switch — только дефолт, нестандартный виджет задаётся строкой метаданных без правки кода. Это honors директиву «всё в данных» и убирает Java-исключение, в отличие от печати в ADR-0010 (которую там оставили Java-исключением осознанно).

> **Шов идентичен ADR-0010 §3.4.7:** «ЧТО за элементы, где, как выглядят» → серверные метаданные; «что ДЕЛАЕТ взаимодействие» → код handler'а (обработка). Для кнопок: реестр `command_bar_items` (данные) vs `handleCommand` (код). Для таблиц: `layout_nodes`/`layout_node_props`/EAV-атрибуты колонок (данные) vs `onTableChanged`/`onCheckFilling` (код). **Двойного стандарта нет.**

### 2.5.2 ВСЕ взаимодействия — на бэке; фронт = чистый рендерер

**Фронт НЕ вычисляет НИЧЕГО:**
- **не пересчитывает** `Сумма = Кол-во × Цена`, не считает итоги документа;
- **не валидирует** (обязательность колонок, контроль сумм/процентов);
- **не выводит производные** значения;
- **не реализует правила** add/delete/reorder (бизнес-эффект CRUD — серверный; локально фронт лишь меняет массив для показа, §2.5.4).

Легаси `form-renderer/table-field.tsx` делал пересчёт/валидацию локально на react-hook-form — **в SDUI это всё уезжает на сервер**. Фронт: (1) рендерит присланную таблицу (колонки+строки+редакторы ячеек по серверной спеке props), (2) шлёт EVENT на изменение, (3) применяет вернувшиеся патчи (результаты пересчёта строк/итогов, ошибки валидации `setProp(error)`). Перечень «что фронт больше НЕ делает» — frontend-spec §фронт-дельты.

### 2.5.3 Граница ДАННЫЕ ↔ КОД (для таблиц) — согласована с ADR-0010

| Аспект | Источник | Параллель в ADR-0010 |
|---|---|---|
| **Статическая композиция**: колонки, типы/виджеты ячеек, editable/readonly, required, порядок, заголовки, ширина, ref-домен | **метаданные** (`layout_nodes`/`layout_node_props` + EAV `dataType`) | реестр `command_bar_items` (§3.4.7) |
| **Что ДЕЛАЕТ взаимодействие**: формула пересчёта (`onTableChanged`), правило валидации (`onCheckFilling`), эффект CRUD над строками | **КОД handler'а, исполняется на бэке** (это поведение, не статический UI) | `handleCommand` (§3.4.7) |
| **Динамика по состоянию**: видимость вкладки/колонки/строки от значения поля (напр. `IspolzovatGrafikPlatezhey`) | **`setProp`-патч handler'а** (не декларативное `visibleWhen`) | `setProp`-патчи, §3.2 ADR-0010 |

**Пересчёт остаётся Java-поведением (решение, обосновано — честная формулировка, challenger C4).** Формула пересчёта строки/итогов — **бизнес-логика**, аналог `handleCommand` у кнопок: исполняется на бэке в `onTableChanged`. Декларативные формулы в метаданных (типа `SummaOplaty = ProtsentOplaty * СуммаДокумента / 100` строкой в `layout_node_props`) **в Phase 1 НЕ вводим**.

**Честное обоснование (поправлено после challenger C4).** Не утверждаем «формальной границы простое-vs-сложное не существует» — это было бы неточно: для **арифметики** граница как раз ЕСТЬ (в 1С `Сумма=Кол-во×Цена` считается декларативно-просто `&НаКлиенте`, серверный вызов — только за данными регистра; developer-1c, ИТС §11). Это отличает ситуацию от `visibleWhen` в ADR-0010, где условной видимости в 1С **нет вообще**. Поэтому формулировка: **граница для арифметики существует, но мы СОЗНАТЕЛЬНО не декларативизируем даже простую арифметику в Phase 1**, потому что (1) два механизма пересчёта на одном классе задач (декларативный DSL + кодовый `onTableChanged`) = разнобой между типами и двойная точка правды; (2) полноценный DSL формул (с зависимостями шапка↔строка, агрегатами, условиями) — отдельная фаза с формально перечислимым набором операций, не Phase 1; (3) единый source-of-truth расчёта на бэке важнее экономии одного round-trip на умножении (round-trip триггерится на commit ячейки, не на keystroke — §2.5.4). Шов: **структура → данные; любой расчёт/валидация/CRUD-эффект → код-handler на бэке.** С ADR-0010 согласовано в сути (поведение=код), но обоснование **не** через ложную симметрию «границы нет» — для таблиц граница есть, мы её осознанно не используем в Phase 1. Двойного стандарта нет: и кнопки, и таблицы держат **поведение** в коде; декларативизацию **поведения** обе фичи откладывают (кнопки — `visibleWhen`, таблицы — формулы) с явным обоснованием каждая.

### 2.5.4 Round-trip / латентность — UX-контракт (главное под «всё на бэке»)

Раз вся логика на сервере, изменение должно дойти до бэка. Триггеры и эхо:

- **EVENT-round-trip — на COMMIT ячейки (blur / Tab / Enter / уход из ячейки), НЕ на каждый символ.** Это **тот же триггер, что в 1С**: событие `ПриИзменении` поля ввода ТЧ срабатывает при завершении редактирования ячейки, не на keystroke (developer-1c, ИТС §11). Фактическая латентность = один HTTP-запрос при переходе между ячейками — субъективно приемлемо при thin-обработчике (50–150 мс).
- **Оптимистичный локальный ЭХО-показ — ДА, но без вычислений.** Фронт сразу отрисовывает **введённый пользователем символ/значение** в редактируемой ячейке (echo для отзывчивости ввода), но это **показ ввода, не вычисление**: фронт **НЕ** пересчитывает `SummaOplaty`, **НЕ** считает итоги, **НЕ** валидирует. Истина и все производные — серверные; патч ответа перезаписывает канон.
- **UX-контракт производных:** до возврата патча итоги/вычисляемые колонки (`SummaOplaty`, `СуммаПоГрафику`) показываются **«как есть от сервера»** (последнее серверное значение), локально **НЕ** пересчитываются. После ответа `onTableChanged` — `setValue`-патч обновляет их канонично. Между commit и патчем вычисляемая ячейка может на ~100 мс показывать прежнее значение — это честный server-driven trade-off, не баг.
- **Совместимость с table-level.** Эхо без вычислений совместимо с table-level (§3.4): фронт echo-редактирует локальный массив **только для показа** введённого, на commit шлёт весь массив, сервер пересчитывает и возвращает канон (нормализованный массив + итоги). Эхо **не воссоздаёт клиентскую логику** — оно отражает только то, что пользователь набрал, не выводя ничего нового.

#### 2.5.4а UX-контракт «commit при незавершённом in-flight» (challenger C1/C2 — критично)

ADR-0006 гасит гонку revision правилом «один in-flight на сессию». При commit-on-blur + table-level это создаёт коллизию: пользователь правит ячейку A, blur → EVENT(массив) уходит in-flight; пользователь сразу правит ячейку B, blur → второй commit, но первый ещё in-flight. **Опасность C2:** ответ на первый commit несёт `setValue(tableCode, <весь массив>)` (replace, §3.6) — он **перетёр бы** правку B, сделанную после отправки первого, но до его ответа. Очередь EVENT'ов вернула бы гонку через replace-всего-массива; merge-by-rowId на фронте = клиентская логика, запрещённая §2.5.2.

**Решение — coalescing последнего снимка, НЕ очередь расходящихся правок:**
1. **Один in-flight table-EVENT на ТЧ.** Пока commit A in-flight, фронт **не шлёт** новый commit, а копит правки в **локальном dirty-снимке** (echo-показ, §2.5.4) — это не вычисление, а накопление пользовательского ввода.
2. **При возврате ответа A** фронт применяет серверный канон **как новую базу**, затем **поверх** накладывает СВОЙ dirty-снимок (правки B/C, ещё не отправленные) и **сразу шлёт коалесцированный commit** (актуальный полный массив). Наложение dirty поверх канона — это **re-apply пользовательского ввода**, не merge-вычисление: фронт знает, какие ячейки пользователь трогал после отправки, и переносит их сырые значения; вычисляемые (`readonly`) ячейки берутся из канона (сервер их посчитал). Так replace не теряет ввод, а гонка схлопывается в «последний снимок выигрывает».
3. **Фокусируемая ячейка не перетирается:** ячейка, которую пользователь редактирует **прямо сейчас** (фокус), хранит uncommitted-значение в самом редакторе; replace массива обновляет невредактируемые строки, активный редактор сохраняет ввод до своего blur (стандартное поведение controlled-input).

**Граница «эхо vs клиентская логика» (явно, C1):** dirty-снимок несёт **только сырые значения, введённые пользователем** (что он напечатал/выбрал). Он **НЕ** содержит производных (`SummaOplaty`, итоги) — те всегда из последнего канона. Перенос сырого ввода поверх канона — это re-apply ввода, не вычисление. Грань: фронт переносит **ввод**, сервер даёт **производные**.

**Что зафиксировать (если fin-web уже решает это иначе — спека уточняется):** frontend-spec §round-trip описывает coalescing + re-apply dirty. Это единственное место, где фронт «помнит» свой ввод между отправкой и ответом — и это память ввода, не логика.

### 2.5.5 CI-гейт-аналог (связь метаданные ↔ код), по образцу ADR-0010 «orphan=error»

Усиление зависимостей §3.7/§3.9 до acceptance/CI-гейта (аналог `CommandBarRegistryConsistencyTest`):
1. **Каждая колонка в метаданных (`TABLE_COLUMN.attributeCode`) ссылается на существующий EAV-атрибут** типа строки (`allowedTypes[0]` документа). Orphan-колонка (нет атрибута) = **error**.
2. **TABLE-атрибут имеет `allowedTypes[0]` (domainKind=DOCUMENT)** — без него `saveTableRows` роняет весь save (`DocumentService:581-584`). Усилено с «блокирующей зависимости» до **acceptance/CI-гейта**: проверка на прод-сиде, отсутствие = error.
3. **Транслитерация `attrCode` колонок и tableCode** — по `docs/project/transliteration-1C-java.md`; прогон `TransliterationConsistencyTest`. (Исправление `ProtsentsOplaty`→`ProtsentOplaty` уже в §1.3.)
4. **Round-trip serialize→save для ГП** (ключ колонки в `TableRowComposer` ≡ `attr.code` типа строки ≡ сид) — иначе `saveTableRowValues:629-632` молча роняет ячейку (challenger B3). Источник истины гейта = прод-сид (как в ADR-0010 §3.4.7 п.1).

---

## 3. Решение — детально

### 3.1 Модель строк на проводе

Значение TABLE-узла = массив строк:

```jsonc
[
  { "rowId": "r1", "NaznacheniePlatezha": "Аванс", "DataOplaty": "2026-07-01",
    "ProtsentOplaty": 30, "SummaOplaty": 300000.00 },
  { "rowId": "r2", "NaznacheniePlatezha": "Окончательный", "DataOplaty": "2026-09-01",
    "ProtsentOplaty": 70, "SummaOplaty": 700000.00 }
]
```

- `rowId` — **стабильный идентификатор строки** (см. §3.5). Для сохранённых строк = `String(documentEntry.id)`; для новых (несохранённых) = синтетический `tmp-<n>`. Фронт обязан сохранять `rowId` неизменным при правках/reorder.
- Ключи колонок = **attrCode колонки** (`column binding`), значения по типу:
  - примитивы (`STRING/INTEGER/DECIMAL/DATE/...`) — как есть;
  - **ссылочные ячейки** (`DICTIONARY/ENUMS/...`) — `{id, presentation}` (как в [[sdui-sync-contract]]/[[sdui-render-contract]]), сериализуются через `ValueFieldHelper.getObjectAsSduiValue` (НЕ через DTO) — паритет со ссылочными полями шапки.

**Сериализация на бэке (фикс «строки в value=null»):** новый `TableRowComposer` (или метод в `NodeBuilder`) для TABLE-узла:
1. `tableRows = tablePartHelper.getRows(entry, tableCode)`;
2. для каждой строки — `Map<colAttrCode, sduiValue>` посимвольной сериализацией колонок через `valueFieldHelper.getObjectAsSduiValue(rowValue, colAttribute)`; `rowId = String(row.getId())`;
3. результат кладётся в `node.value` (TABLE-узел) **и** в `buildStateSnapshot` под `binding=tableCode` (сейчас там `null` — это фикс; `ViewComposer.buildStateSnapshot` для TABLE-атрибута вызывает `TableRowComposer`, а не `serializeValueAsDto`→null).

`NodeBuilder` обходит дочерние `TABLE_COLUMN` для props колонок (§4), но **сами строки** берёт не из `valuesByAttrCode` (там TABLE→null), а из `getRows`.

### 3.2 Колонки и виджеты ячеек

`TABLE_COLUMN` из layout; `column binding = attrCode` колонки. **Бэк подсказывает фронту тип редактора ячейки** через props колонки (новые в `NodeProps`):

| prop | назначение |
|---|---|
| `cellWidget` | `NodeType` ячейки. **Источник: `layout_node_props["cellWidget"]` (метаданные) ?? `WidgetResolver.resolveFieldNodeType(colAttr.dataType)` (Java-дефолт).** Override в данных позволяет нестандартный виджет без правки кода (§2.5.1, challenger C6) |
| `dataType` | `AttributeDataType` колонки (строкой) — фронту для форматирования/валидации |
| `readonly` | вычисляемые колонки (напр. `SummaOplaty` если она = функция процента) |
| `required` | обязательность колонки строки |
| `optionsSource` / `domain` / `targetTypeCode` / `allowShowAll` | для ссылочных ячеек — паритет с ADR-0009 ссылочным полем (через `RefEndpointResolver.forOptions`) |

**Правка `WidgetResolver`/`NodeBuilder` (gap):** сейчас `TABLE_COLUMN` маппится 1:1 в `NodeType.TABLE_COLUMN` и cell-widget не вычисляется. Нужно: при сборке `TABLE_COLUMN` догрузить `DocumentAttribute` колонки (по `attributeCode`), вычислить `cellWidget = widgetResolver.resolveFieldNodeType(colAttr.dataType)` и положить в props колонки вместе с `dataType`/`readonly`/`required`/ref-метаданными. Колоночные атрибуты грузятся из **типа строки** (`tableAttr.allowedTypes[0]`, domainKind=DOCUMENT) — отдельной выборкой `documentAttributeRepository.findByDocumentTypeCode(rowTypeCode)`, не из типа документа.

### 3.3 Editable-флаг

TABLE-узел несёт props `editable: Boolean` (default `true` для документов), `allowAdd`/`allowDelete`/`allowReorder` (из layout). При `editable=false` — read-only режим (как `dtkt.rows`). Колонка может переопределить `readonly`.

### 3.4 Гранулярность синхронизации — **table-level change** (решение ядра)

**Фронт шлёт весь массив строк одним EVENT** при любом изменении ТЧ (правка ячейки, add, delete, reorder), а не per-cell.

**Flush debounce перед save (challenger A2).** Фронт дебаунсит ТЧ-EVENT (правка ячейки → массив на blur/debounce, не на keystroke — §9 Решение 1.1). Но `COMMAND save` при невыжатом debounce ушёл бы со scratch **без последней правки**. Требование: **`COMMAND save` форсит flush pending debounce ТЧ-EVENT и ждёт его ответа перед отправкой save** (фронт-спека). Иначе — тихая потеря несохранённой правки ячейки.

**Полнота массива (challenger A3).** Контракт «фронт всегда шлёт ПОЛНЫЙ массив строк». Серверной защиты от усечения нет: усечённый массив → scratch ← усечённый → save full-replace **молча удалит** недостающие строки (`DocumentService:593-594` bulkHardDelete). Это **silent data loss** при баге фронта. Митигация Phase 1: фронт-инвариант + тест фронта; рекомендуется (не блок) фронт шлёт `rowCount`, бэк WARN+метрика при подозрительном усечении. Зафиксировано как осознанный риск (§9 Решение 1.4).

```jsonc
// ViewActionDto на правку ТЧ
{ "type": "EVENT", "formSessionId": "...", "revision": 12,
  "action": { "sourceNodeId": "table.grafik", "trigger": "change",
              "value": [ {rowId, col:val, ...}, ... ] } }   // весь массив строк
```

- `sourceNodeId` = id TABLE-узла (`table.grafik`); `value` = полный массив строк `[{rowId, col:val}]`.
- Резолв: `handler.resolveAttributeCode("table.grafik")` → `GrafikPlatezhey` (tableCode без точки). **Расширения схемы резолва `таблица.строка.колонка` НЕ требуется** — это прямое следствие выбора table-level (см. §9, Решение 1).
- `applyActionValueToEntryAndScratch` для TABLE-узла кладёт RAW `List<Map>` в scratch под `attrCode=tableCode` (без точки — проходит фильтр `captureSetValuePatchesToScratch`). В entry значение TABLE через `helper.setValue` — no-op (ValueFieldHelper TABLE), поэтому handler-реакция и пересчёт работают **не через entry-TABLE**, а через scratch-снимок (§6.3).

Per-cell и гибрид отклонены в §9 (Решение 1).

### 3.5 Стабильность rowId + remap после save (challenger A1)

`rowId` — контракт между фронтом и бэком на время сессии:
- сохранённые строки: `rowId = String(documentEntry.id)`;
- новые: фронт генерит `tmp-<uuid>`; бэк хранит их в scratch как есть; при save они материализуются (saveTableRows присваивает реальные id).
- reorder/delete не меняют `rowId` существующих строк — порядок несёт **позиция в массиве** (она же → `sortOrder` при save).

**Remap rowId после save в той же сессии (обязательно, challenger A1).** `saveTableRows` — full-replace: **пересоздаёт все строки с новыми `documentEntry.id`** (`DocumentService:601-610`, `AUTO_`+nanoTime). Значит после `COMMAND save` (без переоткрытия формы) старые/`tmp-` rowId фронта протухают — ни один не совпадёт с новыми id. Чтобы post-save правка в той же сессии не ломала identity/фокус/выделение:

> **На ответе `COMMAND save` бэк ОБЯЗАН вернуть `setValue(tableCode, <нормализованный массив строк>)` с реальными `rowId = String(id)`** (перечитать строки сохранённого документа через `getRows` → `TableRowComposer`). Фронт применяет **replace всего массива** (механизм `registerTableReplacer`/`replace` уже есть в легаси `table-field.tsx`). Это снимает remap `tmp→real` без переоткрытия.

`processSave` (`ViewController:550`) после успешного `saveTableRows` для каждого TABLE-атрибута документа добавляет `setValue(tableCode, normalizedRows)` в патчи ответа.

### 3.6 Пересчёт (построчный + итоги)

Хук **на изменение ТЧ** в handler (новый контракт, §3.6.1). При table-level EVENT handler получает весь массив строк (из scratch), пересчитывает зависимые колонки каждой строки и итоги документа:

```
onTableChanged(session, entry, tableCode, rows):
  для каждой строки r:
    r.SummaOplaty = round(СуммаДокумента × r.ProtsentOplaty / 100, 2)   // зависимая колонка
  СуммаПоГрафику = Σ r.SummaOplaty
  → setValue(tableCode, rows)            // обновлённый массив (пересчитанные ячейки)
  → setValue("SummaPoGrafiku", СуммаПоГрафику)   // поле-итог (если есть)
```

Результат — `setValue`-патчи: на TABLE (полный массив с пересчитанными ячейками) и на поля-итоги. Фронт применяет `setValue(table.grafik, rows)` (replace всего массива) и `setValue(итог)`.

#### 3.6.1 Контракт handler'а

Расширение `ViewFormHandler`/`BaseViewFormHandler`: новый метод-хук

```java
default void onTableChanged(FormSession session, DocumentEntry entry,
                            String tableCode, List<Map<String,Object>> rows,
                            PatchBuilder patches, EffectBuilder effects) { /* no-op */ }
```

`ViewController.handleEvent`: если `sourceNodeId` — TABLE-узел (резолвится в attrCode типа TABLE), **ПОСЛЕ `applyScratchToEntry`** (шаг 1, `ViewController:420`) вызывает `onTableChanged` (вместо/в дополнение к `handleEvent`). Аналог 1С — `ПриИзменении` колонки ТЧ + `ТекущиеДанные` (developer-1c, ИТС §11); table-level укрупняет до «ТЧ изменилась».

**Откуда хук берёт данные (challenger A4, важная ловушка):**
- **строки ТЧ — ТОЛЬКО из параметра `rows`** (свежий массив из scratch/value), **НЕ через `getRows(entry)`**: на EVENT-пути TABLE-строки в entry **не материализуются** (`applyScratchToEntry` skip TABLE — §4.3), `getRows(entry)` вернул бы СТАРЫЕ строки из БД.
- **шапка (напр. `СуммаДокумента`) — из `entry`** (`helper.getDecimalValue(entry, "SummaDokumenta")`): корректно, т.к. `applyScratchToEntry` применяет ВСЕ плоские атрибуты в entry **до** `onTableChanged` (порядок `handleEvent:420→428`). Если `СуммаДокумента` и ТЧ менялись разными EVENT — на ТЧ-EVENT scratch уже содержит обе (предыдущая СуммаДокумента осела), `applyScratchToEntry` её применит. Инвариант: `onTableChanged` всегда после `applyScratchToEntry`.

#### 3.6.2 Обратная зависимость шапка → ТЧ (challenger C5, класс «молчаливо несработавшего»)

Формула `SummaOplaty = СуммаДокумента × Процент / 100` зависит от **шапки**. Если пользователь меняет `СуммаДокумента` в шапке **после** заполнения графика — изменение шапки идёт плоским field-EVENT в `handleEvent`/`onSummaDokumentaChanged`, а **не** в `onTableChanged` (тот срабатывает на изменение ТЧ). Без явной связи строки графика с их `SummaOplaty` **молча не пересчитаются** — рассогласование останется до следующего касания ТЧ. Это прямой класс «молчаливо несработавшего» из CLAUDE.md на уровне cross-field-зависимости.

**Требование:** field-хук шапки, от значения которого зависят колонки ТЧ (здесь `onSummaDokumentaChanged`), **обязан тоже пересчитать ТЧ**: прочитать строки из scratch-снимка (`tableCode`), пересчитать зависимые колонки, вернуть `setValue(tableCode, rows)` + итоги. Практически — общий приватный метод `recalcGrafik(entry, rowsFromScratch)`, который зовут **оба** хука (`onTableChanged` и `onSummaDokumentaChanged`). Реестр cross-зависимостей «шапка→ТЧ» — ответственность handler'а типа (как в 1С — связи в модуле формы). Acceptance ГП: правка `СуммаДокумента` при непустом графике пересчитывает все `SummaOplaty`.

### 3.7 Save

`SduiSaveService` → `saveEntry` **без правок самого saveEntry**: scratch содержит `tableCode → List<Map>` (RAW). `DocumentEntryCreateDto.attributes` принимает этот ключ; путь подтверждён по коду:
1. `saveSimpleAttributes` (`DocumentService:425-436`) при наличии ключа TABLE в `dto.attributes` создаёт **DocumentValue-заглушку** (TABLE no-op в setValue, но сам value добавляется в `entry.getValues()`) — **в т.ч. для нового документа id=null**;
2. `entryRepository.save(entry)` (`:241`) каскадит заглушку → она получает id;
3. `saveTableAttributes` (`:508-514`) находит её по id и зовёт `saveTableRows` — full-replace (bulk-delete старых + recreate из массива) в той же транзакции.

**Предусловия (challenger B1/B2, обязательны):**
- **Ключ `tableCode` ДОЛЖЕН присутствовать в scratch/dto.attributes**, иначе заглушка не создаётся и строки не сохраняются. Поскольку scratch держит снимок под `tableCode` всегда, когда ТЧ трогали (§4.1), ключ присутствует. Edge: ТЧ ни разу не трогали → ключа нет → строки не пишутся (для нового пустого графика корректно — нечего сохранять).
- **`allowedTypes[0]→rowType` (domainKind=DOCUMENT) у TABLE-атрибута обязателен.** Иначе `saveTableRows` бросает `CommonException` (`:581-584`) и **падает ВЕСЬ save документа** (не локализовано в ТЧ). → миграция метаданных ТЧ — **блокирующая зависимость** (§3.9 п.1, acceptance-gate). Open-вопрос §10: graceful-skip ТЧ vs throw.
- **Ключ колонки ≡ `attr.code` типа строки ≡ layout-сид** (challenger B3): `saveTableRowValues` (`:629-632`) при несовпадении **молча роняет ячейку** (`log.info`+`continue`) — класс «молчаливо несработавшего» из CLAUDE.md на уровне колонки. Требуется round-trip тест serialize→save для ГП; рекомендация `log.warn`+метрика вместо `log.info` на потерю колонки.

Партиал-мердж шапки сохраняется; ТЧ — full-replace **этой** таблицы.

**scratch для TABLE хранит ПОЛНЫЙ снимок** (не дельту) — иначе full-replace потеряет строки (§6, §9 Решение 2). На ответе save — нормализованный массив с реальными rowId (§3.5, challenger A1).

### 3.8 Валидация

`onCheckFilling` ObjectHandler пилота (вызывается на проведении через `saveEntry`): при `IspolzovatGrafikPlatezhey=true` — ТЧ `GrafikPlatezhey` непустая; по каждой строке `DataOplaty != null`, `SummaOplaty > 0`; (опционально) `Σ ProtsentOplaty = 100`. Ошибки → `DocumentValidationException` → `ViewController.processSave` переводит в `setProp(error)`/`notify`. Это серверная логика ObjectHandler (data-engineer заводит атрибуты, backend — ветку валидации).

### 3.9 Прувпойнт «График платежей»

1. **Атрибуты ТЧ (зависимость data-engineer):** проверить наличие в метаданных типа `ZayavkaNaRegistratsiyuGPSdelki` TABLE-атрибута `GrafikPlatezhey` с `allowedTypes[0]` → строковый DocumentType (напр. `ZayavkaNaRegistratsiyuGPSdelkiGrafikPlatezhey`) с колонками `NaznacheniePlatezha/DataOplaty/ProtsentOplaty/SummaOplaty`. **Если их нет — миграция метаданных (data-engineer)** до layout-сида.
2. **Layout-сид (новая миграция, замещает заглушку):** под `tab.grafik` удалить `label.grafikStub`, вставить `TABLE` узел `table.grafik` (attribute_code=`GrafikPlatezhey`, props `editable=true`/`allowAdd`/`allowDelete`/`allowReorder=true`) + дочерние `TABLE_COLUMN` (attribute_code = код колонки) для 4 колонок. Видимость вкладки — handler по `IspolzovatGrafikPlatezhey` (уже есть механика).
3. **Handler-ветки:** `onTableChanged` (пересчёт `SummaOplaty` по проценту + итог) в SDUI-handler заявки ГП; `onCheckFilling` (валидация ТЧ) в ObjectHandler.
4. BDD: авто-сценарии (PM запускает `bdd-tester`) на add/edit/delete/reorder/recalc/save графика.

---

## 4. Вложенный scratch (§самое тонкое, увязка с ADR-0006)

### 4.1 Представление

Scratch остаётся `Map<String,Object>`, но для TABLE-атрибута значение по ключу `tableCode` (**без точки**) — это `List<Map<colCode, raw>>` (полный снимок ТЧ со стабильными rowId, включая новые/удалённые/переупорядоченные строки).

- Ключ `GrafikPlatezhey` (без точки) **не конфликтует** с правилом `captureSetValuePatchesToScratch` «binding без точки = настоящий атрибут» — наоборот, использует его: full-array `setValue(tableCode, rows)` от handler'а штатно оседает в scratch.
- Колонки строк живут **внутри** `List<Map>`, не как отдельные плоские ключи scratch — `таблица.строка.колонка` в scratch **не появляется** (нет binding с точкой → нет конфликта).

### 4.2 Истина строк до save — **в scratch** (не в БД)

Истина строк ТЧ **до save живёт в scratch как полный снимок**. Причины:
1. Новый документ id=null — `addRow`/`removeRow` `TablePartHelper` делают `repository.save`/`deletedAt`, что требует существующего родителя в БД; для transient entry это невозможно (Решение 2, §9).
2. Единая модель для нового и существующего документа — нет ветвления «id есть → пишем в БД через REQUIRES_NEW / id нет → копим в памяти».
3. Согласуется с ADR-0006: до `COMMAND save` ничего не флашится в БД (контроллер `readOnly=true`).

`TablePartHelper` (с его `repository.save`) используется **только** внутри save-транзакции (через штатный `saveTableRows`) и в legacy-хендлерах — **не** на EVENT-пути SDUI. На EVENT-пути все операции над строками — **над scratch-снимком** (in-memory List), не над БД.

### 4.3 Реконструкция при apply

`applyScratchToEntry` для TABLE-ключа: значение `List<Map>` — **не** идёт в `helper.setValue` (ValueFieldHelper TABLE no-op, упасть не должно, но и записать нечего). Вместо этого:
- На **EVENT-пути** (пересчёт/реакция) handler читает строки **из scratch** (передаются в `onTableChanged`), не из entry — entry.TABLE не материализуется в памяти на каждый EVENT (дорого и не нужно).
- На **save-пути** `List<Map>` уходит в `dto.attributes[tableCode]` → `saveTableRows` реконструирует дочерние `DocumentEntry` (full-replace).

Это значит: `applyScratchToEntry` должен **пропускать** TABLE-ключи (не звать `setValue`, иначе «Attribute not found» / no-op + лишняя работа). Явная ветка: если `coerceValueForAttribute`/атрибут == TABLE → skip (строки применяются только на save). Альтернатива (материализовать строки в entry на каждый EVENT для read-консистентности) отклонена как дорогая и ненужная — read строк handler делает из scratch-снимка.

---

## 5. Row CRUD + reorder

Add/delete/move строк — **операции над scratch-снимком**, истина которого — массив строк (§4.2). Два возможных канала; выбран **table-level EVENT** (см. §9):

- **Add/Delete/Reorder выполняет фронт** над своим локальным массивом (`useFieldArray` append/remove/move — уже есть в легаси), затем шлёт **весь обновлённый массив** одним table-level EVENT (§3.4). Бэк: scratch ← новый массив, `onTableChanged` (пересчёт), ответ — `setValue(tableCode, rows)` (нормализованный массив: пересчитанные ячейки, проставленные rowId для новых строк) + `setValue(итоги)`.
- Существующие COMMAND `addRow:`/`deleteRow:` table-node **остаются** для обратной совместимости read-only режима, но для editable-ТЧ канал — EVENT с полным массивом (проще, атомарнее, см. §9 Решение 1). `moveRow` как отдельная команда **не вводится** — reorder едет в составе массива (позиция = порядок).

Где живёт истина до save: **scratch** (§4.2). REQUIRES_NEW-запись строк по одной на EVENT — **отклонена** (Решение 2): ломается на id=null, плодит транзакции, рассинхрон с «save флашит всё».

---

## 6. Бэкенд: что добавить

| Артефакт | Статус | Что делает |
|---|---|---|
| `TableRowComposer` (или метод в `NodeBuilder`) | **новый** | сериализует строки ТЧ из `getRows` в `List<Map>` для `node.value` и snapshot (§3.1) |
| `NodeBuilder` TABLE-ветка | правка | строки берёт из `getRows` (не из valuesByAttrCode→null); для `TABLE_COLUMN` грузит атрибут колонки из типа строки, ставит `cellWidget`/`dataType`/`readonly`/`required`/ref-props (§3.2/§4) |
| `ViewComposer.buildStateSnapshot` | правка | для TABLE-атрибута кладёт `List<Map>` (через `TableRowComposer`) вместо `null` (§3.1) |
| `NodeProps`: `CELL_WIDGET`, `EDITABLE`, `ALLOW_REORDER` (+ переиспуют `ALLOW_ADD`/`ALLOW_DELETE`/`READONLY`/`REQUIRED`/`OPTIONS_SOURCE`) | новые константы | props таблицы и колонок |
| `WidgetResolver` | переиспользование | `resolveFieldNodeType(colAttr.dataType)` для cell-widget (метод уже есть) |
| `ViewController.handleEvent` TABLE-ветка | правка | если `sourceNodeId`→TABLE-attr: scratch ← `List<Map>` (value), вызвать `handler.onTableChanged`, captureSetValuePatchesToScratch (tableCode без точки оседает штатно) |
| `applyActionValueToEntryAndScratch` TABLE | правка | для TABLE-attr класть RAW `List<Map>` в scratch, **не** звать `helper.setValue` (no-op) |
| `applyScratchToEntry` TABLE | правка | **skip** TABLE-ключей (строки применяются только на save) |
| `ViewFormHandler.onTableChanged` | **новый default-метод** | хук пересчёта ТЧ (§3.6.1) |
| `SduiSaveService`/`saveEntry` | **без правок** | scratch[tableCode]=List<Map> уже сохраняется `saveTableRows` (§3.7) |
| SDUI-handler заявки ГП | правка | `onTableChanged` (пересчёт `SummaOplaty`+итог), `resolveAttributeCode("table.grafik")→GrafikPlatezhey` |
| ObjectHandler заявки ГП | правка | `onCheckFilling`-ветка валидации графика (§3.8) |

**ТЧ-в-ТЧ** (`saveTableRowValues:648-650`) — остаётся не поддержанной, out-of-scope (§7).

---

## 7. Out-of-scope / фазирование

| Фаза | Объём |
|---|---|
| **Phase 1 (этот ADR)** | редактируемая одноуровневая ТЧ: сериализация строк (фикс value=null), cell-widgets, table-level EVENT sync, scratch-снимок, add/delete/reorder через массив, построчный пересчёт + итоги, save через штатный saveTableRows, валидация onCheckFilling. Прувпойнт — `GrafikPlatezhey`. |
| **Out-of-scope** | **ссылочные ячейки save-путь** (challenger B4): `cellWidget=REFERENCE_FIELD` декларируется в props (§3.2), но save ссылочной ячейки `{id,presentation}→id` через `saveTableRowValues→setValue` (`DocumentService:653`, DICTIONARY-ветка ждёт raw id, не Map) **не проверен** — Phase 1 = только примитивные колонки (4 колонки ГП все примитивны); ссылочная колонка ТЧ + drawer-выбор из ячейки — отдельная проработка. **ТЧ с субконто** (OBJECT-колонки Дт/Кт, challenger B5): `resolveSubkontoIfNeeded` на save-пути снимка из scratch не специфицирован. Вложенные **ТЧ-в-ТЧ** (`saveTableRowValues:648-650` skip; нужен рекурсивный saveTableRows + scratch-вложенность). Групповые операции / «Заполнить» из ТЧ-кнопок каталога (смежно с ADR-0010 — ТЧ-кнопки исключены). LIST-узел (PULL, ADR-0009). per-cell гранулярность (если table-level упрётся в объём — отдельный ADR). |

---

## 8. Последствия

**Выигрываем:**
- ТЧ становится server-driven и редактируемой без новой инфраструктуры: переиспользуется готовый `TablePartHelper` (на save), `saveTableRows` (уже умеет строки), scratch-модель ADR-0006, редакторы ячеек легаси `table-field.tsx`.
- Table-level sync не требует расширения схемы резолва `таблица.строка.колонка` и не конфликтует с правилом «binding без точки» (tableCode без точки).
- Save «бесплатен» — `saveEntry` уже persist'ит TABLE-строки из `attributes` (ключевая находка анализа).
- Единая модель для нового (id=null) и существующего документа — истина строк в scratch.

**Платим:**
- table-level EVENT шлёт весь массив строк (трафик растёт с размером ТЧ) — митигация: ТЧ документов малы (график — единицы строк); для гигантских ТЧ — per-cell отдельным ADR (§9 Решение 1, открытый вопрос).
- **Latency-деградация data-entry на плохой сети (challenger C3).** «Всё на бэке» означает: каждый commit ячейки = HTTP round-trip. В 1С простая арифметика строки считается `&НаКлиенте` без сети (заполнение ТЧ работает при обрыве связи до записи). При RTT 800 мс (мобильная сеть регионального госучреждения) ввод 10 строк × 4 ячейки ≈ десятки round-trip — ощутимая деградация на самой частотной операции бухгалтера, **регресс против легаси** `table-field.tsx` (react-hook-form считал локально). Это **осознанная плата** за server-driven single-source-of-truth; митигация — thin-обработчик (50–150 мс на хорошей сети), commit-on-blur (не на keystroke), coalescing (§2.5.4а). Полное решение data-entry на плохой сети (напр. декларативные простые формулы `&НаКлиенте`-эквивалент) — возможная будущая фаза, не Phase 1 (§2.5.3). Deferred risk, не resolution.
- Новый `TableRowComposer` + правки `NodeBuilder`/`WidgetResolver`/`ViewController` + хук `onTableChanged`.
- Фронт-дельта: инлайн-редактирование SDUI-таблицы (переиспользование легаси-редакторов), dispatch полного массива, reorder-UI (см. фронт-спеку).
- scratch держит полный снимок ТЧ (память сессии растёт на размер ТЧ) — приемлемо для in-memory Phase 1 ADR-0006.

**Отложено:** ТЧ-в-ТЧ, групповые/«Заполнить», per-cell гранулярность, не-Document домены ТЧ.

---

## 9. Альтернативы и контраргументы (challenger round-trip)

Red-team по двум ключевым решениям проведён `challenger`'ом. Формат: **возражение → ответ автора → статус**.

### Решение 1: гранулярность sync — **table-level change** (а не per-cell)

**Описание:** фронт шлёт весь массив строк одним EVENT при любой правке ТЧ.

**Альтернатива 1а: per-cell EVENT** `{table, rowId, column, value}`. **Почему отклонена:** требует расширения схемы резолва на путь `таблица.строка.колонка` (сейчас `resolveAttributeCode` — плоский nodeId→attrCode) И вложенной scratch-адресации ячейки, что прямо ломает правило `captureSetValuePatchesToScratch` «binding без точки» (`ViewController:1207`). Per-cell заставил бы binding ячейки нести точки (`grafik.r1.SummaOplaty`) и спец-обработку, чтобы не путать с синтетическими `dtkt.rows`. Пересчёт зависимых ячеек (`SummaOplaty` от `ProtsentOplaty`) при per-cell всё равно вернул бы несколько ячеек строки — то есть на ответе мы всё равно оперируем строкой/массивом. Цена per-cell (новая схема резолва + конфликт с binding-без-точки) не окупается на ТЧ из единиц строк.

**Альтернатива 1в: гибрид** (per-cell на провод, table-level на пересчёт). **Почему отклонена:** удваивает поверхность (две схемы резолва, два формата EVENT) ради экономии трафика, которой на малых ТЧ нет.

#### Контраргументы (challenger round-trip)
1. **Возражение** [major]: table-level не масштабируется на большие ТЧ (сотни строк × колонки = килобайты на каждый keystroke). — **Ответ автора:** для ТЧ webbuh (график — единицы строк, типовые ТЧ — десятки) трафик пренебрежим; фронт дебаунсит change (правка ячейки шлёт массив на blur/debounce, не на keystroke — как `useFieldArray`); для гипотетических гигантских ТЧ зарезервирован per-cell отдельным ADR (out-of-scope §7). — **Статус: accepted** (риск осознан, митигирован дебаунсом + размером ТЧ; per-cell — escape hatch).
2. **Возражение** [major]: lost-update между ячейками — пользователь правит ячейку A, приходит ответ пересчёта B, перетирающий несохранённую правку A. — **Ответ автора:** ADR-0006 уже гарантирует «один in-flight на сессию» (frontend-spec §10.6) — фронт не шлёт новый change, пока не пришёл ответ на предыдущий; revision ловит рассинхрон (409 STALE_REVISION). Table-level укрупняет правки в один атомарный массив, что **снижает** окно гонки против per-cell (где каждая ячейка — отдельный in-flight). — **Статус: closed** (table-level безопаснее per-cell по гонкам).
3. **Возражение** [minor]: пересчёт на каждый change всей ТЧ — O(строк) на каждую правку одной ячейки. — **Ответ автора:** пересчёт — арифметика в памяти над scratch-снимком (без БД-обращений на EVENT, §4.2); O(строк) на ТЧ из единиц-десятков строк ничтожно. — **Статус: closed.**
4. **Возражение** [major, раунд 2 A3]: усечённый массив строк от фронта → full-replace молча удалит недостающие строки (`DocumentService:593-594`) — silent data loss, серверной защиты нет. — **Ответ автора:** принято как осознанный риск; Phase 1 — фронт-инвариант «всегда полный массив» + тест фронта; рекомендация (не блок) — фронт шлёт `rowCount`, бэк WARN+метрика при усечении. Полная серверная сверка — будущая опция. — **Статус: accepted (риск с митигацией).**
5. **Возражение** [major, раунд 2 A1]: rowId сохранённых строк протухает после save в той же сессии (full-replace → новые id) — post-save edit ломает identity/фокус. §9-р1 закрывал только cross-save границу. — **Ответ автора:** принято; save-ответ возвращает нормализованный массив с реальными rowId (§3.5), фронт делает replace. — **Статус: closed.**
6. **Возражение** [major, раунд 2 A2]: COMMAND save при невыжатом debounce ТЧ-EVENT теряет последнюю правку ячейки. — **Ответ автора:** принято; §3.4 — save форсит flush pending ТЧ-EVENT. — **Статус: closed.**

### Решение 2: модель scratch + где живёт истина строк до save — **полный снимок в scratch**

**Описание:** scratch[tableCode] = `List<Map>` (полный снимок ТЧ, не дельта); истина строк до save — в scratch, не в БД; row-операции — над in-memory массивом; save через штатный full-replace `saveTableRows`.

**Альтернатива 2а: дельта строк в scratch** (`{added:[], updated:[], removed:[]}`). **Почему отклонена:** save через `saveTableRows` — **full-replace** (`bulkHardDelete` + recreate из массива, `DocumentService:593-617`); дельте пришлось бы реконструировать полный массив перед save из дельты + текущего БД-состояния, что сложнее и подвержено рассинхрону. Полный снимок прямо ложится в `attributes[tableCode]`. Reorder в дельте выражается мучительно; в снимке = порядок массива.

**Альтернатива 2б: истина строк в БД через REQUIRES_NEW на каждый add/delete.** **Почему отклонена:** для нового документа id=null строки писать в БД нельзя (нет родителя) — `TablePartHelper.addRow` упадёт/создаст сироту; плодит транзакции на каждый клик; рассинхрон с моделью ADR-0006 «save флашит всё, EVENT ничего не коммитит». Конкретный код-аргумент: `addRow` зовёт `repository.save(rowEntry)` с `tableValueOwner=tableValue`, а `tableValue` нового документа сам ещё не в БД.

#### Контраргументы (challenger round-trip)
1. **Возражение** [major]: full-replace на save теряет identity строк (`documentEntry.id` пересоздаётся) — ломает внешние ссылки на строки ТЧ и историю. — **Ответ автора:** это **существующее** поведение `saveTableRows` (full-replace всех ТЧ при любом save документа, не вводится этим ADR); строки ТЧ — подчинённые сущности без внешних ссылок (FK только `tableValueOwner` вверх); identity строки в рамках сессии несёт `rowId` (стабилен до save), после save — новый id отдаётся клиенту на следующем snapshot. Если в будущем понадобится стабильный id строк через save (напр. для регистров по строкам) — это отдельная задача правки `saveTableRows` на upsert-by-id, не блокирует Phase 1. — **Статус: accepted** (наследованное поведение, не регресс; upsert — будущая опция).
2. **Возражение** [major]: полный снимок в scratch + новый снимок на каждый EVENT раздувает память сессии (ADR-0006 слепое пятно №1 — рост активных сессий). — **Ответ автора:** scratch держит **один** актуальный снимок (перезаписывается, не аккумулируется — `scratch.put(tableCode, rows)`); размер = размер ТЧ (единицы КБ для графика). Бюджет памяти сессии ADR-0006 (50 KB/документ) поглощает ТЧ из десятков строк. GC ADR-0006 применяется. — **Статус: closed.**
3. **Возражение** [minor]: `applyScratchToEntry` skip TABLE-ключей означает, что entry в памяти на EVENT-пути **не содержит** актуальных строк — handler, читающий `getRows(entry)` в `onTableChanged`, увидит СТАРЫЕ строки из БД, не scratch. — **Ответ автора:** **принято, важная ловушка.** `onTableChanged` получает строки **параметром** (`List<Map> rows` из scratch/value), НЕ через `getRows(entry)`. Контракт хука (§3.6.1) явно передаёт rows; handler пересчитывает над переданным массивом, не над entry.TABLE. `getRows(entry)` корректен только на save-пути (после материализации) и read-only (OPEN snapshot из БД). Документировано в §4.3. — **Статус: closed** (контракт хука закрывает ловушку).
4. **Возражение** [blocker→снят, раунд 2 B1]: для нового документа (id=null) `saveTableRows` не вызовется — TABLE-DocumentValue ещё не создан (`ValueFieldHelper.setValue` TABLE no-op). — **Ответ автора:** проверено по коду — **B1 снят**: `saveSimpleAttributes:425-436` создаёт TABLE-заглушку при наличии ключа TABLE в `dto.attributes` (добавляет в `entry.getValues()`) **до** `save:241` → каскад → `saveTableAttributes:508-514` находит по id и зовёт `saveTableRows`. Работает для id=null. Предусловие «ключ tableCode в scratch» зафиксировано §3.7. — **Статус: closed (снят проверкой кода).**
5. **Возражение** [major, раунд 2 B2/B3/B4/B5]: save «бесплатен» условно — пустой `allowedTypes` роняет весь save (`:581-584`); рассинхрон код-колонки ↔ attr типа строки молча роняет ячейку (`:629-632`); ссылочные ячейки `{id,presentation}→id` save-путь не проверен; субконто на save-пути не специфицирован. — **Ответ автора:** все приняты: B2 → предусловие+acceptance-gate (§3.7/§3.9); B3 → инвариант ключей+round-trip тест (§3.7); B4 → ссылочные ячейки out-of-scope, Phase 1 примитивы (§7); B5 → субконто out-of-scope (§7). — **Статус: accepted (scope сужен до примитивных колонок + жёсткие предусловия save).**
6. **Возражение** [major, раунд 2 A4]: `onTableChanged` читает `СуммаДокумента` из entry, который на EVENT-пути может нести устаревшую шапку. — **Ответ автора:** проверено: `applyScratchToEntry` (`handleEvent:420`) применяет ВСЕ плоские атрибуты в entry **до** хука (`:428`); инвариант «onTableChanged после applyScratchToEntry» зафиксирован §3.6.1 — entry-шапка актуальна. — **Статус: closed.**

### Self-critique (сверх challenger)
- **Контраргумент к себе:** «table-level + scratch-снимок дублирует логику строк между фронтом (useFieldArray) и бэком (массив в scratch)». **Ответ:** фронт — рендерер/редактор массива, бэк — авторитет (пересчёт, нормализация rowId, валидация). Дублирования логики нет: фронт не считает `SummaOplaty`, ждёт setValue-патч от `onTableChanged`. Инвариант ADR-0006 «сервер — авторитет» соблюдён.
- **Контраргумент к себе:** «пересчёт `SummaOplaty = СуммаДокумента × Процент / 100` — синтетика, не подтверждённая 1С как onPost-логика». **Ответ:** явно помечено (§1.3) как design-выбор прувпойнта, демонстрирующий механику; типовой график БГУ информационен и в проводки не идёт (analyst-1c). Реальная бизнес-формула, если отличается, — правка одной ветки `onTableChanged`, не архитектуры.

---

## 10. Открытые вопросы

1. **Per-cell как escape hatch** для гигантских ТЧ — отдельным ADR при появлении ТЧ в сотни строк (§9 Решение 1).
2. **Upsert-by-id в `saveTableRows`** (стабильный id строк через save) — если понадобится для регистров по строкам ТЧ; сейчас full-replace (§9 Решение 2.1).
3. **Реальная бизнес-формула пересчёта графика** — уточнить у analyst-1c/заказчика, если синтетическая `% × СуммаДокумента` не подходит; не блокирует механику.
4. **Ссылочные ячейки с drawer-выбором (ADR-0009 `ref.showAll` внутри ячейки)** — для графика не нужны (колонки примитивные); механика паритетна полю, но drawer-выбор из ячейки ТЧ — отдельная проработка при первой ссылочной колонке ТЧ.
5. **Декларативные простые формулы (`&НаКлиente`-эквивалент)** для data-entry на плохой сети (challenger C3) — DSL формул с формально перечислимым набором операций; будущая фаза, не Phase 1 (§2.5.3). До неё — латентность data-entry на плохой сети остаётся осознанной платой (§8).
6. **Подтверждение coalescing+re-apply на фронте (challenger C1/C2)** — §2.5.4а описывает контракт; финальная реализация (как fin-web хранит dirty-снимок ввода между commit и ответом) — за фронт-спекой; если fin-web решает иначе — синхронизировать.

---

## 11. Ссылки

- [ADR-0005](ADR-0005-sdui-architecture.md), [ADR-0006](ADR-0006-sdui-stateful-form-session.md) (scratch §3.5.7), [ADR-0009](ADR-0009-sdui-server-driven-reference-field.md) (ссылочные ячейки, RefEndpointResolver), [ADR-0010](ADR-0010-sdui-command-bar.md) (ТЧ-кнопки исключены)
- Фронт-контракт: [docs/project/sdui/frontend-spec-tables.md](../sdui/frontend-spec-tables.md)
- Бэк: `view/composer/{NodeBuilder,WidgetResolver,ViewComposer}.java`, `view/controller/ViewController.java`, `view/service/SduiSaveService.java`, `document/handler/TablePartHelper.java`, `document/service/DocumentService.java` (`saveTableRows:567-617`), `core/util/ValueFieldHelper.java` (TABLE no-op:205/264, getObjectAsSduiValue:345)
- Фронт: `fin-web/src/features/sdui/ui/nodes/composite/table-node.tsx` (read-only), `fin-web/src/features/form-renderer/ui/table-field.tsx` (легаси редактируемая ТЧ — источник редакторов)
- Структура ТЧ графика: `docs/project/sverka-1c/odata/1c-odata-metadata-full.xml` (`Document_ЗаявкаНаРегистрациюГПСделки_ГрафикПлатежей`)
- **Источники 1С (ИТС / синтакс-помощник):**
  - [ИТС: Табличные части документов](https://its.1c.ru/db/v8std#content:2095:hdoc) (общая методика ТЧ)
  - [ИТС: Событие ПриИзменении элемента формы](https://its.1c.ru/db/v8doc#bookmark:dev:TI000001360) (построчный пересчёт)
  - [ИТС: ТекущиеДанные элемента ТаблицаФормы](https://its.1c.ru/db/v8doc#bookmark:dev:TI000001413)
  - [ИТС: ТабличнаяЧасть — Добавить/Удалить/Очистить](https://its.1c.ru/db/v8doc#bookmark:dev:TI000001227)
  - [ИТС: ОбработкаПроверкиЗаполнения](https://its.1c.ru/db/v8doc#bookmark:dev:TI000001193)
  - [ИТС: События таблицы формы](https://its.1c.ru/db/v8doc#bookmark:dev:TI000001409)
  - [v8.1c.ru: БГУ КЗ](https://v8.1c.ru/kz/budghet/)

---

### Раунд 2 (отдельный challenger-проход по коду save/scratch)

Challenger провёл независимый проход с привязкой к коду `DocumentService`/`ViewController`/`ValueFieldHelper`. Найдены НОВЫЕ находки сверх §9-раунда-1; статусы после ответа автора (с проверкой кода):

| # | Возражение | Severity | Статус | Резолюция |
|---|---|---|---|---|
| B1 | saveTableRows не вызовется для нового документа — TABLE-value не создан | blocker | **closed (снят)** | Проверено: `saveSimpleAttributes:425-436` создаёт TABLE-заглушку при наличии ключа → `save:241` каскадит → `saveTableAttributes:508-514` находит по id и зовёт saveTableRows. Работает для id=null. Предусловие «ключ в scratch» зафиксировано §3.7 |
| B2 | пустой `allowedTypes` → `CommonException`, падает весь save | major | **accepted** | §3.7 предусловие + §3.9 acceptance-gate (миграция метаданных блокирующая); open Q §10 graceful-skip vs throw |
| B3 | рассинхрон код-колонки ↔ attr типа строки → молчаливая потеря ячейки | major | **accepted** | §3.7 инвариант «ключ ≡ attr.code ≡ сид» + round-trip тест + рекомендация log.warn (`saveTableRowValues:629-632`) |
| B4 | ссылочные ячейки save-путь `{id,presentation}→id` не проверен | major | **accepted, scope сужен** | Phase 1 = примитивные колонки; ссылочные ячейки → out-of-scope §7 |
| B5 | субконто на save-пути снимка не специфицирован | minor | **accepted** | ТЧ с субконто → out-of-scope §7 |
| A1 | rowId протухает после save в той же сессии (full-replace новые id) | major | **closed** | §3.5: save-ответ возвращает нормализованный массив с реальными rowId, фронт replace |
| A2 | потеря правки в debounce при save | major | **closed** | §3.4: COMMAND save форсит flush pending ТЧ-EVENT |
| A3 | усечённый массив → silent delete (full-replace) | major | **accepted (риск)** | §3.4/§9 1.4: фронт-инвариант+тест; рекомендация rowCount-сверка |
| A4 | onTableChanged: СуммаДокумента из неактуальной шапки | major | **closed** | §3.6.1: onTableChanged после applyScratchToEntry (entry-шапка актуальна), строки из rows-параметра |
| A5 | инвариант «tableCode без точки» держится молча | minor | **accepted** | §4.1 + тест-инвариант |

Итог раунда 2: 0 blocker (B1 снят проверкой кода), 0 эскалаций PM — все находки закрыты правками ADR без смены ключевых решений (table-level + scratch-снимок устояли). 4 closed, 5 accepted (осознанные риски с митигацией/scope), 1 снят.

### Раунд 3 (по §2.5 — server-driven дисциплина после PM-директивы)

Challenger атаковал три угла разворота на server-driven: (а) round-trip/латентность; (б) граница данные↔код пересчёта (согласованность с ADR-0010); (в) метаданные колонок. 6 НОВЫХ находок (не повтор §9/§11). Статусы после ответа автора:

| # | Угол | Severity | Статус | Резолюция |
|---|---|---|---|---|
| C1 | (а) латентность | major | **closed** | §2.5.4а: один in-flight на ТЧ + coalescing последнего снимка (не очередь расходящихся правок); UX-контракт «commit при in-flight» прописан |
| C2 | (а) replace затирает несинхр. ввод | major | **closed** | §2.5.4а: при возврате ответа фронт re-apply'ит dirty-снимок (сырой ввод) поверх канона + коалесцированный commit; dirty несёт только ввод, не производные → не клиентская логика |
| C3 | (а) офлайн/плохая сеть data-entry | minor | **accepted (deferred risk)** | §8 «Платим»: явный регресс против легаси, осознанная плата за single-source-of-truth; полное решение — будущая фаза |
| C4 | (б) «границы нет» нечестно для арифметики | minor | **closed** | §2.5.3 переформулирован: граница для арифметики ЕСТЬ (в 1С клиентский расчёт есть), но осознанно не декларативизируем в Phase 1; аналогия с visibleWhen исправлена — симметрия по «поведение=код», не по «границы нет» |
| C5 | (б) обратная зависимость шапка→ТЧ молчит | major | **closed** | §3.6.2: field-хук шапки (`onSummaDokumentaChanged`) обязан пересчитать ТЧ (общий `recalcGrafik`); acceptance ГП |
| C6 | (в) cellWidget = Java-switch, не в данных | major | **closed** | §2.5.1/§3.2: prop `cellWidget` в `layout_node_props` ПЕРЕКРЫВАЕТ `resolveFieldNodeType`; вид ячейки реально в данных, switch — только дефолт (симметрично закрытию дыры кнопок в ADR-0010) |

Итог раунда 3: 5 closed, 1 accepted (deferred risk C3, явно в §8); 0 эскалаций PM. Разворот на server-driven устоял; самые ценные правки — C2 (coalescing+re-apply вместо очереди, без клиентской логики), C5 (cross-field шапка→ТЧ), C6 (cellWidget-override в метаданных — убрал последнюю утечку UI в Java).

## 12. Challenger round-trip (мета)

Три раунда red-team. Раунд 1 — по двум ключевым решениям механики (§9). Раунд 2 — проход по коду save/scratch (§11). Раунд 3 — по server-driven дисциплине §2.5 (разворот по PM-директиве, §11 выше). Ключевые решения (table-level sync; scratch-снимок как истина строк; server-driven структура=данные/поведение=код) подтверждены под атакой. Все находки привязаны к коду/ADR-0010 и закрыты правками; эскалаций к PM нет. Шов с ADR-0010 §3.4.7 согласован, двойного стандарта нет (обоснование C4).
