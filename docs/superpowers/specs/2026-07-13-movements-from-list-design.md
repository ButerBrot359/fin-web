# Дизайн: движения документа из формы списка + chrome панели движений

- **Дата:** 2026-07-13
- **Исходная спека бэка:** [frontend-spec-movements-from-list-and-title.md](../plans/frontend-spec-movements-from-list-and-title.md)
- **Ветка:** `feat/sdui-movements-from-list` от `feat/sdui-reference-cell` (коммиты + пуш, без PR)

## Контекст: спека бэка частично устарела

Спека (от 2026-07-09) писалась до мержа `movements-1c-parity` (PR #216, 2026-07-08). Уже реализовано:

- `dispatch.ts:48-62` читает `openInWorkspaceTab`/`tabKey`, зовёт gateway `openPanelTab()` → workspace-вкладка (утверждение спеки «не поддержаны» — устарело).
- `PanelStateProvider` — read-only рендер панели без сессии/dispatch (то самое «лёгкое SDUI-окружение» из спеки).
- `WorkspacePanelHost` + `layout.tsx:29` — рендер панели в области вкладки, роут не меняется.
- Имя вкладки берётся из `props.title`, dedup по `tabKey` (`activateOrCreatePanel`, `use-workspace-tabs-store.ts:73-101`) — **баг #3 уже решён кодом**, нужен только новый title от бэка.

Реально осталось: баг #1 (ДтКт из списка идёт на legacy-роут и deprecated `/id/`-эндпоинт) и баг #2 (у панели движений нет заголовка и стрелок).

## Решение по багу #1: паритет через панель (вариант A)

Вместо рекомендованного спекой «SDUI-роута» (писалось до появления workspace-вкладок): ДтКт из списка вызывает новый session-less `GET /api/view/movements/{entryId}` и скармливает `openDialog`-эффект в **тот же** panel/gateway-механизм, что и `showDtKt` из формы. Роут-навигация не используется.

Почему не SDUI-роут: роут-вкладка из списка + панель-вкладка из формы = две вкладки на одни движения (dedup между типами вкладок не работает), chrome пришлось бы собирать дважды, «паритет» был бы только визуальным.

### Новые файлы в `features/sdui`

| Файл | Содержимое |
|---|---|
| `api/movements-api.ts` | `fetchMovementsView(entryId): Promise<ViewResponse>` — `GET /api/view/movements/{entryId}` через `apiService` |
| `lib/open-dialog-panel.ts` | `openDialogAsPanel(effect, parentSessionId?)` — вынос логики openDialog из `dispatch.ts:47-82` (gateway `openPanelTab`, сборка `PanelEntry`, dedup по `tabKey`, ветка `effect.sessionId`) без изменения поведения; `dispatch.ts` переключается на неё |
| `lib/open-movements.ts` | `openMovementsForEntry(entryId)`: fetch → по `effects`: `openDialog` → `openDialogAsPanel(effect)` (без parentSessionId — сессии нет, строки в `childState`); `notify` → `showToast(level, message)`. Экспорт из barrel `@/features/sdui` |

### Toolbar списка

`src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx` — `handleMovements` (121-130) вместо `navigate(...)` вызывает `openMovementsForEntry(String(selectedRowId))` через `useMutation`; на время запроса кнопка ДтКт disabled.

**Мост согласован с владельцем:** widget легаси-списка импортирует публичный barrel-экспорт `@/features/sdui` (не новый gateway). Прецедент: `layout.tsx` уже импортирует `WorkspacePanelHost` оттуда же.

### Допущения

- Бэк для движений всегда присылает `openInWorkspaceTab: true` + `tabKey` (контракт §2.1 спеки). Ветка «gateway не забинден → fullScreen Dialog» на списке не сработает (DialogHost там не смонтирован), но gateway биндится на app-уровне всегда — кейс теоретический, отдельно не обрабатываем.
- `notify` (нет движений / документ не найден) → toast, панель/вкладка не создаётся.

## Решение по багу #2: chrome панели в layout

`src/app/layout/layout.tsx`: когда активна панельная вкладка (`activePanelId`), над `WorkspacePanelHost` рендерится `PageHeader` с `title = tab.title` (= `props.title` от бэка, «Движения документа: {название}» — на фронте не хардкодится).

Семантика кнопок на панели:

- **Назад**: `navigate(-1)` не годится — роут под панелью не менялся. `PageHeader` и `NavigationButtons` получают опциональный проп `onBack`; для панели «назад» = закрыть панельную вкладку (`closeTab`) → активируется соседняя вкладка (возврат к списку/форме). Без `onBack` поведение прежнее (`navigate(-1)`).
- **Вперёд**: disabled, как всюду в `NavigationButtons`.
- **Крестик** (`onClose`): то же закрытие панельной вкладки. Удаление `PanelEntry` из panel-store произойдёт через существующий `panel-tab-close-registry` / `workspace-tab-binding`.

Chrome общий для любых панельных вкладок и чинит #2 сразу для обоих путей (из формы и из списка).

## Баг #3: без кода

`dispatch.ts` уже передаёт `props.title` в `activateOrCreatePanel`, dedup по `tabKey` работает. С новым title от бэка вкладка автоматически называется «Движения документа: {название}». Проверяется на приёмке.

## Затронутые файлы

| Файл | Изменение |
|---|---|
| `src/features/sdui/api/movements-api.ts` | новый: `fetchMovementsView` |
| `src/features/sdui/lib/open-dialog-panel.ts` | новый: `openDialogAsPanel` (вынос из dispatch) |
| `src/features/sdui/lib/open-movements.ts` | новый: `openMovementsForEntry` |
| `src/features/sdui/lib/dispatch.ts` | openDialog-колбэк → вызов `openDialogAsPanel` |
| `src/features/sdui/index.ts` | экспорт `openMovementsForEntry` |
| `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx` | `handleMovements` → `useMutation(openMovementsForEntry)` |
| `src/app/layout/layout.tsx` | `PageHeader` над `WorkspacePanelHost` для панельной вкладки |
| `src/widgets/page-header/ui/page-header.tsx` | опциональный проп `onBack` (прокидка в `NavigationButtons`) |
| `src/features/navigation-buttons/ui/navigation-buttons.tsx` | опциональный проп `onBack` |

## Тестирование

Vitest (unit) + ручная приёмка на стенде.

Unit: `open-dialog-panel` (панель+вкладка при `openInWorkspaceTab`, dedup, ветка без сессии), `open-movements` (openDialog → панель; notify → toast, панели нет), `navigation-buttons`/`page-header` (`onBack`).

Приёмка (из спеки бэка):

1. **#1**: ДтКт из списка на проведённом документе → workspace-вкладка движений с непустыми проводками (группы ДЕБЕТ/КРЕДИТ, форматирование, ссылочные ячейки) — идентично открытию из формы.
2. **#1**: непроведённый/не найденный документ → toast warning, вкладка не создаётся.
3. **#2**: заголовок панели = «Движения документа: {название}», стрелки назад/вперёд на месте; «назад» возвращает к списку/форме.
4. **#3**: нижняя вкладка называется «Движения документа: {название}»; повторное открытие (из списка или из формы) переиспользует вкладку.

## Вне scope

- Удаление legacy: `document-movements-page.tsx`, `document-movements-api.ts`, `MovementTable`/`AccountingPostingsTable`, роут `.../movements` в `App.tsx` — отдельный cleanup по согласованию (спека: «не блокер»). Роут остаётся, но с toolbar-а на него больше не попасть.
- Серверные изменения (эндпоинт, title) — webbuh-api, параллельно.
