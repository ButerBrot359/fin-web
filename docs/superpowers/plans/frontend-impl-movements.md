# Имплементационный фронт-гайд — ДтКт / страницы движений документа (SDUI, fin-web)

> Это **не контракт-спека** (она есть: [frontend-spec-movements.md](frontend-spec-movements.md)), а **объяснение реализации** с привязкой к реальному коду `fin-web`. Читать вместе с [ADR-0012](../adr/ADR-0012-sdui-document-movements.md) (§3.1 MovementsComposer, §4 колонки, §5 фазирование, §8 граница данные/код).

---

## 1. Цель и ссылки

Реализовать на фронте просмотр **движений документа** («Дт/Кт» / «Страницы движений») — read-only форму, показывающую, что проведённый документ записал в регистры (бухгалтерии, накопления, сведений).

**Главный принцип:** движения **полностью генерит бэк** (`MovementsComposer`, ADR-0012 §3.1) — состав вкладок, колонки, заголовки, порядок, форматирование значений. Фронт — **чистый рендерер**: рисует присланное дерево `PAGE → TABS → TAB → TABLE → TABLE_COLUMN` read-only и шлёт COMMAND. Новых `NodeType` = **0**.

**Кнопка «Дт/Кт» — НЕ заводится на фронте.** Это **стандартная команда `showMovements`** из реестра командной панели проведённого документа (ADR-0010, `CommandBarComposer`). Бэк сам добавляет кнопку в командную панель и гасит её, пока документ не проведён. Отдельной фронт-кнопки/иконки/обработчика в `fin-web` создавать **не надо** — `BUTTON` с `command="showMovements"` отрендерится существующим `button-node.tsx` и уйдёт в общий `dispatch` как любая команда.

**Ссылки:**
- ADR: [ADR-0012](../adr/ADR-0012-sdui-document-movements.md) — §3.1 (composer), §3.4 (узлы/props), §4 (колонки), §5 (Phase 1 vs 2), §8 (граница данные↔код).
- Контракт: [frontend-spec-movements.md](frontend-spec-movements.md) — пример JSON-дерева и `setValue`-патчей (§1), сводка дельт (§5).
- Смежное: [ADR-0009](../adr/ADR-0009-sdui-server-driven-reference-field.md) (ссылки `{id,presentation}`, `presentation=drawer|modal`), [ADR-0010](../adr/ADR-0010-sdui-command-bar.md) (командная панель), [ADR-0011](../adr/ADR-0011-sdui-editable-tables.md) (редактируемые ТЧ — движения это НЕ они, они read-only).
- MEMORY: `[[sdui-render-contract]]` — сериализация ссылок `{id, presentation}`.

---

## 2. Текущее состояние фронта (проверено по коду — структуру менять НЕ нужно)

Read-only форма движений рендерится **существующим** кодом. Новых компонентов/узлов заводить не требуется.

| Узел/механизм | Файл | Что уже делает |
|---|---|---|
| `TABS` | `src/features/sdui/ui/nodes/layout/tabs-node.tsx:9` | рендерит вкладки MUI `<Tabs>`, заголовок `props.title ?? props.label ?? "Tab N"` (`tabs-node.tsx:46`), контент активной вкладки = `activeTab.children` через `NodeRenderer` (`tabs-node.tsx:54`); стартует с `activeIndex=0` (`tabs-node.tsx:10`) → **дефолтная вкладка = первая (бухгалтерия / ДтКт)**; скрывает `props.visible===false` (`tabs-node.tsx:15`) |
| `TAB` | `src/features/sdui/ui/nodes/layout/tab-node.tsx:6` | контейнер: рендерит `node.children` через `NodeRenderer` |
| `TABLE` | `src/features/sdui/ui/nodes/composite/table-node.tsx:45` | read-only грид MUI: строки `getValue(node.binding)` (`table-node.tsx:51`), колонки из `TABLE_COLUMN`-детей (`table-node.tsx:54`), пустой набор → «Нет данных» (`table-node.tsx:102`) |
| `TABLE_COLUMN` | `src/features/sdui/ui/nodes/composite/table-column-node.tsx` | `label`/`binding`/`flex` (`extractColumns` в `table-node.tsx:28`) |
| `openDialog` / `closeDialog` / `notify` | `src/features/sdui/lib/effect-handler.ts:24,28,32` | `openDialog` → пушит панель в `panelStack`; `notify` → `showToast(level, message)` |
| Рендер диалога | `src/features/sdui/ui/dialog-host.tsx:76` | `DialogHost` рисует каждую панель из стека: `presentation==='drawer'` → MUI `<Drawer>` (`dialog-host.tsx:92`), иначе `<Dialog>` (`dialog-host.tsx:129`); заголовок из `panel.node.props.title` (`dialog-host.tsx:137`); тело = `<NodeRenderer node={panel.node} />` (`dialog-host.tsx:89`) |
| Реестр узлов | `src/features/sdui/lib/component-registry.ts:55-73` | `TABS`/`TAB`/`TABLE`/`TABLE_COLUMN`/`PAGE`/`BUTTON` — все уже зарегистрированы |

