# SDUI: фронт-гайд по реализации верхней командной панели (fin-web)

> **Жанр.** Это **имплементационный гайд для разработчика `fin-web`** — что трогать, что уже работает, в каком порядке проверять. Это **не** контракт-спека: контракт (что бэк отдаёт на проводе) — [frontend-spec-command-bar.md](frontend-spec-command-bar.md). Архитектурное решение — [ADR-0010](../adr/ADR-0010-sdui-command-bar.md).
>
> **TL;DR для фронта.** Дельта ≈ **0 строк кода**. Состав кнопок (закреплённые + «Ещё ⋯» + «Печать») собирает **бэк** (`CommandBarComposer`, `commandSource=AUTO`), фронт их только рендерит существующими узлами. Реальная фронт-работа Phase 1 — это **верификация** (визуальная проверка «Ещё» и поведения `SEPARATOR` внутри MUI `<Menu>`), а не разработка. Единственный потенциальный фикс — §5 шаг 3 (если `SEPARATOR`/`MENU_ITEM` ломают фокус-навигацию MUI `<Menu>` из-за обёртки `NodeRenderer`).

---

## 1. Цель и ссылки

Перенести верхнюю командную панель формы документа (`OBJECT_FORM`: «Главная командная панель формы») с **рукописного per-type SQL-сида кнопок** на **generic-сборку на бэке**. Со стороны `fin-web` нужно убедиться, что текущий рендерер показывает уже-собранное бэком дерево панели — включая полный охват через меню **«Ещё ⋯»** и секции-разделители — без доработок.

- Архитектура и обоснование фаз: [ADR-0010](../adr/ADR-0010-sdui-command-bar.md) — особенно §3.4 (модель «Ещё»), §3.4.4 (секции через `SEPARATOR`), §3.4.7 (data-driven реестр `command_bar_items`), §3.5 (таксономия стандартных команд).
- Контракт «что бэк отдаёт»: [frontend-spec-command-bar.md](frontend-spec-command-bar.md).
- Базовый SDUI-контракт: [sdui-architecture.md](sdui-architecture.md); stateful-сессия — [ADR-0006](../adr/ADR-0006-sdui-stateful-form-session.md).

---

## 2. Шаред-инфра SDUI (общая для всех узлов — переиспользуем термины)

Командная панель — обычные SDUI-узлы, проходящие через общий конвейер. Без новых механизмов:

| Слой | Файл | Роль |
|---|---|---|
| Входная точка экрана | `src/features/sdui/ui/sdui-screen.tsx` | при монтировании шлёт `OPEN` (или восстанавливает из кэша вкладки), кладёт дерево в `tree-store`, оборачивает в `SduiSessionProvider`, рендерит корень через `<NodeRenderer>` (`sdui-screen.tsx:47`, `:122-129`) |
| Диспатч | `src/features/sdui/lib/dispatch.ts` (`useSduiDispatch`) | `POST /api/view` для `OPEN`/`EVENT`/`COMMAND`/`CLOSE` (`dispatch.ts:157`); порядок применения ответа: `bumpRevision` → `clearAllErrors` (для COMMAND) → tree-патчи → value-патчи → `merge(statePatch)` → эффекты (`dispatch.ts:178-184`) |
| Tree-патчи | `src/features/sdui/lib/patch-applier.ts` (`applyPatches`) | `setProp`/`replaceNode`/`insertNode`/`removeNode`/`moveNode`/`setOptions` к дереву (`patch-applier.ts:45-87`) |
| Value-патчи | `applyValuePatches` → `setFromServer` в `lib/stores/view-state-store.ts` | `setValue`-патчи биндингов (`patch-applier.ts:113-122`) |
| Эффекты | `src/features/sdui/lib/effect-handler.ts` | `navigate` / `openDialog` / `closeDialog` / `notify` / `download` (`effect-handler.ts:18-42`) |
| Реестр узлов | `src/features/sdui/lib/component-registry.ts` | мапит `NodeType` → React-компонент (`component-registry.ts:45-79`); резолв через `<NodeRenderer>` (`node-renderer.tsx:7-10`) |

Командная панель использует из этого: `TOOLBAR`/`BUTTON`/`MENU_ITEM`/`SEPARATOR` (реестр), клик → `dispatch({type:'COMMAND', command})`, эффекты `navigate`/`download`/`notify`, и `setProp`-патчи для динамики.

---

## 3. Текущее состояние fin-web — что УЖЕ работает (проверено по коду)

