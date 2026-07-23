# SCRUM-265 «Замечания по кнопкам» — консолидированный дизайн фронт-части

**Тикет:** [SCRUM-265](https://sulubaiguskarova.atlassian.net/browse/SCRUM-265), волна «паритет командных панелей кадровых документов с 1С».

**Источники правды (детальные, проверены бэком живьём):**
- `specs-local/scrum-265-zamechaniya-knopki/SCRUM-265-spec-v1-2026-07-22-back.md` — choice-drawer (п.9).
- `specs-local/scrum-265-zamechaniya-knopki/SCRUM-265-spec-v2-2026-07-23-back.md` — FE-1/FE-2/FE-3.
- Комментарий Jira 10355 (spec v3, 23.07) — FE-4.

Эта записка — консолидация: что делаем, где, какие приняты решения. Диффы-референсы — в спеках бэка.

## Объём

Пять независимых правок одной веткой `feature/SCRUM-265-buttons` (база — `origin/main` @247459b).
Границы: всё в `features/sdui`, кроме FE-4 (`widgets/document-list-toolbar` + `entities/document-type`). Легаси не трогаем.

| # | Что | Файлы |
|---|---|---|
| v1 | choice-drawer регрессия (п.9): «Создать» в дровере реф-пикера не работает (409) | `panel-store.ts`, `open-dialog-panel.ts`, `dialog-host.tsx`, `panel-state-provider.tsx` |
| FE-1 | «Заполнить (ПК)» не применяет серверный `setValue` в таблицы | `lib/hooks/use-table-sync.ts` |
| FE-2 | пункты «Ещё» игнорируют `enabled:false`/`tooltip` | `ui/nodes/action/menu-item-node.tsx` |
| FE-3 | глиф `dtkt` («Дт/Кт») не зарегистрирован | `ui/nodes/action/button-icons.tsx` |
| FE-4 | скрыть «Создать»/«Скопировать» в тулбаре СПИСКА при `interactiveCreationForbidden` | `entities/document-type/types/document-type.ts`, `widgets/document-list-toolbar/ui/document-list-toolbar.tsx` |

## Решения по реализации

**v1 — трёхветочный рендер панели (spec v1 §4).** Различаем бессессионные панели по `childState`:
`session` → `PanelFormProvider`; иначе `hasChildState` → `PanelStateProvider` (read-only снимок, движения/related-docs);
иначе (choice-drawer, `childState` нет) → голый `NodeRenderer` в контексте экрана — его кнопки суть команды
родительской сессии. Плюс `getSession`-fallback в `panel-state-provider` на root-стор (команды из childState-панелей).

**FE-1 — реактивная подписка (spec v2 §5).** `getValue(node.binding)` (разовый снимок) → `useBindingValue(node.binding)`
(zustand-селектор). Тот же класс фикса, что master-detail в SCRUM-282 #4. Non-root (панельный кейс) не регрессирует:
`useBindingValue` для `kind !== 'root'` внутри падает на `getValue`.

**FE-2 — зеркалим паттерн `button-node`.** В `menu-item-node`: читаем `enabled`/`tooltip`,
рисуем `MenuItem disabled={!enabled}`, оборачиваем в `<Tooltip>` со `<span>`-обёрткой (без неё tooltip не
работает на disabled), при `disabled` не диспатчим COMMAND. Новый паттерн не вводим.

**FE-3 — glyph-only, без бэк-правки.** В `button-node` `content = icon ?? label`, значит после регистрации
глифа `dtkt` label «Дт/Кт» перестаёт рендериться (кнопка становится icon-only) — просить бэк убрать label
не нужно. Глиф несёт смысл сам: скруглённый квадрат с текстом «Дт» над «Кт» в две строки (как в 1С),
inline-SVG на `currentColor` (CSP панелей блокирует сетевые ассеты).

**FE-4 — условный рендер (spec v3 §4).** В `DocumentType` — `interactiveCreationForbidden?: boolean`
(optional: старый бэк поля не шлёт, `undefined` = `false`). В тулбаре списка — `useDocumentType(moduleCode)`
(тот же тип уже в suspense-кеше страницы, лишнего запроса нет), при `true` не рендерим «Создать»/«Скопировать».

## Порядок и тесты

Порядок: v1 → FE-1 → FE-2 → FE-3 → FE-4 (независимы, отдельные коммиты).
Тесты (Vitest):
- FE-1 — серверный `setValue` по binding таблицы обновляет rows (существующий `use-table-sync.test.tsx`).
- FE-2 — disabled-пункт меню не диспатчит и показывает tooltip.
- FE-4 — рендер тулбара с `interactiveCreationForbidden: true` → нет кнопки `actions.create`.
- v1/FE-3 — покрываются существующими тестами панелей/иконок + ручная сверка (e2e требует бэк webbuh #658).

Проверки прогоняем в конце (по CLAUDE.md — не после каждого изменения): `tsc -b` + `vitest` затронутых слайсов.