**Поток `openDialog` (подтверждено по `dispatch.ts`):** ответ команды → `effectHandler.playAll(res.effects)` (`dispatch.ts:184`) → `openDialog` (`dispatch.ts:96`) читает `effect.node.props.presentation` (default `modal`, `dispatch.ts:97`), пушит `PanelEntry` в `panelStack` (`dispatch.ts:113`), уведомляет подписчиков → `DialogHost` (через `useSyncExternalStore`, `dialog-host.tsx:77`) перерисовывается. Строки таблиц приезжают **отдельно** — `setValue`-патчами (`applyValuePatches`, `dispatch.ts:182`) по `binding` каждой таблицы; `TableNode` читает их через `getValue(node.binding)`.

**Вывод:** структуру (вкладки + таблицы + диалог + notify) фронт умеет. Менять её не нужно.

---

## 3. ГЛАВНАЯ дельта Phase 1 — нормализация ссылочной ячейки (ОБЯЗАТЕЛЬНА)

Это **единственная обязательная правка Phase 1** и центр всего гайда (ADR-0012 §1.4 / §9, challenger major-2).

### Проблема

`table-node.tsx:111-114` рисует значение ячейки так:

```tsx
<TableCell key={col.id}>
  {col.binding !== undefined
    ? String(row[col.binding] ?? '')   // ← строка 113
    : ''}
</TableCell>
```

Для **примитивов** это работает (бэк присылает уже отформатированную строку: `period`→`"01.05.2026 00:00"`, `summa`→`"150 000,00"`, `isActive`-колонка→`"Да"`/`"—"` — ADR-0012 §3.4, форматирование на сервере).

Но **ссылочная ячейка** (субконто, измерение) — это **объект** `{ id, presentation, entityRef }` (см. пример в [frontend-spec §1](frontend-spec-movements.md), `setValue`-патч). Тогда `String({...})` = **`[object Object]`** — субконто и измерения отрисуются мусором (регресс к пилоту ГП).

### Минимальная правка (~5 строк) — `table-node.tsx`

Извлечь функцию-нормализатор и вызвать её вместо `String(row[col.binding] ?? '')`:

```tsx
// Ячейка-ссылка приходит объектом {id, presentation, entityRef}; примитивы — уже строкой.
function renderCellValue(value: unknown): string {
  if (value != null && typeof value === 'object' && 'presentation' in value) {
    return String((value as { presentation: unknown }).presentation ?? '')
  }
  return String(value ?? '')
}
```

И в JSX (заменить строку 113):

```tsx
<TableCell key={col.id}>
  {col.binding !== undefined ? renderCellValue(row[col.binding]) : ''}
</TableCell>
```

**Почему только это:** ADR-0012 зафиксировал (не делегируя фронту), что **примитивы/дату/сумму/boolean форматирует сервер** — они приходят готовой строкой и `String(value)` показывает их корректно. Объект с `presentation` — **единственный** случай, где `String` ломается. Поэтому правка касается только объектных ячеек.

**Что НЕ делаем в Phase 1:** не делаем ячейку кликабельной, не читаем `entityRef`, не различаем неактивные строки. `entityRef` (без `typeCode`, ADR-0012 §3.1) уже едет в данных — но интерактив только Phase 2.

---

## 4. Поток открытия (end-to-end)

