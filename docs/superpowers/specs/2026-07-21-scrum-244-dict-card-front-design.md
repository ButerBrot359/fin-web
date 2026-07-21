# SCRUM-244 — фронт-часть: карточка справочника, эффекты, восстановление сессии

**Дата:** 2026-07-21
**Ветка:** `feature/SCRUM-244-dict-card-links`
**Зона:** SDUI (`features/sdui`) + маршруты; легаси не трогаем (кроме развилки newView по образцу документов).
**Источник:** спека бэка `SCRUM-244-spec-v1-2026-07-21-back.md` (вложение в Jira, слепок в
`specs-local/scrum-244-struktura-podchineniya/`).

## Контекст

Бэкенд довёл справочник «Физические лица» до паритета с 1С: карточка отдаётся страницей,
вкладки-регистры, панель «Перейти», «Создать на основании». Проверено рантаймом на dev
(`https://dev-api.qazyna.ai`): `newView:true` у `FizicheskieLitsa`, OPEN с
`layoutCode="dict.FizicheskieLitsa.OBJECT_FORM"` возвращает дерево страницей, heartbeat
отвечает 204/404, в дереве живут `variant: text|text-dropdown|contained|outlined|dropdown`
и `dataType` у всех колонок, `dict.saveAndClose` шлёт `navigate:"/dictionaries/<TypeCode>"`.

От фронта: четыре новых элемента контракта + два багфикса восстановления сессии
(регресс существует в main уже сейчас).

## Блок A — восстановление сессии (первым: без него карточку убивает любой деплой бэка)

### A1. Нормализация 409 в транспорте

`view-transport.ts` при 409 создаёт `ViewConflictError` из тела как есть, но по проводу код
конфликта приходит в поле `error`, а тип и обработчик читают `code` → обработчик конфликтов
не срабатывает никогда.

Фикс на границе: при 409 маппить `code = body.code ?? body.error`. Тип
`ConflictError['code']` расширить до `string` — закрытый union и был причиной, по которой
баг выглядел невозможным для компилятора. `conflict-handler.ts` и его тесты не меняются.

### A2. `layoutCode` для переоткрытия

`reopen()` в `dispatch.ts` шлёт `OPEN` без `layoutCode`, который обязателен → цикл 409→400.

Храним `layoutCode` в session-context (`sdui-session-context`): `setSession` при OPEN
запоминает его, `reopen()` использует. Отступление от рекомендации спеки «на уровне модуля»
осознанное: панели/дровера имеют собственные `SduiSessionProvider`, одна модульная
переменная перепутает параллельные сессии; контекст у экрана и кликнутой ноды общий,
так что проблема «useRef в разных компонентах» не воспроизводится.

### A3. Ретрай после переоткрытия

После восстановления сессии повторяем исходное действие, чтобы клик не терялся, но
исключаем команды записи (их scratch умер вместе с сессией — повтор сохранил бы пустую
форму). Правило: не ретраить `COMMAND` с `behavior.resetsDirty || behavior.closeAfter`
(маркеры записи из контракта Actions, SCRUM-283). `nav.open` (behavior:null) ретраится.

### A4. Heartbeat

`POST /api/view/{formSessionId}/heartbeat` раз в 10 минут; старт/стоп в `SduiScreen` по
появлению/уходу `formSessionId`. Ответ 404 → молча остановить пинг: следующее действие
пользователя получит 409 и пройдёт путь восстановления A1–A3.

## Блок B — новые элементы контракта

### B1. Эффект `refresh`

Case в `effect-handler.ts` → `queryClient.invalidateQueries({queryKey:['sdui-list']})`
(ключ списков `list-node.tsx`). Payload эффекта рантаймом снять не удалось — реализация
толерантная: инвалидация не зависит от полей эффекта. Вопрос Talgat'у о точной форме и
триггерах — уточнение, не блокер.

### B2. Эффект `confirm`

Императивный мост по спеке §5: zustand-стор `confirm-store` + `ConfirmDialogHost` на уровне
app, `effect-handler` через стор ждёт ответа пользователя. **Каркас делаем сразу; провод к
эффекту — после ответа Talgat'а**: неизвестно, что играть по «Да» (вложенные effects?
повтор команды с флагом?) и в каком сценарии эффект приходит (на dev `nav.open` при dirty
вернул обычный `openDialog`). Блокирует только этот пункт.

### B3. Варианты кнопок

`button-node.tsx`: маппинг `contained/outlined/text` → одноимённые MUI-варианты,
`primary`→`contained` (обратная совместимость), дропдаун-поведение при `dropdown` **и**
`text-dropdown` (последний рендерится MUI `variant="text"` — меню, выглядящее ссылкой,
для «Ещё...» панели «Перейти»).

### B4. Форматирование ячеек по `dataType`

Чистый модуль `features/sdui/lib/format-cell.ts`: `DATE`→`дд.мм.гггг`, `DATETIME`→ плюс
`чч:мм` (полночь опускается, как в 1С), `BOOLEAN`→галочка/пусто, ссылочные→`presentation`.
Подключается в `list-node.tsx` (сейчас голый `String()`); `dataType` берётся из
`TABLE_COLUMN.props`. Реализация на date-fns. Легаси-`formatCellValue` из shared не
переиспользуем — у SDUI свой формат и своя зона.

## Блок C — карточка справочника страницей

### C1. Развилка newView

По образцу документов (`document-entry-page.tsx`): `use-dictionary-type.ts` пробрасывает
уже приходящее поле `newView` (эндпоинт `/api/universaldomain-types/DICTIONARY/<TypeCode>`);
маршрут `/modules/:pageCode/dictionary/:moduleCode/:entryId` ветвится на
`SduiDictionaryPage` (аналог `sdui-document-page.tsx`,
`layoutCode="dict.${moduleCode}.OBJECT_FORM"`) или легаси-страницу.

Фолбэк: `404` от OPEN — штатный гейт раскатки (тип ещё не переведён), показываем
легаси-страницу, не ошибку.

### C2. Плоский редирект

Новая страница `dictionary-redirect` (по образцу `document-redirect`):
`/dictionaries/:typeCode` и `/dictionaries/:typeCode/:entryId` → резолв раздела →
`/modules/<pageCode>/dictionary/...`. Через него же работает `navigate` после
`dict.saveAndClose` — `effect-handler` не меняется.

## Тесты

- unit `format-cell`: все dataType, полночь, пустые значения;
- unit нормализации 409: тело с `error` → `ConflictError.code`;
- unit правила ретрая: команда записи не ретраится, `nav.open` ретраится;
- существующие тесты `conflict-handler` остаются зелёными без правок — признак фикса на границе.

## Порядок работ

A → B → C. Открытый вопрос по B2 (форма `confirm`) не блокирует остальное.

## Открытые вопросы Talgat'у (ушли спекой v2 в Jira)

1. `confirm`: payload, сценарий-триггер, что играть по подтверждению.
2. `refresh`: payload и триггеры (только дочерним дровер-сессиям?).