| Возможность | Факт | Файл:строки |
|---|---|---|
| `TOOLBAR` | flex-ряд дочерних, рендерит детей через `<NodeRenderer>`; авто-overflow нет | `toolbar-node.tsx:6-10` |
| `BUTTON` обычный | читает `props.label`/`command`/`enabled`; клик с `command` → `dispatch({type:'COMMAND', command})` | `button-node.tsx:9-11`, `:25-27` |
| `BUTTON variant=primary` | → MUI `contained` | `button-node.tsx:18` |
| **`BUTTON variant=dropdown` + `children`** | → MUI `<Menu>`, дочерние узлы рендерятся через `<NodeRenderer>`. **Это и есть механизм «Ещё» и «Печать» — из коробки** | `button-node.tsx:17`, `:39-47` |
| `BUTTON` НЕ шлёт `value` | в dispatch уходит только `{type:'COMMAND', command}` — без аргументов | `button-node.tsx:26` |
| `BUTTON` НЕ рендерит `props.icon` | в кнопке только текстовый `{label}` | `button-node.tsx:37` (icon нигде не читается) |
| `MENU_ITEM` | читает `label`/`command`; клик → `dispatch({type:'COMMAND', command})`; **плоский**, cascading-подменю нет | `menu-item-node.tsx:8-9`, `:13-17`, `:19` |
| `SEPARATOR` | зарегистрирован, рендерит MUI `<Divider>` (`orientation` из props) | `separator-node.tsx:6-9`; реестр `component-registry.ts:58` |
| клик → `COMMAND` | оба узла шлют `dispatch({type:'COMMAND', command})` | `button-node.tsx:26`, `menu-item-node.tsx:14` |
| эффект `navigate` | закрывает сессию + переход (`*AndClose`, `showInList`) | `effect-handler.ts:19-22` |
| эффект `download` | `window.open(url, '_blank')` (печать, выгрузки) | `effect-handler.ts:39-41` |
| эффект `notify` | toast по `level` | `effect-handler.ts:32-37` |
| эффект `openDialog`/`closeDialog` | panel-stack (для будущего Help) | `effect-handler.ts:24-30`, `dispatch.ts:96-149` |
| `setProp`-патч к `BUTTON`/`MENU_ITEM` | `setProp` мёрджит `props[key]=value` в любой узел по `nodeId` | `patch-applier.ts:47-51` |

**Вывод:** «Ещё ⋯» как `variant=dropdown`-кнопка с детьми `MENU_ITEM`/`SEPARATOR` идёт ровно тем же путём, что уже работающая dropdown-кнопка «Печать». Новых узлов/компонентов писать не нужно.

---

## 4. Что реализовать на фронте — и что НЕТ

**Ключевой вывод ADR-0010:** состав кнопок (какие, где закреплены, что в «Ещё», в каком порядке, какие секции) определяет **бэк** — фиксированный костяк правилами `CommandBarComposer` + уникальная часть из серверного реестра `command_bar_items` (ADR §3.4.7). Фронт получает уже-собранное дерево `commandBar` и рендерит как есть, **без пер-типовой логики и без достраивания**. Поэтому фронт-работа минимальна.

| # | Пункт | Решение Phase 1 |
|---|---|---|
| а | **Рендер «Ещё ⋯»** как dropdown-кнопки с `MENU_ITEM`-детьми | **РАБОТАЕТ из коробки** — тот же путь, что «Печать» (`button-node.tsx:39-47`). Доработок 0. |
| б | **`SEPARATOR` внутри MUI `<Menu>`** (секции «Ещё», ADR §3.4.4) | Компонент `SeparatorNode` есть (`separator-node.tsx`), в реестре есть (`component-registry.ts:58`). **Проверить визуально**, что `<Divider>` корректно рисуется как ребёнок `<Menu>` и не ломает фокус-навигацию (см. §5 шаг 3 — единственный возможный фикс). |
| в | **`icon` на кнопках** не рендерится (ADR §1.2) | **Оставить как есть.** Панель функциональна текстовыми кнопками; рендер `props.icon` — будущая дельта (контракт-спека §7). |
| г | **Клиентские команды** (`Help`/`CustomizeForm`/`SaveAs`) | **НЕ реализуем** — вне Phase 1. Бэк их не присылает (контракт-спека §6). Доработок 0. |
| д | **Cascading-подменю** в «Ещё» | **НЕ реализуем** — бэк присылает плоский список с секциями-`SEPARATOR` (ADR §3.4.4). Будущая дельта. |

Иными словами: **фронт-дельта Phase 1 ≈ 0**; работа сводится к верификации (§5–§6) и, в худшем случае, к локальному фиксу рендера разделителя/пунктов внутри `<Menu>`.

---

## 5. Поток данных и пошаговый план реализации

### 5.1 Поток (как панель оживает)