```
[клик «Дт/Кт» / «Движения»]  (стандартный BUTTON command="showMovements" из командной панели, ADR-0010)
        │  button-node.tsx → dispatch({ type:'COMMAND', command:'showMovements' })   (без value; id документа бэк берёт из session)
        ▼
[POST /api/view]  (viewTransport.post, dispatch.ts:157)
        ▼
[бэк: generic-ветка ViewController.handleCommand → MovementsComposer.compose(documentEntryId)]
        │
        ├─ есть движения →  effect openDialog( PAGE→TABS→TAB→TABLE→TABLE_COLUMN )
        │                   +  setValue(binding, rows[])  на каждую таблицу
        │
        └─ нет движений / не проведён →  effect notify("warning", "Документ не проведён / нет движений")
        ▼
[фронт: dispatch.ts:179-184]
        ├─ applyTreePatches / applyValuePatches  (строки таблиц по binding)   dispatch.ts:181-182
        └─ effectHandler.playAll(res.effects)                                  dispatch.ts:184
              ├─ openDialog → panelStack.push(PanelEntry)  → DialogHost рисует Dialog/Drawer
              │     внутри: NodeRenderer(PAGE) → TabsNode рисует вкладки → активная (0=бух) → TableNode рисует строки
              └─ notify  → showToast('warning', ...)
```

**Ключевые точки потока в коде:**
- кнопка не особенная — обычный `BUTTON`, обработка в `button-node.tsx`; команда идёт в `useSduiDispatch` (`dispatch.ts:69`);
- `openDialog` берёт `presentation` из `effect.node.props.presentation`, default `modal` (`dispatch.ts:97`) — для движений Phase 1 бэк шлёт `modal`;
- строки таблиц — `setValue`-патчи, применяются `applyValuePatches(res.patches, setFromServer)` (`dispatch.ts:182`); `TableNode` читает их `getValue(node.binding)` (`table-node.tsx:51`);
- дефолтная вкладка = первая = бухгалтерия (срез «Дт/Кт») — даётся бесплатно `useState(0)` в `tabs-node.tsx:10`;
- закрытие диалога — крестик MUI (`dialog-host.tsx:119,133`) → `popPanel`; либо бэк может прислать `closeDialog`.

---

## 5. Phase 2 (отдельно — НЕ Phase 1)

Эти дельты **не входят** в Phase 1 и требуют дополнительной фронт-работы. Перечисляю, что понадобится, но реализовывать в рамках Phase 1 не нужно.

### 5.1 Проваливание (клик по ссылочной ячейке → карточка)

- **Бэк (Phase 2):** слой данных дополняет `entityRef.typeCode` (резолв конкретного типа записи по `referenceId` — в Phase 1 его нет, ADR-0012 §3.1 major-1).
- **Фронт:** колонка с `props.navigable===true` и ячейка-значение с `entityRef` → рендерить `presentation` как кликабельную ссылку (подчёркивание/курсор). По клику:
  ```tsx
  dispatch({ type: 'COMMAND',
    command: `navigate:${entityRef.domain}:${entityRef.typeCode}:${entityRef.id}` })
  ```
  Бэк ответит `navigate` (`effect-handler.ts:19`, закрывает сессию + `navigate(route)`) или `openDialog` (карточка во вложенной панели — `panelStack` уже стекируется). **Фронт не решает, куда вести** — шлёт `entityRef`, бэк резолвит эффект (паритет с ADR-0009 `ref.open`).
- Естественное место рендера ссылки-ячейки — тот же `renderCellValue`/`TableCell` в `table-node.tsx` (расширить: если `navigable && entityRef` → `<Link onClick=…>`).

### 5.2 Визуал неактивных строк

- Строка несёт служебный `_isActive: boolean` (уже в данных Phase 1).
- **Фронт (Phase 2):** `row._isActive === false` → приглушённый/зачёркнутый стиль `<TableRow>` (`opacity` / `text-decoration: line-through`) в `table-node.tsx:109`. Неактивные строки **показываются**, не скрываются (семантика сторно в 1С).

### 5.3 Кнопка «Обновить»

- Если бэк положит в дерево `BUTTON command="refreshMovements"` — он **отрендерится существующим** `button-node.tsx` без фронт-дельты; бэк пересоберёт дерево/строки. Отдельной работы фронта не требует (обычный BUTTON).

---

## 6. Пошаговый план Phase 1 (по файлам)

