# SDUI Code Review — качество движка и граница легаси ↔ SDUI

> **Дата:** 2026-07-02
> **Ветка:** `chore/sdui-docs-cleanup-and-review`
> **Метод:** read-only ревью, два независимых прохода (качество SDUI-кода; карта границы
> легаси↔SDUI). Критичные находки верифицированы чтением кода вручную.
> **Объём:** `src/features/sdui` — 61 файл, ~4100 строк; точки монтирования; граница с легаси.

---

## Часть 1. Качество SDUI-кода

### CRIT

**C1. Render-loop в `use-table-sync` при отсутствии значения binding**
`src/features/sdui/lib/hooks/use-table-sync.ts:67`
`const canonRows = (getValue(node.binding) as TableRow[] | undefined) ?? []` — создаёт
**новый** массив на каждый рендер, пока сервер не прислал значение таблицы.
`useEffect` с deps `[canonRows]` (строка 141) срабатывает каждый рендер и вызывает
`setLocalRows(next)` с новой ссылкой → ререндер → новый `[]` → снова эффект.
Бесконечный цикл ререндеров, пока binding пуст.

**C2. Дедлок таблицы при сетевой ошибке**
`src/features/sdui/lib/hooks/use-table-sync.ts:144-152` + `src/features/sdui/lib/dispatch.ts:208-216`
`sendEvent` ставит `inFlightRef.current = true`; сбрасывается флаг **только** при приходе
нового canon через эффект. При ошибке `dispatch` показывает toast и canon не обновляет →
`inFlightRef` остаётся `true` навсегда: `commitCell` становится no-op, `flushPending`
возвращает промис, который никогда не резолвится → `flushAllPendingTableCommits`
(dispatch.ts:173) вешает сохранение формы навечно.

**C3. Нарушение Rules of Hooks в точке ветвления легаси/SDUI**
`src/pages/documents/documents-entry/ui/document-entry-page.tsx:44-46`
Ранний `return <SduiDocumentPage/>` стоит **до** вызова хуков (`useOptionalFormConfig`,
`useDocumentEntryForm`, `useRef`, `useQuery`, …). Если `newView` изменится на живом
компоненте (рефетч `['document-types', moduleCode]`, бэк переключил флаг, invalidate из
легаси-кода) — React упадёт с «Rendered fewer/more hooks». Это же — главная точка
ветвления путей (см. Часть 2).

**C4. Обработчик 409 чинит не ту сессию + теряет действие пользователя**
`src/features/sdui/lib/conflict-handler.ts:7-24`
Обработчик STALE_REVISION пишет в **глобальные** сторы (`useTreeStore`,
`useViewStateStore`), хотя конфликт может прийти из сессии панели/диалога (dialog-host
держит состояние в `useState` внутри `PanelFormProvider`). Конфликт в диалоге «чинит»
ревизию корневой формы, панель остаётся сломанной. `_originalAction` игнорируется —
действие пользователя при конфликте молча теряется.

### MAJOR

**M1. Полный ререндер дерева на каждый ввод символа**
`src/features/sdui/ui/sdui-screen.tsx:27,100-121` + `src/features/sdui/lib/sdui-session-context.tsx:31-32`
`SduiScreen` подписан на весь `s.state`; любой `setValue` пересоздаёт `sessionValue` →
новый контекст → ререндер всех нод (ноды и `NodeRenderer` не мемоизированы). Fallback в
`useSduiSession` дополнительно подписывает каждую ноду на `s.root` и `s.dirty` даже при
наличии контекста. На больших формах — квадратичная стоимость ввода.

**M2. Stale revision в контексте сессии**
`src/features/sdui/ui/sdui-screen.tsx:100-121`
`formSessionId`/`revision` читаются через `getState()` внутри `useMemo` с deps
`[tree, dirty, viewStateValues]`. Ответ сервера, бампающий только ревизию (пустые
patches/statePatch), не пересоздаёт memo → следующий запрос уходит со старой ревизией →
искусственный 409.

