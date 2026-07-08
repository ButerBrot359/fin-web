# Дизайн: паритет SDUI-движений с 1С + фикс validatePatches

- **Дата:** 2026-07-08
- **Ветка:** `feat/movements-1c-parity` от `dev`
- **Исходные требования:**
  - `docs/superpowers/plans/frontend-spec-movements-1c-block-parity.md` (§1–§4 — фронт)
  - `docs/superpowers/plans/frontend-handoff-2026-07-07-validatepatches-drops-insertnode.md`
- **Статус бэка:** все доработки §5 исходной спеки сделаны и задеплоены (подтверждено владельцем): `regKind` на `TABLE`, период с секундами, `showRowNumbers`, строки панели в `childState` эффекта `openDialog`.
- **Зона:** SDUI (`src/features/sdui/`) + аддитивное расширение общей зоны (`features/workspace-tabs`, `widgets/workspace-tab-bar`, `app/layout`). Легаси не затрагивается (правила изоляции CLAUDE.md соблюдены: из легаси только **копируем** раскладку, импортов нет).

## Решения владельца (зафиксированы в брейншторме)

1. Бэк готов → фронт опирается на чистый контракт, **без фолбэков** (не прокидываем `regKind` из TAB, не снимаем снимок родительской сессии, не форсим «N» без флага).
2. Контейнер движений — **полная workspace-вкладка** (§2.3–2.4 исходной спеки), не fallback §2.5.
3. Оба пункта — **одна ветка**, баг-фикс validatePatches первым коммитом.
4. Связка SDUI ↔ workspace-tabs — **через gateway** (по образцу `reference-picker-gateway`), не прямыми импортами.

---

## Блок A. Фикс `validatePatches` (баг: insertNode/replaceNode отбрасываются)

**Файл:** `src/features/sdui/lib/validation.ts` (строки 9–21).

Бэк (Jackson) сериализует узлы с явными `null` (`binding: null`, `children: null`, `actions: null`), а `viewNodeSchema` объявляет поля через `.optional()` (принимает `undefined`, но не `null`). Базовое дерево идёт через `setRoot` без валидации, а узлы в `insertNode`/`replaceNode`-патчах валидируются → любой такой патч молча отбрасывается как malformed.

**Изменение:** `.optional()` → `.nullish()` для `binding`, `value`, `props`, `actions`, `children` и `action.command` — точно по коду из handoff-дока (§3), включая поясняющий комментарий. Схемы патчей и `patch-applier.ts` не трогаем.

**Тест:** в существующий `validation.test.ts` добавить кейс — `validatePatches` пропускает `insertNode`, чей `node` содержит `binding:null, value:null, props:{…}, actions:null, children:null` (раньше отбрасывался), и `replaceNode` аналогично.

---

## Блок B. 1С-блок бухрегистра (§1)

### Как определяется бухтаблица
`TableNode` (`src/features/sdui/ui/nodes/composite/table-node.tsx`, ветка read-only на строках 161–162): если `node.props.regKind === 'ACCOUNTING'` → рендер `<AccountingPostingsBlock node={node} />`; иначе — прежний `ReadOnlyTable`. `regKind` приходит в props самого `TABLE` (бэк-доработка §5.2 готова).

### Новые файлы (декомпозиция по правилу ≤200 строк)

**1. `src/features/sdui/ui/nodes/composite/accounting-block-logic.ts`** — чистая логика, без React:

- Типы: `SduiCell = { id?, presentation: string, entityRef? } | string`; `AccountingRow = Record<string, unknown>` c ключами из контракта `buildAccountingRows` (`rowId`, `_period`, `_accountDtCode`, `_accountKtCode`, `_summa`, `_soderzhanie`, `_subkontoDt1..N`, `_subkontoKt1..N`, `_fkrDt/Kt`, `_spetsifikaDt/Kt`, `_istochnikFinansirovaniyaDt/Kt`, `_podrazdelenieDt/Kt`, `_kodPlatnykhUslugDt/Kt`, `_kolichestvo`, …).
- `ROW_LAYOUT` — раскладка блока по строкам, side-specific (§1.3 исходной спеки):

  | Строка | Дт: субконто · аналитика1 · аналитика2 | Кт: субконто · аналитика1 · аналитика2 |
  |---|---|---|
  | 1 | `_subkontoDt1` · `_fkrDt` · `_podrazdelenieDt` | `_subkontoKt1` · `_fkrKt` · `_podrazdelenieKt` |
  | 2 | `_subkontoDt2` · `_spetsifikaDt` · `_kolichestvo` | `_subkontoKt2` · `_spetsifikaKt` · `_kolichestvo` |
  | 3 | `_subkontoDt3` · `_istochnikFinansirovaniyaDt` · `_kodPlatnykhUslugDt` | `_subkontoKt3` · `_istochnikFinansirovaniyaKt` · `_kodPlatnykhUslugKt` |