1. **`src/features/sdui/ui/nodes/composite/table-node.tsx` — нормализация ячейки (ОБЯЗАТЕЛЬНО, §3).** Ввести `renderCellValue(value)` (объект с `presentation` → текст, иначе `String(value ?? '')`); заменить вызов на строке 113. Это вся обязательная фронт-дельта Phase 1.
2. **Верификация без правок: TABS/TAB/DialogHost.** Убедиться, что присланное дерево `PAGE→TABS→TAB→TABLE` рисуется: вкладки переключаются (`tabs-node.tsx`), диалог открывается (`dialog-host.tsx`), notify при отсутствии движений (`effect-handler.ts:32`). Правок не требует — только прогон сценария (см. §7).
3. **(Опционально) общий рендер объектной ячейки.** Если `renderCellValue` вынести в shared-утиль (напр. `src/features/sdui/lib/`), его можно переиспользовать в редактируемых ТЧ (ADR-0011) и сложных таблицах (ADR-0013) — там та же проблема ссылочной ячейки в TABLE. Решение о выносе — за фронт-командой; для Phase 1 движений достаточно локальной функции в `table-node.tsx`.

---

## 7. Тест-чеклист Phase 1

- [ ] Открыть **проведённый** документ в SDUI-форме → в командной панели присутствует кнопка «Дт/Кт» / «Движения» (приходит с бэка, ADR-0010; на фронте не заводилась).
- [ ] Клик по кнопке → открывается **диалог** (modal) с заголовком «Движения документа» и **вкладками по непустым регистрам** (только те, куда документ реально писал).
- [ ] Активна **первая вкладка** (бухгалтерия) — это и есть срез «Дт/Кт».
- [ ] Бухвкладка показывает колонки Период / Счёт Дт / Субконто / Счёт Кт / Сумма / Содержание / Активность; **ссылочные ячейки (субконто) = читаемый текст `presentation`, НЕ `[object Object]`** (главная проверка дельты §3).
- [ ] `period` = `"дд.MM.yyyy HH:mm"`, `summa` = форматированная строка, «Активность» = «Да»/«—» (всё пришло строкой с бэка, фронт не форматировал).
- [ ] Документ с движениями в нескольких регистрах → **несколько вкладок** (бух + накопления/сведения), переключение работает.
- [ ] Открыть **непроведённый** документ (или без движений) → кнопка скрыта/неактивна; если команда всё же ушла — **toast** «Документ не проведён / нет движений», диалог НЕ открывается.

---

## 8. Gotchas

- **`entityRef` в Phase 1 — без `typeCode`** (ADR-0012 §3.1, major-1). Источник данных движений несёт `domain`+`id`, но не конкретный typeCode записи. Не строить навигацию в Phase 1 — `typeCode` появится в Phase 2 вместе с проваливанием. Phase 1 читает у объектной ячейки только `presentation`.
- **Состав вкладок / колонок / порядок / форматирование — всё с бэка.** Фронт ничего не вычисляет, не сортирует, не группирует, не форматирует суммы/даты/boolean (ADR-0012 §8). Если что-то выглядит не так — это правка `MovementsComposer`, а не фронта.
- **Движения — read-only, это НЕ ADR-0011 ТЧ.** Не путать с редактируемыми табличными частями: здесь нет add/delete/edit. `TableNode` рисует add/delete-кнопки только при `props.allowAdd`/`allowDelete` (`table-node.tsx:73,92`) — для движений бэк их **не** присылает (`editable:false`, `readOnly:true`).
- **Заголовок диалога** берётся из `props.title` корневого узла панели (`dialog-host.tsx:137`), а заголовок вкладки — из `props.title` узла `TAB` (`tabs-node.tsx:46`). Бэк обязан положить оба; фронт их только читает.
- **Та же правка объектной ячейки полезна для ADR-0011 / ADR-0013.** Нормализация `{presentation}`→текст в `TableNode` — единый рендер ячейки-ссылки в любой SDUI-таблице. Если выносить в shared — пригодится редактируемым ТЧ и сложным таблицам (единая точка, чтобы `[object Object]` не повторился).
- **Кнопку «Дт/Кт» на фронте НЕ заводить.** Любой соблазн добавить per-type кнопку/иконку в `fin-web` — против ADR-0012 §3.3: команда `showMovements` стандартная, костяк панели даёт её всем проведённым документам.