**M3. `panelStack` — рукописный синглтон без очистки**
`src/features/sdui/lib/dispatch.ts:33`
Модульный external store (subscribe/notify) рядом с четырьмя zustand-сторами; `reset()`
tree-store его не трогает. Уход со страницы с открытым диалогом и возврат → «воскресший»
чужой диалог поверх новой формы. Две разные механики состояния в одном движке без причины.

**M4. Циклические импорты lib ↔ ui**
`src/features/sdui/lib/component-registry.ts:6-44` (lib) импортирует все ui-компоненты;
`ui/node-renderer.tsx:4` импортирует lib; shell/layout-ноды импортируют `NodeRenderer` →
цикл `node-renderer → component-registry → app-shell-node → node-renderer`. Аналогично
`lib/utils/build-column-defs.ts:10` импортирует `TableCellEditor` из ui. Работает на
отложенном обращении — мина при рефакторинге.

**M5. Фича импортирует фичи (FSD)**
`src/features/sdui/ui/nodes/fields/reference-field-node.tsx:11` → `@/features/dict-sidebar`;
`src/features/sdui/ui/sdui-screen.tsx:5` → `@/features/workspace-tabs`.
Движок жёстко связан с соседними фичами (детали и риски — Часть 2, B1/B2).

**M6. Copy-paste восьми field-нод + дрейф**
`ui/nodes/fields/*` (8 файлов) дублируют блок извлечения props (label/required/readonly/
visible/enabled/error/flex) и дословно одинаковую `fireServerEvent`. Итог дрейфа:
`datetime-field-node.tsx` потерял `enabled` (нет `disabled={!enabled}`).

**M7. Дублирование табличной логики + два контракта чтения схемы**
`editable-table.tsx` и `complex-editable-table.tsx` дублируют ~100 строк (кламп
`selectedIndex`, handlers add/remove/move, тулбар, рендер). `editable-table.tsx:61-82`
инлайнит построение колонок, дублируя `build-column-defs.ts:57-80`. `renderCellValue`
существует дважды (`table-node.tsx:69`, `build-column-defs.ts:16`). Опаснее всего:
`extractEditableColumns` (`table-node.tsx:54`) читает binding из `c.props.binding`, а
`nodeToTableColumnDef` (`build-column-defs.ts:168`) — из `node.binding ?? node.id` —
два разных контракта чтения одной схемы.

**M8. Дыры в типизации границы схемы, нет runtime-валидации**
`types/view.ts:6` — `ViewNode.props: Record<string, unknown>` → 8-12 `as`-кастов в каждой
из 30+ нод без единого парсера. `ViewPatch` (view.ts:47-57) — все поля optional →
`patch-applier.ts:48-75` весь на non-null assertions (`patch.nodeId!`, `patch.node!`, …) —
битый патч от бэка молча выполнит `updateNode(root, undefined!)`. `ViewEffect`
(view.ts:59-73) — god-object. Zod в стеке есть — не используется для `/api/view`.

**M9. Ложный dirty при клике по строке мастер-таблицы**
`complex-editable-table.tsx:150` пишет `setValue(binding + '.__selectedRowId')`, а
`view-state-store.ts:19-20` любое `set` помечает `dirty: true`. Клик по строке без правок
→ «*» в заголовке и диалог «несохранённые изменения» при закрытии.

**M10. API-запросы в ui-компонентах (нарушение правил проекта)**
`reference-field-node.tsx:78-116` — ручной `apiService.get` + `setLoading`/`setOptions`,
без debounce и AbortController (гонки при быстром вводе), `catch {}` глушит ошибки.
`list-node.tsx:78-91` — inline queryFn с `apiService` в компоненте. По правилам — запросы
в `api/` слайса (там только `view-transport.ts`), мутации через useMutation.

