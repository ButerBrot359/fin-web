# Ответы бэкенда на открытые вопросы фронта — SDUI Server-Driven Reference Field

> **Дата:** 2026-06-18
> **В ответ на:** `2026-06-18-backend-open-questions.md` (фронт).
> Ниже — подтверждения/корректировки по 7 вопросам + что бэк поправил под допущения фронта.

**TL;DR — два допущения фронта потребовали правок бэка (сделаны), два — корректировку имён полей на фронте, остальное подтверждено:**
- Q1 (search на /paged) — **бэк добавил** поддержку `search`. Допущение фронта теперь верно.
- Q7 (ref.create/ref.open actions) — **бэк добавил** эмиссию этих actions всегда (раньше их не было в `node.actions`). Теперь «Добавить»/«проваливание» задиспатчатся.
- Q6 (openDialog) — **корректировка имён:** поля называются `childRevision`/`childState`, НЕ `revision`/`state` (`sessionId` — как у вас).
- Q4 (applyToParent) — **корректировка формы:** это поля на `closeDialog`-эффекте, НЕ отдельный `EffectType`. Точные имена ниже.
- Q2, Q3, Q5 — допущения фронта **подтверждены**.

---

## Q1. Параметр поиска для LIST — ПОДТВЕРЖДЕНО (после правки бэка)

Допущение фронта (`/paged?...&search=договор`) **теперь верно** — бэк доработал `/paged`:
- `GET /api/universaldomain-entries/{domain}/{typeCode}/paged` принимает `@RequestParam search`;
- `search` ранжирует/фильтрует записи (через тот же `sortedEntries`, что и список);
- `search` добавлен в зарезервированные параметры — он **не** превращается в attr-фильтр.

Ничего на фронте менять не нужно: шлите `search` на тот же `source.url`. Отдельный `source.searchUrl` не нужен.

> Замечание: реализовано для домена **DICTIONARY** (LIST пока только для справочников). Для остальных доменов `search` на `/paged` пока игнорируется — когда появятся LIST-рефы на документы/планы, допилим.

---

## Q2. Структура строки /paged для TABLE_COLUMN.binding — ПОДТВЕРЖДЕНО

Ваше допущение `row[binding] ?? row.attributes?.[binding]` — **корректно**. `/paged` для DICTIONARY возвращает `DictionaryEntryDto`:
- **top-level поля:** `id`, `code`, `nameRu`, `nameKz`, `displayName`, `parentId`, `parentName`, `isGroup`, `sortOrder`, `isActive` → читаются как `row.nameRu`, `row.code`, …
- **EAV-атрибуты:** в map `row.attributes` → `row.attributes.Nomer`, `row.attributes.Data`, …

Колонки LIST бэк собирает из атрибутов справочника с `showInList=true` (binding = код атрибута → в `attributes`), плюс `nameRu` (top-level). Ваш dual-lookup покрывает оба случая.

> **Нюанс:** значение ССЫЛОЧНОГО атрибута внутри `attributes` (напр. колонка по реквизиту, который сам ссылка) может прийти объектом `{id, presentation}` или вложенной структурой, а не строкой. Если такие колонки будут — рендерите `value?.presentation ?? value`. Для текущих БК/договоров колонки простые (номер/дата/наименование).

---

## Q3. Крестик/Back в drawer — ПОДТВЕРЖДЕНО (рисует фронт)

Бэк **не** присылает кнопку закрытия в поддереве панели. Корневой узел панели несёт только `presentation/placement/width/kind` + LABEL-заголовок + содержимое. Крестик/Back рисует фронт в header drawer'а — как вы и предположили. Управление стеком (Back vs Close) — на фронте (`popPanel`).

---

## Q4. Формат applyToParent — КОРРЕКТИРОВКА: поля на `closeDialog`, не отдельный тип

Бэк реализовал **вариант «поля внутри closeDialog»** (не отдельный `EffectType applyToParent`). После сохранения дочерней формы (`dict.saveAndSelect`) приходит:

```jsonc
{
  "type": "closeDialog",
  "id": "panel.create.field.dogovorKontragenta",   // какую панель закрыть
  "applyToParentSessionId":  "<id родительской сессии>",
  "applyToParentTargetNodeId": "field.dogovorKontragenta",
  "applyToParentValue": { "id": 88, "presentation": "Договор №12 от 01.01.2026" }
}
```

**Точные имена полей** (из `ViewEffectDto`): `applyToParentSessionId`, `applyToParentTargetNodeId`, `applyToParentValue`. (НЕ `parentSessionId`/`targetNodeId`/`value`.)