1. **OPEN.** `sdui-screen.tsx:47` шлёт `dispatch({type:'OPEN', layoutCode})`. Бэк отдаёт `tree`, где узел `commandBar` (`TOOLBAR`) уже содержит собранные `CommandBarComposer`'ом дочерние `BUTTON` (закреплённые + dropdown «Печать» + dropdown «Ещё» с `MENU_ITEM`/`SEPARATOR`). `dispatch.ts:169` кладёт дерево в стор → `<NodeRenderer>` рендерит панель.
2. **Динамика приходит патчами.** В том же ответе на `OPEN` (и далее на каждый `COMMAND`) бэк-handler шлёт `setProp`-патчи по состоянию записи. `applyTreePatches` (`dispatch.ts:173`, `:181`) → `applyOne`/`setProp` (`patch-applier.ts:47-51`) мёрджит `props` в узел `BUTTON` по `nodeId`. Примеры (контракт-спека §4):
   - проведён → `setProp(btn.post, "label", "Отменить проведение")` + `setProp(btn.post, "command", "unpost")`;
   - проведён → `setProp(btn.postClose, "visible", false)`;
   - непроводимый тип → `setProp(btn.post, "visible", false)`.
   **Фронт-логики «когда что показывать» НЕТ** — состояние панели целиком приходит патчами. `BUTTON` читает `props.label`/`command`/`enabled` при каждом рендере (`button-node.tsx:9-11`), `setProp` их перезаписывает.

   > Замечание по `visible`: `setProp` пишет `props.visible=false`, но `ButtonNode` сейчас читает только `enabled` (`button-node.tsx:11`), не `visible`. Если бэк начнёт реально скрывать кнопки через `visible` (а не `enabled`/`removeNode`), потребуется учесть `props.visible` в `ButtonNode`. В Phase 1 это **проверочный пункт** (§6), а не подтверждённая доработка — уточнить у бэка, чем скрывают: `removeNode`, `enabled=false` или `visible=false`. Пилот ГП использует перепатч `label`/`command`, а не скрытие.
3. **Клик команды.** `BUTTON`/`MENU_ITEM` → `dispatch({type:'COMMAND', command})` (`button-node.tsx:26`, `menu-item-node.tsx:14`). Бэк отдаёт `patches` (в т.ч. перестройку панели через `setProp`) + `effects` (`navigate`/`download`/`notify`), которые `dispatch.ts:181-184` применяет штатно.

### 5.2 Пошаговый план (по файлам — преимущественно верификация)

1. **`button-node.tsx` — подтвердить путь dropdown.** Убедиться, что `variant=dropdown` + `children` рендерит `<Menu>` и дочерние идут через `<NodeRenderer>` (строки `17`, `39-47`). Менять не нужно — это рабочий путь «Печать», по которому пойдёт «Ещё».
2. **`menu-item-node.tsx` — подтвердить клик.** Пункт «Ещё» шлёт `COMMAND {command}` (строка `14`). Менять не нужно.
3. **`separator-node.tsx` внутри `<Menu>` — ЕДИНСТВЕННЫЙ возможный фикс.** Проверить визуально (§6), что `SEPARATOR` между секциями «Ещё» рисуется и не ломает фокус-навигацию MUI `<Menu>`.
   - **Риск:** MUI `<Menu>` для управления фокусом/клавиатурой интроспектирует **прямых** детей, а здесь каждый ребёнок обёрнут в `<NodeRenderer>` (`button-node.tsx:45`), т.е. `<Menu>` видит `NodeRenderer`, а не `MenuItem`/`Divider`. Обычно отображение корректно, но навигация стрелками/`autoFocus` может вести себя неидеально.
   - **Если ломается:** не плодить новый узел — отрендерить детей `<Menu>` «разворачивая» обёртку, либо пометить `SeparatorNode`-в-меню как `<Divider component="li" role="separator">`, и/или раскрывать `MENU_ITEM` без промежуточного `NodeRenderer` именно в ветке dropdown. Это локальная правка `button-node.tsx`/`menu-item-node.tsx`/`separator-node.tsx`, не контрактная.
   - **Если не ломается:** дельта = 0, фиксируем «верификация пройдена».
4. **`effect-handler.ts` — подтвердить эффекты.** `navigate`/`download`/`notify` уже есть (строки `19-41`). Менять не нужно.
5. **(условно) `visible` в `ButtonNode`.** Только если бэк подтвердит, что скрывает кнопки через `setProp(visible=false)` (а не `removeNode`/`enabled`) — добавить чтение `props.visible` и ранний `return null`. Уточнить у бэка перед правкой (§5.1 шаг 2).

**Честный итог:** если шаг 3 проходит визуально и бэк не использует `visible`-скрытие — **фронт-дельта = 0, все шаги = верификация**. Реалистичный максимум доработки — один локальный фикс рендера разделителя/пунктов внутри `<Menu>`.

---

## 6. Тест-чеклист

Открыть проведённый документ-пилот (Заявка на регистрацию ГП-сделки) после миграции на `commandSource=AUTO`, затем репрезентативный тип (ЭСФ — стресс «Ещё»):