**M11. Хардкод строк (нарушение i18n-правила)**
`dispatch.ts:158,160,213`; `conflict-handler.ts:13,21`; `effect-handler.ts:50`;
`table-node.tsx:149,172` («Добавить», «Нет данных» — рядом `editable-table` корректно
использует `t('table.empty')`); `unknown-node.tsx:16`; `object-field-node.tsx:20`;
`tabs-node.tsx:48`; `editable-table.tsx:136`.

### MINOR

- **m1. Мёртвый код:** `dispatch.ts:70-72` (алиасы `getDialogStack`/`subscribeDialogs`/
  `popDialog`); `view-state-store.ts:29-32` (`useViewState`, `useViewStateSetter` без
  потребителей); `use-table-sync.ts:290` (`flushPending` наружу не используется).
- **m2. `icon-node.tsx:19-25`:** динамический `import(@mui/icons-material/${name}.js)` —
  Vite готовит чанк под каждую из тысяч иконок; двойной `as unknown as FC`;
  `useState<FC>` вместо прямого вычисления.
- **m3. Плавающие промисы:** `tabs-node.tsx:26`, `label-node.tsx:35` — `dispatch({...})`
  без `void`, в отличие от остальных ~20 мест.
- **m4. `pending-table-commits.ts`:** глобальный реестр с ключом только по `binding` —
  таблица в корне и таблица с тем же binding в панели перезатирают друг друга.
- **m5. `dialog-host.tsx:27-31`:** дерево панели инициализируется из `panel.node` через
  `useState` — replaceNode на уровне panelStack панель не увидит. Там же (108-110):
  `<span>` вместо `<Typography>`, хардкод цветов `#F2F6FD`, `rgba(34,33,36,.6)`.
- **m6. Неоправданные useMemo/useCallback:** `dispatch.ts:79-219` — `useCallback` с deps
  `[…, session]`, где `session` пересоздаётся на каждое изменение state (мемоизация
  бесполезна); `complex-editable-table.tsx:112-137` — `footerValues`/`hasFooter` для
  тривиальных вычислений. Оправданные: мемоизация колонок таблиц (сохранение фокуса,
  задокументировано) и `sessionValue` контекста.
- **m7. `api/view-transport.ts:26-29`:** двойной каст для message; нет таймаута axios;
  `closeBeacon` шлёт POST с пустым телом — сверить контракт с бэком.
- **m8. `dispatch.ts:98-165`:** `createEffectHandler` со всеми колбэками (включая
  40-строчный `closeDialog` с сетевым вызовом) пересоздаётся на каждый `dispatch`;
  relay-в-родителя — бизнес-логика в замыкании, а не в effect-handler.
- **m9. `table-cell-editor.tsx:82`:** BOOLEAN readonly — хардкод `'✓'`; 50 строк
  `!important`-хаков поверх MUI (18-66) — shared-инпуты не рассчитаны на таблицы.

### Общая оценка движка

Ядро концептуально чистое: плоский реестр компонентов, тривиальный `NodeRenderer` с
fallback на `UnknownNode`, иммутабельный patch-applier, отделённый transport. Мелкие ноды
читаются легко. Проблемы системные: (1) состояние фрагментировано на пять механик — три
zustand-стора, рукописный `panelStack` и `useState`-сессии панелей, из-за чего конфликты и
ревизии уже расходятся между корневой формой и панелями; (2) синхронизация редактируемых
таблиц переусложнена и не имеет обработки ошибок (дедлок, render-loop); (3) нет валидации
серверной схемы — сплошные `as` и `!`; (4) полный ререндер дерева на каждый ввод. Эти
долги стоит закрыть до перевода остальных экранов на SDUI — каждый новый тип ноды будет
их умножать.

---

## Часть 2. Граница легаси ↔ SDUI

### Карта границы