- `resolveCellValue(v): string` — по мотивам легаси `resolveValue`, но для SDUI-ячеек: объект → `presentation`; число/числовая строка суммы → `formatWithSpaces` (`@/shared/lib/utils/format-cell-value`, точка→запятая, разряды пробелами); строка как есть; пусто (`""`/null/undefined) → `''`.
- `collectColumnLabels(tableNode): Map<binding, label>` — обход листьев `COLUMN_GROUP` (как `collectLeafColumns`, `table-node.tsx:37-41`), метки шапки берём из `props.label` листа по `binding` (метки субконто бэк уже резолвит — не хардкодим).
- `getBlockRowCount(rows): number` — `max(3, maxSubkontoDt, maxSubkontoKt)` по фактическим ключам строк.
- Юнит-тесты: раскладка, резолв ячейки (`presentation`/строка/сумма/пусто), сбор меток, row count.

**2. `src/features/sdui/ui/nodes/composite/accounting-postings-block.tsx`** — React-раскладка, **скопированная и адаптированная** из легаси `src/pages/documents/document-movements/ui/accounting-postings-table.tsx` (импортов из легаси нет — файл будет удалён вместе с легаси):

- Шапка 4 ряда: `N` (rowSpan=4) · `Дата` (rowSpan=4) · **ДЕБЕТ** (colSpan=4) · **КРЕДИТ** (colSpan=4) · `Сумма` (rowSpan=4) · `Содержание` (rowSpan=4); ряды 2–4 — `Счёт` (rowSpan=3) + [Субконто · Аналитика1 · Аналитика2] на сторону. Метки — из `collectColumnLabels`; «N» — i18n-ключ (`sdui.movements.rowNumber` в `common.json` ru/kz).
- Тело: на проводку — `<tbody class="group">` из `getBlockRowCount` строк; в первой строке `N` (= индекс+1), `Дата` (`_period`, бэк уже шлёт с секундами), `СчётДт`, `СчётКт`, `Сумма` (через `formatWithSpaces`, выравнивание вправо, `tabular-nums`), `Содержание` — все `rowSpan` на высоту блока.
- Строки читаются из view-state по `binding` таблицы (текущий механизм `ReadOnlyTable`).
- `_isActive`, `_isActiveLabel`, `_valyutnayaSumma`, `_organizatsiya` — **не рисуем** (§1.5).
- Тексты — `<Typography>`; переиспользуем `cn`, `formatWithSpaces` из `shared`.

---

## Блок C. Колонка «N» в `ReadOnlyTable` (§3)

`ReadOnlyTable` (`table-node.tsx:165`) honor'ит `node.props.showRowNumbers === true` → ведущая колонка «N» (заголовок — тот же i18n-ключ, значение — индекс строки + 1, стиль как у легаси `numberCol`). Generic-механизм: работает для любых таблиц, бэк проставляет флаг на таблицах движений (§5.3 готово). Накопление/сведения других изменений не требуют — состав колонок диктует бэк. Юнит-тест: таблица с `showRowNumbers` рендерит колонку «N» с 1..n; без флага — не рендерит.

---

## Блок D. Workspace-вкладка вместо `<Dialog fullScreen>` (§2)

### Архитектура связки (gateway, решение владельца)

SDUI не импортирует workspace-tabs; workspace-tabs не знает про SDUI. Развязка по образцу `reference-picker-gateway`:

**1. `src/features/sdui/lib/workspace-tab-gateway.ts`** (SDUI владеет интерфейсом):
```ts
export interface OpenPanelTabParams {
  tabKey: string      // стабильный id вкладки, напр. "movements:123"
  title: string       // из props.title узла
  panelId: string     // id PanelEntry в panel-store
}
export type WorkspaceTabGatewayImpl = { openPanelTab(params: OpenPanelTabParams): void }
// setWorkspaceTabGateway(impl) — вызывается app-биндингом
// openPanelTab(params) — зовёт dispatch; если impl не зарегистрирован — console.warn, no-op
```

**2. Расширение `features/workspace-tabs` (generic, без знания о SDUI):**
- `types/workspace-tab.ts`: `TabPageType` + `'sdui-panel'`; `WorkspaceTab` + `panelId?: string` (для панельных вкладок `path: ''`, `search: ''`).
- `use-workspace-tabs-store.ts`: новый метод `activateOrCreatePanel(id: string, title: string, panelId: string): void` — id вкладки = `tabKey`; если вкладка с таким id существует → активировать (переиспользование при повторном показе); иначе создать `{ id, path:'', search:'', title, pageType:'sdui-panel', panelId, createdAt }` и активировать. Лимит MAX_TABS — общий.
- **Персист:** при записи в `sessionStorage` панельные вкладки **отфильтровываются** (их контент — in-memory `panel-store`, перезагрузку не переживает; иначе после reload осиротевшая вкладка).
- Реестр закрытия: `onPanelTabClose(cb: (panelId: string) => void)` — подписка (используется app-биндингом); `performClose` панельной вкладки дергает колбэки.

**3. Биндинг `src/app/providers/workspace-tab-gateway-binding.ts(x)`** (app знает обоих):
- `setWorkspaceTabGateway({ openPanelTab: ({tabKey,title,panelId}) => useWorkspaceTabsStore.getState().activateOrCreatePanel(tabKey, title, panelId) })`
- `onPanelTabClose(panelId => usePanelStore.getState().remove(panelId))`
- Подключается там же, где биндинг reference-picker.