- [ ] **Костяк виден.** Закреплённые кнопки `Провести и закрыть` (primary/contained), `Записать`, `Провести` отрисованы в ряд (`TOOLBAR`).
- [ ] **«Печать» работает.** Dropdown-кнопка «Печать» открывает `<Menu>` с пунктами печатных форм; клик пункта → `download` (PDF открывается в новой вкладке).
- [ ] **«Ещё ⋯» видна и открывается.** Отдельная dropdown-кнопка «Ещё» открывает `<Menu>` с `MENU_ITEM`-пунктами (`Перечитать`/`Пометить на удаление`/`Показать в списке` + доменные).
- [ ] **Секции-разделители.** Внутри «Ещё» между секциями виден `<Divider>` (`SEPARATOR`); пункты по обе стороны кликабельны, фокус-навигация не сломана (ключевой пункт §5 шаг 3).
- [ ] **Доменные закреплённые.** Для ЭСФ `Отправить`/`Отозвать` — отдельные **видимые** кнопки (не в «Ещё»).
- [ ] **Динамика по клику.** Клик «Провести» → ответ перестраивает панель патчем: `btn.post` становится «Отменить проведение»/`unpost` (`setProp` отработал), показан `notify`.
- [ ] **Команды безаргументны.** В сетевом запросе `COMMAND` нет `value`; печать — это `command:"print:<id>"`.
- [ ] **Заголовок формы** на месте (инжект `LABEL`-узла), панель его не дублирует (§7).

---

## 7. Gotchas (привязка к известным контрактам)

- **Видимый заголовок формы = инжект `LABEL`-узла**, а не `props.title`. `props.title` у дерева используется лишь для имени вкладки (`sdui-screen.tsx:28` → `useTabMeta`). Командная панель к заголовку отношения не имеет — не пытаться достроить title из панели. (MEMORY: SDUI render contract.)
- **`BUTTON` не шлёт `value`** (`button-node.tsx:26`) — и это достаточно: весь `OBJECT_FORM`-набор безаргументен. Аргумент печати закодирован в самой команде (`print:<id>`), а не в `value`. Команды вроде `ИзменитьВыделенные` (нужен набор выделенных строк как `value`) — вне scope, это списочная форма (ADR §3.4.5 п.5).
- **Состав / видимость / состояние панели — целиком с бэка.** Фронт не фильтрует, не сортирует, не достраивает и не вычисляет доступность. «Какие кнопки» = серверный реестр + composer; «что делает клик» = `handler.handleCommand`; «динамика по состоянию» = `setProp`-патчи (ADR §3.4.3, §3.4.7). Любое искушение «спрятать/добавить кнопку на фронте» — нарушение server-driven-инварианта.
- **Имена команд не интерпретировать.** `Otpravit`/`Zapolnit`/… — транслитерация 1С→Java (по [таблице](../transliteration-1C-java.md)); фронт шлёт строку `command` как есть, без парсинга (кроме того, что бэк сам разбирает `print:<id>`).
- **`MENU_ITEM` плоский** (`menu-item-node.tsx:19`) — cascading-подменю нет, поэтому бэк присылает «Ещё» плоским списком с секциями-`SEPARATOR`; «Печать» — отдельная кнопка рядом, не вложена. Не добавлять вложенность в Phase 1.
- **`OPEN` теряет query при copyFrom** (MEMORY: SDUI render contract) — к командной панели прямого отношения не имеет, но учитывать при тестировании сценариев «скопировать документ».

---

## 8. Сводка «кто что делает»

| Что | Кто | Фронт-работа Phase 1 |
|---|---|---|
| Состав закреплённых + «Ещё» + «Печать» | бэк (`CommandBarComposer`, `commandSource=AUTO`) | нет |
| Рендер dropdown «Ещё»/«Печать» (`BUTTON variant=dropdown` + `MENU_ITEM`) | фронт (существующий `button-node`/`menu-item-node`) | нет |
| `SEPARATOR`-секции внутри `<Menu>` | фронт (существующий `separator-node`) | **верификация**; возможен 1 локальный фикс (§5 шаг 3) |
| Динамика (провёл↔отменил, скрытие) | бэк (`setProp`-патчи) | нет (возможен учёт `visible`, §5 шаг 5 — по подтверждению бэка) |
| Клик → COMMAND, эффекты `navigate`/`download`/`notify` | фронт (существующий `dispatch`/`effect-handler`) | нет |
| `icon` / Help / CustomizeForm / SaveAs / cascading | — | будущие дельты, не Phase 1 |

**Итог: Phase 1 командной панели `OBJECT_FORM` — ноль обязательных фронт-изменений; реальная работа = верификация по §6, с единственным потенциальным локальным фиксом рендера `SEPARATOR`/`MENU_ITEM` внутри MUI `<Menu>`.**