**Легаси → SDUI: изолировано образцово.** Единственная точка входа —
`src/pages/documents/documents-entry/ui/sdui-document-page.tsx:4-9` (импорт `SduiScreen`,
сторов и dispatch из barrel `@/features/sdui`). Больше никто в `src` SDUI не импортирует.
В роутере (`src/app/App.tsx`) SDUI-роутов нет.

**SDUI → легаси: два щупальца.**
1. `sdui-screen.tsx:5` → `@/features/workspace-tabs` (`useTabMeta`,
   `useWorkspaceTabsStore`, `useFormCacheStore`) — заголовок вкладки, dirty-флаг,
   решение о сохранении SDUI-кэша при unmount, pending-действие `'save-and-close'`.
2. `reference-field-node.tsx:11` → `@/features/dict-sidebar` (`useDictSidebarStore`) —
   fallback для ссылочных полей без серверных actions; транзитивно тянет
   `@/features/form-renderer`, `@/entities/{document-type,form-config}` и утилиты из
   `@/pages/*` (через `dict-sidebar-form-view.tsx`).

**Shared-слой чист:** grep по `sdui|ViewNode|SduiScreen` в `src/shared` — 0 совпадений.
Расширения `AutocompleteInput` (`onShowAll`/`onAdd`/`endAction`) используются обоими
путями — честный shared.

**Транспорт:** у SDUI собственный axios-инстанс (`api/view-transport.ts:5-8`) — изоляция
от `apiService`. list-node/reference-field/download-эффект ходят через общий `apiService`
— нормальное использование shared.

**Кэш TanStack Query:** коллизий ключей нет (`['sdui-list', …]` vs легаси-ключи), пустых
`invalidateQueries()` нет.

**Намеренное дублирование (норма, не чинить):** свои сторы, свои shell-ноды (не
используют `widgets/sidebar`/`top-bar`), свои таблицы, свои типы `types/view.ts`,
свой axios-инстанс.

### Точки ветвления

Одна на всё приложение: `document-entry-page.tsx:42-46` — `useDocumentType(moduleCode)` →
`if (newView) return <SduiDocumentPage/>`. Флаг `newView: boolean` приходит в метаданных
типа документа (`entities/document-type/types/document-type.ts:14`, запрос
`useSuspenseQuery(['document-types', moduleCode])`). Ветвление действует только для формы
документа; списки, movements, справочники, регистры, отчёты — всегда легаси.

Вторичная «мягкая» точка внутри SDUI: `reference-field-node.tsx:188-197` — если сервер
прислал actions (`showAll`/`create`/`open`), поле работает по SDUI-протоколу; иначе —
fallback в легаси dict-sidebar.

### Нарушения независимости

**B1 [CRIT]. SDUI → dict-sidebar → FormRenderer**
`reference-field-node.tsx:11,134-152,216-222`. SDUI-поле пушит панели в легаси-стор
`useDictSidebarStore` (drawer смонтирован глобально в `App.tsx:209`). Транзитивно —
зависимость от всего легаси-стека форм. Сценарий поломки: рефакторинг сигнатуры `push()`,
типа `DictSidebarPanel`, контракта `onSelect: (opt: SelectOption) => void` или
`build-fallback-config` в pages/documents → в SDUI-формах перестают открываться
справочники, TS частично не поймает (payload — `Record<string, string>`). Обратно:
выпиливание dict-sidebar при уходе от легаси сломает SDUI-поля без серверных actions.

**B2 [MAJOR]. Связка SDUI с протоколом workspace-tabs**
`sdui-screen.tsx:5,29-33,40-68,82-98`. Зависимость от внутренних контрактов легаси-стора:
строковый литерал `'save-and-close'` (↔ `use-form-cache-store.ts:10,16`), семантика
`cache[tabId].isDirty`, `tabs.some(tab => tab.id === route)` (id вкладки == pathname),
момент вызова `removeTab` в `workspace-tab-bar.tsx:47`. Правка этих контрактов под легаси
молча ломает SDUI: сохранение по крестику вкладки, потеря кэша сессии
(`sdui-cache-store`) → утечка живых серверных form-session.