### Поток открытия

`dispatch.ts` (`openDialog`, строки 46–64): если `effect.node.props.openInWorkspaceTab === true`:
1. `PanelEntry` пушится в `panel-store` как сейчас + новые поля `openInWorkspaceTab: true`, `tabKey` (тип `PanelEntry` расширяется). `viewState` уже наполняется из `effect.childState` (бэк готов, §5.4) — данные панели самодостаточны.
2. Вызов `openPanelTab({ tabKey, title: props.title, panelId })` через gateway.

Page-панель **без** `openInWorkspaceTab` — прежнее поведение (fullScreen Dialog). `modal`/`drawer` не затрагиваются.

### Рендер контента вкладки

- `dialog-host.tsx` (строки 93–121): панели с `openInWorkspaceTab` **пропускаются** (Dialog не рисуется).
- Новый компонент `src/features/sdui/ui/workspace-panel-host.tsx`: находит активную панельную вкладку → берёт `PanelEntry` по `panelId` → рендерит контент на всю область. Активную вкладку компонент получает **пропсом от layout** (`panelId: string`), чтобы не импортировать workspace-tabs из SDUI.
- `app/layout/layout.tsx`: если активная вкладка `pageType === 'sdui-panel'` → в `<main>` рендерится `<WorkspacePanelHost panelId={tab.panelId} />` вместо `children` (Outlet-контент при этом не размонтируется роутером — просто не показывается; маршрут не меняется). app-уровню разрешено знать про обе зоны.

### Провайдер состояния панели

Сейчас (`dialog-host.tsx:85`): `panel.session ? <PanelFormProvider> : <NodeRenderer>` — панель без `formSessionId` читает ambient-сессию родителя. Для самодостаточной вкладки: `WorkspacePanelHost` рендерит панель через **лёгкий read-only провайдер** — `SduiSessionProvider` со значением поверх `panel.viewState` (`getValue` из viewState панели, `setValue`/серверные события — no-op/console.warn: движения read-only). Отдельный маленький файл `src/features/sdui/lib/panel-state-provider.tsx`, если не влезает в host ≤200 строк.

### Активация и закрытие (`widgets/workspace-tab-bar`)

- `handleActivate`: для `pageType === 'sdui-panel'` — только `setActiveTab(tab.id)`, **без** `navigate` (текущий маршрут/форма остаются живыми). Для маршрутных — прежнее поведение.
- `performClose`: для панельной — `closeTab(tabId)` + нотификация `onPanelTabClose(panelId)` (панель удаляется из `panel-store` app-биндингом); `useFormCacheStore.removeTab` для панельных не зовём. `navigateAfterClose`: если оставшаяся активная вкладка панельная — `setActiveTab` без navigate; если маршрутная — прежний navigate.
- tab-bar импортирует только workspace-tabs (свою зону) — про SDUI не знает.

---

## Ошибки и регресс

- Gateway не забинден (теоретически) → `console.warn` + фолбэк: панель рисуется прежним fullScreen Dialog (не теряем функциональность).
- Повторный клик «Движения» того же документа: тот же `tabKey` → вкладка активируется, новый `PanelEntry` **заменяет** старый по `panelId` (данные обновляются свежим `childState`).
- Регресс-инварианты: `presentation:'modal'/'drawer'` и page-без-флага — байт-в-байт прежнее поведение; маршрутные вкладки (создание из location, активация navigate, закрытие) не меняются; легаси-страница `document-movements` работает как раньше.

## Тестирование

- **Юнит (vitest):** A — validation nullish (insert/replaceNode с null-полями); B — accounting-block-logic (раскладка, resolveCellValue, метки, rowCount); C — showRowNumbers; D — стор вкладок (`activateOrCreatePanel` создаёт/переиспользует, панельные вкладки не попадают в персист, onPanelTabClose дергается).
- **Сборка:** `npm test` + `npm run build` зелёные.
- **E2E (Playwright на стенде, бэк готов):** открыть проведённый документ → «ДтКт»/«Движения» → внизу вкладка (не модалка); бухрегистр — 1С-блок (3 строки, субконто стопкой, ДЕБЕТ/КРЕДИТ группы, N и Дата слева); суммы `12 345,00`; период с секундами; переключение форма↔движения вкладками; повторный клик не плодит дубли; крестик закрывает; накопление/сведения — колонка «N»; регресс ссылочных drawer'ов. Для блока A — проверить `insertNode`-статус «Заявка исполнена на…» на подходящем документе (если есть на стенде) или юнит-тестом.

## Порядок работ (коммиты)

1. Блок A (фикс + тест) — независим, первым.
2. Блок B (logic → тесты → компонент → ветка в TableNode).
3. Блок C (showRowNumbers).
4. Блок D (gateway → расширение tabs-стора → dispatch → host/layout → tab-bar → биндинг).
5. Финал: полный прогон, сборка, Playwright-приёмка.
