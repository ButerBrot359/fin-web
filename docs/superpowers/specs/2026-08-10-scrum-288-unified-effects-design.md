# SCRUM-288 «Унификация Effect'ов» — дизайн фронта

Эпик SCRUM-258 «Архитектура построения интерфейса». Задача 6 промежуточной спеки (ADR-0037_SDUI).
Источник правды по контракту — бэк-спека `frontend-spec-unified-effects` v2 (2026-08-10),
слепок в `specs-local/scrum-288-unifikatsiya-effektov/`.

## Критерий задачи

Не «есть ли эффекты» (они давно есть: `navigate`/`openDialog`/`notify`/`download`/`confirm`/… в
`effect-handler.ts`), а **«не знает ли фронт, какой бизнес-процесс стоит за конкретным эффектом»**.
Аудит нашёл 9 нарушений; 4 уже закрыты (печать карточки/списка, движения, признак выделенной
строки) — не трогаем. Остаётся 6 кусков (§2.6 «запрещающие дефолты» — **отдельная спека**, не сюда).

Весь новый бэк — **за флагом** `sdui.related-docs.action-request` (default `false`), кроме печати/
экспорта отчёта (§3, включены на деве без флага). Фронт ветвится **по наличию полей**, не по
своему флагу: поля есть → новый путь, нет → старое поведение.

## Общая ось: единый исполнитель запроса действия

Новый модуль `lib/action-request.ts` — **минимальный** исполнитель: делает GET/POST по готовому
`ActionRequest` и проигрывает `res.effects` через `effect-handler`, **не трогая** `tree-store`/
`view-state-store`/ревизию. Причина (§2.1): панель session-less, её ответ несёт `revision=0,
formSessionId=null` без патчей; прогон через штатный `dispatch` осадит форму-владельца на протухшую
ревизию → 409 на следующем действии.

Исполнитель рекурсивно связан с `confirm`-мостом (панельный `toggle-deletion-mark` → сервер
отвечает `CONFIRM{confirmRequest}` → «Да» исполняет `confirmRequest` тем же исполнителем). Поэтому
исполнитель и `effect-handler` строятся вместе: вводится общий рантайм
`useSduiEffects()` → `{ play, playAll, executeActionRequest }`.

- `useSduiDispatch` — **сигнатура не меняется** (16 вызовов `const dispatch = useSduiDispatch()`
  целы), внутри потребляет этот рантайм.
- `button-node` берёт `executeActionRequest` для панельных кнопок.
- `report-result-node` берёт `play` для проигрывания `printEffect`/`exportEffect`.

### Расширения контракта (`types/view.ts`) — всё опционально

```ts
interface ActionRequest { method?: string; url: string; body?: Record<string, unknown> | null }

interface ViewNodeAction { …; request?: ActionRequest | null }              // §2.1
interface ViewEffect { …; request?: ActionRequest | null;                   // §3.1 download с телом
                          confirmRequest?: ActionRequest | null;            // §2.3
                          confirmBehavior?: ActionBehavior | null }         // §2.4
interface ViewResponse { …; dirty?: boolean | null }                       // §2.5
// REPORT_RESULT props: printEffect?: ViewEffect; exportEffect?: ViewEffect // §3.2
```

`executeActionRequest(request, selectedRowId?)`: дописывает **ровно один** query-параметр
`selectedRowId` (имя из контрактной константы `ViewRequestParams.SELECTED_ROW_ID`, не литерал) и
только при непустом id; никаких других модификаций `url` (гарантия сервера «плейсхолдеров нет»
проверяется бэк-тестом `ActionRequestUrlIsReadyTest`). `method === 'POST'` → post, иначе GET.
Ответ трактуется **только** как носитель `effects[]` — `revision`/`patches`/`state`/`formSessionId`
игнорируются безусловно.

---

## Блок A — Панель связанных документов (§2.1 + §2.2) · коммит 1

### Снос перехвата по именам (§2.1)

Удаляются целиком:

- `lib/open-related-docs.ts` (+`.test.ts`) — `handleRelatedCommand`, `ACTION_BY_COMMAND`,
  `isRelatedCommand`, `getSelection`, клиентский выбор текста подтверждения;
- `api/related-docs-api.ts` (+`.test.ts`) — `fetchRelatedDocsView`, `postRelatedDocsAction` (ручная
  сборка адресов `/api/view/related-documents/{id}/{action}`);
- вызов `handleRelatedCommand(command, node.props)` в `button-node.tsx:78`.

`openRelatedDocsForEntry`/`fetchRelatedDocsView` наружу не торчат (единственный внешний потребитель —
`button-node`), уходят без остатка.

### Новый путь клика панели