**B3 [MAJOR]. Rules of Hooks в точке ветвления** — см. C3 (document-entry-page.tsx:44-46).
Единственное место выбора пути написано так, что смена `newView` на живом компоненте
роняет React. Правка легаси-хуков в этом же файле напрямую влияет на SDUI-ветку.

**B4 [MINOR]. SDUI-ветка зависит от легаси-запроса `useDocumentType`**
`SduiDocumentPage` рендерится только после успешного легаси-запроса
`/api/document-types/...`. Неизбежно, пока флаг приходит в легаси-метаданных, но это
легаси-код на критическом пути SDUI.

**B5 [MINOR]. Односторонняя рассинхронизация кэша**
Сохранение через SDUI (`POST /api/view`) не инвалидирует легаси-кэш
`['document-entries', moduleCode]` (список документов — легаси), и наоборот легаси-CRUD
не сбрасывает `['sdui-list', …]` — устаревшие списки до истечения staleTime (60s).

**B6 [MINOR]. Общие утилиты слайса pages/documents**
`sdui-document-page.tsx:15-20` — `PageHeader`, `get-document-paths`,
`use-unsaved-changes-dialog`, `UnsavedChangesDialog`. Один слайс, правится синхронно,
но формально общие точки.

### Вердикт по границе

Пути близки к взаимонезависимости, но она не достигнута. Направление «легаси → SDUI»
изолировано образцово: один импорт, один флаг `newView`. Направление «SDUI → легаси»
имеет два настоящих щупальца — `workspace-tabs` (протокол вкладок/dirty/`'save-and-close'`)
и особенно `dict-sidebar`, через который SDUI транзитивно зависит от FormRenderer,
entities и pages. Пока легаси не трогают — работает; рефакторинг dict-sidebar или
form-cache-store в интересах легаси способен молча сломать SDUI (справочники, сохранение
по закрытию вкладки, утечки form-session), и TS это частично не поймает. Плюс сама точка
ветвления написана с нарушением rules-of-hooks. Shared-слой и кэш Query чистые.

---

## Сводка приоритетов

| # | Приоритет | Что | Где |
|---|-----------|-----|-----|
| C1 | CRIT | Render-loop таблицы при пустом binding | use-table-sync.ts:67,141 |
| C2 | CRIT | Дедлок таблицы при сетевой ошибке | use-table-sync.ts + dispatch.ts |
| C3/B3 | CRIT | Rules of Hooks в точке ветвления | document-entry-page.tsx:44 |
| C4 | CRIT | 409-handler чинит не ту сессию, теряет действие | conflict-handler.ts |
| B1 | CRIT | SDUI → dict-sidebar → весь легаси-стек | reference-field-node.tsx:11 |
| M1-M2 | MAJOR | Ререндер всего дерева; stale revision | sdui-screen.tsx |
| M3 | MAJOR | panelStack-синглтон без очистки | dispatch.ts:33 |
| B2 | MAJOR | Связка с протоколом workspace-tabs | sdui-screen.tsx |
| M4-M5 | MAJOR | Циклы импортов; фича→фича (FSD) | component-registry, reference-field |
| M6-M7 | MAJOR | Copy-paste field-нод и таблиц, два контракта схемы | ui/nodes/* |
| M8 | MAJOR | Типизация схемы, нет runtime-валидации | types/view.ts, patch-applier.ts |
| M9 | MAJOR | Ложный dirty по клику строки | complex-editable-table.tsx:150 |
| M10-M11 | MAJOR | API в ui-компонентах; хардкод строк | reference-field, list-node, dispatch |
| m1-m9 | MINOR | Мёртвый код, иконки, промисы и пр. | см. выше |
| B4-B6 | MINOR | Кэш-рассинхрон, общие утилиты слайса | — |
