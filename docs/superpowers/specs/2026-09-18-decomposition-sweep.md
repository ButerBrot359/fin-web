# Сплошной свип декомпозиции: каждый файл src/

**Дата:** 2026-09-18 · **Ветка:** `profiling/full-audit`
**Метод:** 8 параллельных ревью-срезов, каждый прочитал все не-тестовые `*.ts/tsx` своей зоны. **Покрытие: 966 файлов** (sdui/ui 145, sdui/lib+api+types 137, легаси-фичи 81, общие фичи 101, аналитика/ИИ 120, легаси-страницы 133, SDUI/общие страницы+app 71, shared+entities+widgets 178). Свип шёл после сегодняшних рефакторингов (декомпозиция customize-form, разбивка theme.ts, чистка аналитики) — их результаты уже учтены.

**Сводка:** ~870 файлов (90%) — в норме: одна ответственность, размер в цели, читаемость без замечаний. Долг сконцентрирован: 2 грубых нарушителя (complex/editable-table), ~15 файлов сверх лимита 300 с готовыми планами разбивки, и главная системная проблема — **дублирование логики между файлами** (см. §7): шапка отчётов ×5, применение серверного ответа ×3, табличные команды ×2 дословно.

---

## 1. SDUI/ui (145 файлов; 110 в норме)

Мелкие ноды (fields/display/action/shell/layout/deferred), `tabel/`, `production/`, `lib/customize-form` — образцовая декомпозиция. Флаги:

| Файл                            | Строк | Что вычленить                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `complex-editable-table.tsx`    | 1011  | 7 адресных выносов: `use-row-selection-identity`, `use-auto-advance` (SCRUM-363), `use-master-detail-rows`, общий `use-table-row-commands`, `complex-table-footer`, `complex-table-head` + `use-sticky-head-offset`, `<VirtualSpacerRow>`. Останется ~250-строчный оркестратор |
| `editable-table.tsx`            | 546   | `build-flat-column-defs` (фабрика колонок), общий `use-table-row-commands`, `<VirtualSpacerRow>`, `use-cell-value-applier` (дословный дубль с complex)                                                                                                                         |
| `list-node.tsx`                 | 408   | `use-list-infinite-rows` (query+сентинел), `read-list-actions` (8 однотипных find), `use-list-trail`                                                                                                                                                                           |
| `reference-cell-editor.tsx`     | 343   | sx-блоки → styles-файл (прецедент рядом); нормализаторы → общий `reference-value.ts`                                                                                                                                                                                           |
| `read-only-table.tsx`           | 343   | `read-only-table-row` (трёхслойный sx), renderHeaderCell                                                                                                                                                                                                                       |
| `reference-field-node.tsx`      | 341   | нормализаторы → `reference-value.ts`; `reference-affordances`; endAction-тройня → `reference-end-actions`                                                                                                                                                                      |
| `object-cell-editor.tsx`        | 336   | два компонента в файле — `ObjectCellValuePicker` в свой файл                                                                                                                                                                                                                   |
| `table-cell-editor.tsx`         | 336   | `format-readonly-cell.ts` (чистое форматирование, нужно и read-only-таблицам)                                                                                                                                                                                                  |
| `production-calendar-node.tsx`  | 340   | `use-production-calendar-commands` (по образцу соседнего year-change-хука)                                                                                                                                                                                                     |
| `selection-list-table.tsx`      | 316   | `use-selection-publish` (pendingRef-очередь EVENT'ов — заслуживает юнит-теста), `selection-list-rows`                                                                                                                                                                          |
| `accounting-postings-block.tsx` | 304   | `BlockRow` → свой файл                                                                                                                                                                                                                                                         |
| `use-tabel-matrix-actions.ts`   | 302   | контракт → `tabel-matrix-contract.ts`; draft-kinds → `use-tabel-draft-kinds`                                                                                                                                                                                                   |
| `dialog-host.tsx`               | 292   | `PanelFormProvider` → свой файл; ветки page/drawer дублируют шапку → `PanelChrome`                                                                                                                                                                                             |
| `sdui-screen.tsx`               | 277   | `use-screen-lifecycle`; сборка sessionValue → общий модуль (дубль с dialog-host, §7.9)                                                                                                                                                                                         |
| `list-column-defs.tsx`          | 248   | рендереры ячеек → `resolveListCellRenderer`                                                                                                                                                                                                                                    |
| `classifier-picker-node.tsx`    | 237   | CAS-драфт → `use-classifier-picker-draft`                                                                                                                                                                                                                                      |
| `customize-form-dialog.tsx`     | 283   | остаточный флаг: состояние редактора → `use-customize-form-editor-state`                                                                                                                                                                                                       |
| `kalendari-template-table.tsx`  | 270   | `WorkTimeActionButton`, `useTemplateModeResize`                                                                                                                                                                                                                                |

## 2. SDUI/lib+api+types (137; 127 в норме)

| Файл                          | Строк | Что вычленить                                                                                                                                                                                                   |
| ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build-column-defs.ts`        | 528   | `vertical-sub-rows.ts`, `table-column-def.ts`; внутренний дубль рендера TableCellEditor (2 копии по ~40 строк) → `buildCellEditorElement`. Сохранить публичную точку модуля (re-export) — на неё тест 580 строк |
| `use-table-sync.ts`           | 498   | `table-sync-model.ts` (чистые части), `reconcileRows` (реконсиляция dirty→canon становится юнит-тестируемой). НЕ трогать связку drain/flush-before-save                                                         |
| `dispatch.ts`                 | 431   | `build-dispatch-effect-deps`, `apply-view-response` (OPEN и EVENT-ветки), `handle-dispatch-error` (catch-блок). Сигнатуру `useSduiDispatch` не менять — dispatch.test 1111 строк                                |
| `use-tabel-matrix-actions.ts` | 302   | см. §1                                                                                                                                                                                                          |

## 3. Общие фичи (101; 85 в норме)

| Файл                                       | Строк | Что вычленить                                                                                                              |
| ------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| `support-call/ui/call-room-dialog.tsx`     | 404   | **обязан**: `RoomStage`, `RoomStatusLine`, `RemoteControlLayer`, `STAGE_THEME` → lib                                       |
| `table-filter/ui/value-controls.tsx`       | 350   | **обязан**: примитивы / reference-контролы по файлам; inline `apiService.get` в `EnumsControl` → api-хук `use-enum-values` |
| `support-call/ui/support-call-widget.tsx`  | 264   | `SupportFab`, `SupportQueueButton`                                                                                         |
| `support-call/lib/remote-control-apply.ts` | 241   | курсор агента → `remote-cursor.ts`                                                                                         |
| `face-auth/lib/hooks/use-face-capture.ts`  | 228   | `captureSeries` → не-React модуль                                                                                          |
| `use-remote-control.ts`                    | 195   | 5 из 6 useCallback без перф-причины — снять                                                                                |
| `use-workspace-tabs-store.ts`              | 196   | дубль обрезки MAX_TABS ×2 → `appendWithLimit`                                                                              |
| `favorite-button.tsx`                      | 43    | не декомпозиция: заглушка `useState(false)` без сервера — нужен тикет на персист либо решение выкинуть                     |

## 4. Аналитика/ИИ (120; 112 в норме, >300 — ноль)

| Файл                                        | Строк | Что вычленить                                                                                                                                   |
| ------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities/analytics/api/analytics-api.ts`   | 293   | превентивно по доменам: catalog-query / assistant / items / ai-settings + `api/common.ts` (unwrap, таймаут) — разрез совпадает с разрезом хуков |
| `analytics-widgets/lib/build-chart-data.ts` | 261   | универсальные хелперы датасета (~85 строк, импортируют таблица/KPI/модель) → `query-result.ts`                                                  |
| `analytics-widgets/ui/analytics-table.tsx`  | 255   | `analytics-table-row` + мини-хук `use-virtual-rows`                                                                                             |

## 5. SDUI/общие страницы + app (71; 49 в норме)

| Файл                                    | Строк | Что вычленить                                                                                                      |
| --------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| `app/App.tsx`                           | 273   | маршруты → `app/routes.tsx`; gateway-эффекты → `use-sdui-gateways`                                                 |
| `pages/audit-log/ui/audit-log-page.tsx` | 223   | таблица + пагинация в свои файлы; ручной useState/.then → useQuery                                                 |
| `use-unsaved-changes-dialog.ts`         | 30    | не размер: generic-хук импортируется из легаси-слайса в SDUI-мир — перенести в `shared/ui/unsaved-changes-dialog/` |
| `change-password-form.tsx`              | 138   | кросс-pages импорты из `pages/login` (extract-auth-error, login-field-sx) → `features/auth`/shared                 |
| `module-nav-skeleton.tsx`               | 54    | локальный дубль ShimmerBlock → импорт из shared                                                                    |

Плюс: `audit-log`/`inactivity-locks` — единственные страницы на ручном `.then` вместо TanStack Query; бойлерплейт `.then((m) => ({default: m.X}))` ×30 → хелпер `lazyNamed`.

## 6. shared + entities + widgets (178; 162 в норме)

| Файл                                         | Строк | Что вычленить                                                                                                               | Риск               |
| -------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `shared/lib/xlsx/write-xlsx.ts`              | 626   | делится осмысленно по готовым секциям: `zip.ts` / `xlsx-styles.ts` / `sheet-xml.ts` / сборка пакета; API не меняется        | низкий             |
| `shared/ui/inputs/autocomplete-input.tsx`    | 359   | общий объект пропов двух веток Autocomplete (~25 дублей), `createFooterPaper` → файл; не менять идентичность PaperComponent | высокий (оба мира) |
| `widgets/document-list-toolbar/…toolbar.tsx` | 257   | сырой `apiService.get('/on-get-form')` в компоненте → api+хук; инлайн-типы дублируют `entities/document-type`               | средний            |
| `shared/ui/form-fields/dict-field.tsx`       | 224   | `useDictionarySearch` (debounce+query) → хук                                                                                | средний            |
| `shared/ui/toast/show-toast.tsx`             | 208   | `toast-content.tsx` + `toast-events.ts`                                                                                     | средний            |
| `shared/ui/inputs/calendar-layout.tsx`       | 261   | context отдельно от `CalendarSidebar`; литерал шрифта → токен                                                               | низкий             |
| `widgets/eav-entity-table`                   | 402   | легаси-EAV: только карта (4 сцепленных блока), не трогать вне таски                                                         | высокий            |

## 7. Сквозное дублирование (главная системная находка)

По убыванию стоимости владения:

1. **Шапка отчётов** `groupTitle→subGroupTitle→title` — **5 независимых реализаций** (tree-table ×4 внутренних копии, ledger-table, form-view, build-report-export, build-reportalt-export), дефолт-ширины уже разъехались (120/110/104), разбор « — » есть только в tree-table → экран и XLSX могут расходиться. Лечится одним `buildHeadModel` в `report-result-view/lib/` — оправдано даже в легаси.
2. **Применение серверного ответа SDUI** (bumpRevision→clearErrors→patches→merge→effects) — 3 копии: `dispatch.ts` + двё в `relay-selection.ts`. Интерфейс `PanelPatchSink` уже описывает нужный набор → общий `applyServerPatches(sink, res)`.
3. **Табличные команды** add/copy/remove/move + hotkeys — дословно в complex- и editable-table (`use-table-row-commands`); туда же `use-cell-value-applier` (дословный дубль) и фабрика server-ref-команд (ADR-0029, 2 копии).
4. **Ссылочный автокомплит** — скаффолдинг повторён ~8 раз по SDUI-нодам → `useReferenceAutocomplete(source)`; конверсии `{id, presentation}⇄SelectOption` — 3 реализации → `reference-value.ts`.
5. **`{id, presentation}`-нормализация в sdui/lib** — 5 мест с чуть разной семантикой → `ref-value.ts`; дубль в лоб `columnTextColor`≡`tableTextColor` — слить.
6. **`useDebouncedValue`** (generic, 14 строк) живёт в `table-filter` — SDUI и 4 легаси-страницы зависят от feature-слайса ради debounce → `shared/lib`.
7. **Модальная скорлупа** (radius 40 / minWidth / shadow-popup / заголовок+крестик) — 3 слегка разъехавшиеся копии (confirm / unsaved-changes / select-operation) → `DialogShell`; Tooltip-конфиг инпутов ×4 → `inputTooltipProps`; `ShimmerBlock` продублирован в page-skeleton.
8. **Легаси (только карта, чинить во всех копиях при багфиксах):** реестры accounting/accumulation/information — api и use-type-хуки клоны (страницы уже разошлись, accounting перешёл на ColumnMetaDto); entry→SelectOption ×6; `/api/enums/{code}/values`→options ×4 (включая shared enum-field); DictCell ≈ dict-field; orgSourceFields-блок дословно в field-node и table-field; CheckboxList ×2 в report-settings; reportalt-настройки — параллель report-settings.
9. **Сборка `SduiSessionValue` руками ×2** (dialog-host, sdui-screen) — новый ключ контекста надо добавлять в двух местах.
10. **Гигиена границы в «общем» коде:** top-bar (viewSettingsAdminApi, closeAllSduiSessions) и document-list-toolbar (openMovementsForEntry) импортируют `features/sdui` напрямую — против gateway-правила; cross-widget импорт PrintDropdownButton → просится в shared/ui.

## 8. Рекомендуемый порядок работ

1. **Пакет общих табличных хуков** (§7.3 + VirtualSpacerRow + use-search-scroll) — одновременно снимает дубли и превращает оба главных переростка в оркестраторы. Самая выгодная работа зоны.
2. `dispatch.ts` + `applyServerPatches` (§7.2) — риск средний, но тройная копия ядра — худший вид долга; тесты уже плотные.
3. `write-xlsx.ts` (низкий риск) + `buildHeadModel` для отчётов (§7.1 — единственный оправданный заход в легаси).
4. Обязательные разбивки >300 вне таблиц: call-room-dialog, value-controls, list-node, reference-\*, App.tsx.
5. Мелкая гигиена: useDebouncedValue → shared, ShimmerBlock-дубль, lazyNamed, ref-value/reference-value, audit-log на useQuery.
6. Остальное из таблиц — «по мере захода в файлы» (правило проекта).
