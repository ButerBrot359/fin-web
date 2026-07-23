# SCRUM-283 (Actions v2) — закрытие вкладки на соседнюю, дизайн фронт-дельты

**Тикет:** [SCRUM-283](https://sulubaiguskarova.atlassian.net/browse/SCRUM-283) «Контракт действий (Actions)».
**Спека:** `specs-local/scrum-283-actions/SCRUM-283-spec-v2-2026-07-22-back.md` (ревизия по фронт-фидбэку).

v1 контракта уже реализован и влит в main (`2190777`). v2 — узкая ревизия по моему Flow B
фидбэку: дескриптор `onDirtyClose` бэк сменил с `saveAndClose` (серверный `navigate`→список) на
`save` + `closeAfter:true` (только персист; куда сесть после — решает клиент). Решение владельца
(§2.3): крестик в шапке И закрытие из таб-бара **единообразно садятся на соседнюю вкладку**, а не
уводят в список документов.

## Scope

**Только документы.** `SduiScreen` шарится с карточкой справочника (SCRUM-244), но её контракт
закрытия иной (`dict.saveAndClose` имеет `closeAfter:❌`, закрывается серверным navigate) и без
рантайма не проверяется. Поэтому `onSavedAndClosed` в `SduiScreen` **остаётся optional** — справочник
не трогаем, его поведение (→ список справочника) сохраняется. Всё — слой `features/sdui` +
`sdui-document-page`; из `workspace-tabs` только чтение (`tabs`). Легаси не трогаем.

## Находка: naive-мёрж §4.3 ломает «Провести и закрыть»

Спека §4.3 предлагает `onCloseAfter` **безусловно** уводить на соседнюю вкладку. Но `postAndClose`
несёт `closeAfter:true` И серверный `navigate` в список (§4.6 — намеренно, «явное завершение
документа»). Порядок в `dispatch`: эффекты (navigate→список) → потом `closeAfter()`. Безусловная
навигация на соседа перебила бы серверный переход в список — `postAndClose` уехал бы на соседа
(двойная навигация).

**Решение (улучшение над спекой, отписать бэку/владельцу):** `dispatch` знает, был ли среди
эффектов `navigate`, и прокидывает флаг в `closeAfter(didNavigate)`. `onCloseAfter` всегда закрывает
вкладку, а на соседнюю навигирует **только если сервер сам не навигировал**:
- `save` + `closeAfter` (крестик, таб-бар) → нет серверного navigate → соседняя ✓
- `postAndClose` → серверный navigate в список → `onCloseAfter` только закрывает ✓

## Изменения

**Общее (обратно совместимо):**
- `sdui/lib/dispatch.ts`: `didNavigate = (res.effects ?? []).some(e => e.type === 'navigate')`;
  `if (shouldClose) closeAfter?.(didNavigate)`.
- `sdui/lib/sdui-session-context.tsx`: `closeAfter?: (didNavigate?: boolean) => void`.
- `sdui/ui/sdui-screen.tsx`: `closeAfter: (didNavigate) => onCloseAfter?.(location.pathname, didNavigate)`;
  тип пропа `onCloseAfter?: (route: string, didNavigate?: boolean) => void`. Хендлер pendingAction и
  optional `onSavedAndClosed?` — без изменений (справочник ими пользуется).

**`sdui-document-page.tsx`:**
- `goToNeighborTab()` — общий хелпер: `tabs[0].path + tabs[0].search` или `'/'`.
- `onCloseAfter(route, didNavigate)` → `removeTab`+`closeTab`; `if (!didNavigate) goToNeighborTab()`.
- Убрать `onSavedAndClosed` из `tabsApi` (поглощён `onCloseAfter`).
- `onDiscard` и `handleClose` (non-dirty) → `closeCurrentTab()` + `goToNeighborTab()` (не `listPath`).
- `onSave` — без изменений (`dispatch(desc.command, desc.behavior)`; `closeAfter:true` закроет+сядет).
- Убрать неиспользуемые `getDocumentListPath`/`listPath`.

## Тесты

`sdui/lib/dispatch.test.ts`: `closeAfter` получает `didNavigate` — `true` при наличии `navigate`
в `effects`, `false` без. Существующий `closeAfter:true → вызван` остаётся зелёным
(`vi.fn()` принимает аргумент). Проверки (tsc + vitest) — в конце.

## Верификация

E2E-паритет (крестик/таб-бар → соседняя вкладка ровно одной навигацией; `postAndClose` → список)
требует бэка с новым дескриптором `save`+`closeAfter` — он приложил v2, значит изменение готово;
юнит-тест закрывает guard на уровне dispatch.