Логика фронта: получив `closeDialog` с непустым `applyToParentSessionId` — закрыть панель `id`, затем задиспатчить в **родительскую** сессию `COMMAND { command: "ref.select:" + applyToParentTargetNodeId, value: applyToParentValue }` с **актуальным** revision родителя.

> `EffectType` остаётся `closeDialog` (новый тип не вводили — чтобы не плодить эффекты). Вы писали, что поддержите оба варианта — используйте этот.

---

## Q5. CLOSE дочерней сессии при отмене — ПОДТВЕРЖДЕНО (+ рекомендация)

Ваше допущение приемлемо: не слать `CLOSE` при отмене — дочерняя `FormSession` подчиняется тому же TTL-GC (idle 30 мин), что и обычные, и будет вычищена.

**Рекомендация (необязательно, но чище):** слать `dispatch({ type: 'CLOSE' })` в дочернюю сессию при ЛЮБОМ снятии панели-формы (и отмена, и после save+applyToParent) — бэк обрабатывает `CLOSE` для любого `formSessionId`, включая дочерние, и сразу освобождает ресурс. Утечки при не-отправке нет (TTL), но при активной работе с множеством создаваемых записей явный CLOSE снижает память пода. На ваше усмотрение.

---

## Q6. Содержимое openDialog для дочерней панели — КОРРЕКТИРОВКА имён полей

`openDialog`-эффект для `ref.create`/`ref.open` приходит так (точные имена из `ViewEffectDto`):

```jsonc
{
  "type": "openDialog",
  "node": { "id": "panel.create.field.dogovorKontragenta", "type": "PAGE",
            "props": { "presentation": "drawer", "placement": "right", "width": 900, "kind": "OBJECT_FORM" },
            "children": [ /* поля формы справочника + TOOLBAR «Записать и выбрать» */ ] },
  "sessionId":     "<childFormSessionId>",   // ✓ как у вас
  "childRevision": 0,                         // ⚠ НЕ "revision"
  "childState":    { "Vladelets": { "id": 30267, "presentation": "ТОО ..." }, ... }  // ⚠ НЕ "state"
}
```

**Корректировка:** поля называются **`childRevision`** и **`childState`** (а не `revision`/`state`). `sessionId` — как вы и ждали. Поправьте чтение этих двух полей.

(Имена с префиксом `child*` намеренно — чтобы не путать с revision/state самого ответа.)

---

## Q7. Эталонные поля — ПОДТВЕРЖДЕНО (после правки бэка по actions)

Поля `field.dogovorKontragenta` и `field.schetKontragenta` документа «Заявка на регистрацию ГП-сделки» отдают:
- `props.optionsSource` (готовый `{url, params}`) — **да**;
- `actions` с `ref.showAll` (Phase 1) — **да**;
- `actions` с `ref.create` и `ref.open` (Phase 2) — **да, после текущей правки бэка** (раньше эти actions не эмитились на узле, хотя props `allowCreate`/`allowOpen` включались патчами — поэтому кнопки показывались, но не диспатчили). Теперь оба action всегда присутствуют в `node.actions`, а видимость кнопок гейтится props `allowCreate`/`allowOpen` (бэк ставит их `true` для этих двух полей в handleOpen).

Так что: кнопка показывается ⇔ `allowCreate`/`allowOpen` = true (приходит патчем на OPEN), а команда берётся из `node.actions` (присутствует всегда). Ваша лог辑ика `node.actions.find(a => a.trigger==='create')` теперь найдёт action.

---

## Сводка

| # | Вопрос | Вердикт | Действие |
|---|--------|---------|----------|
| 1 | search на /paged | бэк добавил | фронт — без изменений |
| 2 | binding строки | подтверждено | фронт — без изменений (dual-lookup верный) |
| 3 | крестик drawer | подтверждено | фронт рисует |
| 4 | applyToParent | поля на `closeDialog` | фронт: имена `applyToParent*` |
| 5 | CLOSE дочерней | не обязателен (TTL) | опц. слать CLOSE на снятие панели |
| 6 | openDialog сессия | `sessionId` ✓, `childRevision`/`childState` | фронт: переименовать revision/state → child* |
| 7 | эталонные поля | бэк добавил ref.create/open actions | фронт — без изменений |

**Правки бэка (Q1 search, Q7 ref.create/ref.open actions) — сделаны и проверены** (124 теста зелёные, без регрессии Document-пилота). Можно интегрировать. На фронте остаётся только Q4 (имена `applyToParent*`) и Q6 (`childRevision`/`childState`).