`button-node.handleClick`: если `clickAction.request` задан →
`executeActionRequest(request, requiresSelectedRow ? selectedRowId : undefined)`; иначе — сегодняшний
`dispatch`. Гашение кнопок без выделения (кроме «Обновить») уже работает через
`clickAction.requiresSelectedRow`/`selectionField` (`button-node:42-52`) — механизм не переделываем.

Пять кнопок при включённом флаге (адреса строит сервер, `RelatedDocumentsActionUrls`):

| Кнопка               | `requiresSelectedRow` | `request`                                                               |
| -------------------- | :-------------------: | ----------------------------------------------------------------------- |
| Обновить             |          нет          | `GET /api/view/related-documents/{rootId}?anchorId&language`            |
| Вывести для текущего |          да           | `GET /api/view/related-documents?anchorId&language` (+`&selectedRowId`) |
| Провести             |          да           | `POST …/post?rootId&anchorId&language` (+`&selectedRowId`)              |
| Отменить проведение  |          да           | `POST …/unpost?…` (+`&selectedRowId`)                                   |
| Пометить на удаление |          да           | `POST …/toggle-deletion-mark?…` (+`&selectedRowId`)                     |

### Единый реестр выделения (§2.2)

`lib/stores/ref-picker-selection-store.ts` + `lib/stores/related-docs-store.ts` → **один** стор.
Ключ — непрозрачный `selectionField`, значение — `string | number` (id пикера — `number`, id
строки дерева — `string`). `isDeletionMarked` в переносе **не нужен** (использовался только для
клиентского выбора текста подтверждения — теперь текст выбирает сервер).

- Писатель дерева `subordination-tree.tsx` переводится на общий стор, запись по `selectionField`
  из TABLE-действия (образец — `list-node.tsx:166-174` для пикера); прямая запись в
  `useRelatedDocsStore.select(anchorId, …)` убирается.
- Читатель кнопки — `button-node:42-45` уже читает по `clickAction.selectionField`, остаётся как есть,
  но из объединённого стора.
- При выключенном флаге TABLE не несёт `actions` → старый путь `subordination-tree` продолжает
  работать; веткой на флаг его не ломаем.

### Тесты (TDD)

- grep-инвариант: `ACTION_BY_COMMAND`/`isRelatedCommand` в `src/features/sdui` — пусто (крит. §6.1).
- `action-request`: дописывает ровно один `selectedRowId`; GET/POST по `request.method`; тело из
  `request.body`; никаких иных модификаций `url`.
- защитный: ответ панели с непустыми `patches`/`revision` **не** меняет дерево/сессию (крит. §6.3).
- регресс пикера ссылочного поля/подбора в ТЧ на объединённом сторе (крит. §6.4).

---

## Блок B — Confirm + dirty (§2.3 + §2.4 + §2.5) · коммит 2

### §2.3 `CONFIRM.confirmRequest`

`effect-handler` `case 'confirm'` передаёт мосту **весь** эффект (`confirmCommand` И `confirmRequest`
И `confirmBehavior`), а не только `command+message`. Мост в `dispatch.ts`:

- есть `confirmRequest` → на «Да» `executeActionRequest(confirmRequest)` (url уже готов —
  цель + `&confirmed=true`, session-less); на «Нет» — no-op;
- иначе (форм-сессионный путь) → `dispatchAction({type:'COMMAND', command}, confirmBehavior)`.

Ровно одно из `confirmCommand`/`confirmRequest` заполнено на конкретном эффекте.

### §2.4 багфикс `confirmBehavior` (то же место, тот же PR)

Сейчас confirm-мост шлёт `dispatchAction({type:'COMMAND', command})` **без второго аргумента** →
`behavior` не передан → `resetsDirty` берёт дефолт `false` → признак «есть несохранённое» **никогда
не снимается**. Симптом: «Пометить на удаление» на карточке документа после «Да» — сервер персистит
и чистит scratch, а форма на клиенте **остаётся грязной навсегда** (снять нечем, кроме перезагрузки).

Фикс: передавать `effect.confirmBehavior` вторым аргументом:

```ts
confirm: (command, message, confirmBehavior) => {
  void useConfirmStore
    .getState()
    .ask(message)
    .then((ok) => {
      if (ok) void dispatchAction({ type: 'COMMAND', command }, confirmBehavior)
    })
}
```

### §2.5 авторитетный `res.dirty`

`view-state-store`: добавить `setDirty(value: boolean)` (сегодня только `resetDirty()` → жёстко
`false`). `dispatch.ts`, в EVENT/COMMAND-ветке после `merge(res.statePatch ?? {})`, перед
`if (shouldReset) resetDirty()`:

- `res.dirty == null` (undefined/null) → «решай сам» — клиентский флаг как есть (поведение
  `shouldReset` из `behavior.resetsDirty` продолжает работать);
- `res.dirty` булево → **перекрывает** клиентский флаг безусловно, включая `false` с LIST/REPORT
  (авторитетное подавление клиентского «грязно»).

На `OPEN` поле не приходит — `replaceAll` и так сбрасывает флаг в `false`.

### Тесты

- `confirmRequest` исполняется `executeActionRequest`, не через `dispatch` (сессия не трогается).
- §2.4: после «Да» на подтверждённой команде форма **не** остаётся грязной (крит. §6.5).
- `res.dirty=false` подавляет клиентский `dirty=true` (крит. §6.6); `res.dirty` отсутствует → флаг не трогаем.

---

## Блок C — Download с телом + печать/экспорт отчёта (§3) · коммит 3

### §3.1 исполнитель `download` — ветка с телом

`effect-handler` `case 'download'`: есть `effect.request` → `POST` через `apiService.postFileBlob`
(`request.method`/`url`/`body`); есть только `effect.url` → сегодняшний GET через `getFileBlob`.
Логику сохранения (Content-Disposition `attachment`→скачать / `inline`→превью) не трогаем. Ровно одно
из `url`/`request` заполнено. Регресс на 4 существующих GET-эмиссиях (крит. §6.7).

### §3.2–3.5 REPORT_RESULT — `printEffect`/`exportEffect`

Новые пропы — **готовые** `download`-эффекты целиком (тело собрал сервер, тот же `source.body`).
Кнопки «Печать»/«Экспорт» в `report-result-node.tsx` ветвятся **по наличию** нового пропа:

- есть `printEffect`/`exportEffect` → `play(effect)` тем же исполнителем, **без** `gateway.print`/
  `gateway.exportXlsx` и без сборки `effectiveBody` под кнопку;
- нет → сегодняшний путь (`printSource.url` + ручное тело, `exportEnabled` + клиентский XLSX);
  старые пропы приходят рядом побайтово, ничего не удаляем до отдельной последующей задачи.

**Клиентские `userSettings` остаются наложением** (§3.5 п.3, F-S1-инвариант не тронут): сервер НЕ
кладёт `userSettings` в `body`. Если панель настроек изменила параметры — домешиваем `userSettings`
в `request.body` перед `play`, тем же способом, что сейчас в `effectiveBody`
(`report-result-node.tsx:69-74`). **Рабочий код наложения не удаляем.**

Жизненный цикл (`printEffect`/`exportEffect` = `null` до `run`, заполнены сразу после `report.run`,
снова `null` после `report.reset`/смены варианта) обеспечивает сервер — на фронте эффект **не
кешируем** дольше, чем он живёт в дереве.

### Тесты

- `download` ветвится по `request` (POST-тело через `postFileBlob` vs GET через `getFileBlob`).
- «Печать»/«Экспорт» при наличии `printEffect`/`exportEffect` проигрывают эффект без обращения к gateway.
- `userSettings`, изменённые в `SettingsPanel`, попадают в `request.body` скачанного файла.
- e2e на деве (§3.6, без флага): `OborotnoSaldovayaVedomost` (layout=TREE, списковый параметр) и
  `OSVPoSchetu` (без списковых) — открыть → сформировать → печать/экспорт качают файл → reset →
  пропы `null` (крит. §6.8).

---

## Порядок выката и приёмка

Одна ветка `feature/SCRUM-288-unified-effects`, 3 коммита A→B→C (всё пушим в неё, PR не открываем).
Блоки почти независимы; общий рантайм `useSduiEffects` заводится в коммите A, переиспользуется в B/C.

Критерии приёмки §6 (1–8) закрываются блоками: §6.1–6.4 → A, §6.5–6.6 → B, §6.7–6.8 → C.

**Не наша работа, держим в уме (§5):** легаси-фолбэк по `422 SCREEN_NOT_SDUI` не срабатывает
(перехвачен явными `<Route>` выше catch-all — дефект роутинга, тикет у PM); заголовок вложения печати
чинён на бэке — не полагаться на regex-подстроку `attachment` как на гарантию формата.

**Вопрос к бэку (§7):** если на включённом флаге `request.url` содержит `{...}` или
`requiresSelectedRow: true` без `selectionField` — это баг бэка (`ActionRequestUrlIsReadyTest`/
`SelectionKeyInvariantTest`), адрес сам не строю — пишу Alisher.

**e2e блока A:** панель за флагом `sdui.related-docs.action-request` (default off). Для сквозного
прогона попросить Alisher включить флаг на деве; до включения — юнит-тесты + сквозняк по готовности.
