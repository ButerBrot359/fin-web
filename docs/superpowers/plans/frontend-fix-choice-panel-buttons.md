# SDUI: фронт-правки (fin-web) — тулбар панели выбора «Показать всё» (Заявка ГП-сделки)

> **Дата:** 2026-06-30
> **Контекст:** баг 3 из батча по `ZayavkaNaRegistratsiyuGPSdelki`. Панель выбора справочника
> (drawer «Показать всё» / «Посмотреть всё»), которую собирает бэк через `ChoicePanelComposer`
> (ADR-0009 §2.2), на фронте показывает: **дубль кнопки «Выбрать»**, и **нет кнопок «Создать»
> и «Скопировать»**.
>
> Бэк-часть уже поправлена (см. ниже). Здесь — что доделать на фронте.

---

## Что бэк теперь отдаёт

`ChoicePanelComposer.composeChoicePanel` собирает drawer-поддерево:

```
PAGE id="panel.choice.{field}"  props={presentation:'drawer', placement:'right', width:900, kind:'CHOICE_FORM'}
  ├ LABEL  (заголовок-инжект)
  └ VSTACK
     ├ TOOLBAR id="panel.choice.{field}.toolbar"
     │    ├ BUTTON id="...btn.select"  props={label:"Выбрать", command:"ref.select:{field}"}
     │    └ BUTTON id="...btn.create"  props={label:"Создать", command:"ref.create:{field}"}   ← НОВОЕ
     └ LIST id="panel.choice.{field}.list"
            actions=[select/activate → ref.select:{field}]
```

Файл: [ChoicePanelComposer.java](../../../webbuh-api/src/main/java/kz/asiaservis/view/composer/ChoicePanelComposer.java).
Бэк отдаёт **ровно одну** кнопку «Выбрать» в `TOOLBAR` и (теперь) кнопку «Создать».

---

## Баг 3a — дубль кнопки «Выбрать»

### Корень (фронт)
Бэк присылает `TOOLBAR > BUTTON «Выбрать»` как часть дерева панели — фронтовый `NodeRenderer`
рисует её штатно. Но `PanelHost`/drawer-обёртка панели выбора **дополнительно рисует свою
встроенную кнопку подтверждения «Выбрать»** (footer/primary-action drawer'а). Итог — две
кнопки «Выбрать»: одна из дерева (бэк), одна из chrome drawer'а (фронт).

### Минимальная правка (фронт)
Для drawer'а с `kind:'CHOICE_FORM'` **не рисовать собственную кнопку «Выбрать»** — источник
кнопок выбора/действий теперь бэковый `TOOLBAR`. Варианты:
- убрать встроенную footer-кнопку «Выбрать» у `CHOICE_FORM`-панели (рекомендуется — бэк
  канонично владеет набором кнопок, ADR-0009 §2.2);
- ИЛИ, если встроенная кнопка нужна как primary-action, наоборот не рендерить бэковый
  `...btn.select` (менее предпочтительно — расходится с философией «бэк владеет тулбаром»).

Выбор строки в списке и так работает через `actions` узла `LIST` (`select`/`activate` →
`ref.select:{field}`) — это не кнопка, дубля не создаёт.

---

## Баг 3b — кнопка «Создать»

### Что готов бэк
`TOOLBAR` теперь содержит `BUTTON` с `command:"ref.create:{field}"`. Команда полностью
поддержана бэком: `ViewController.processRefCommand` → `processRefCreate` создаёт **дочернюю
form-session** справочника и отвечает `openDialog`-эффектом с поддеревом формы создания
(`sessionId`/`revision`/`state` дочерней сессии — ADR-0009 §2.4.2, контракт в
[frontend-spec-server-driven-reference-field-phase2.md](frontend-spec-server-driven-reference-field-phase2.md)).

### Что сделать (фронт)
Кнопка «Создать» — обычный `BUTTON`-узел из дерева, её `click` шлёт
`COMMAND {command:"ref.create:{field}"}` в сессию текущей панели. Рендеринг кнопки уже
покрывается `NodeRenderer` (узел приходит с бэка). **Чтобы «Создать» заработал end-to-end,
нужен `PanelHost` со стеком панелей и сессией-на-панель** (Phase 2, Задача 2 спеки
[phase2](frontend-spec-server-driven-reference-field-phase2.md)) — иначе ответный `openDialog`
с дочерней сессией некуда смонтировать. Если PanelHost Phase 2 ещё не сделан — это и есть
блокер «Создать»; кнопка отрисуется, но дочерняя форма не откроется.

> Если по UX «Создать» в панели выбора пока не нужен до готовности PanelHost — фронт может
> временно скрывать `...btn.create` до выката Phase 2. Бэк кнопку отдаёт всегда (аналог
> always-emit для field-actions `ref.create`, [NodeBuilder.java:251](../../../webbuh-api/src/main/java/kz/asiaservis/view/composer/NodeBuilder.java)).

---

## Баг 3c — кнопка «Скопировать» (бэк реализован)

### Что готов бэк
`TOOLBAR` теперь содержит `BUTTON «Скопировать»` с `command:"ref.copy:{field}"`. Команда
обработана: `ViewController.processRefCopy` →
`DictionaryChildSessionService.createChildSessionForCopy` создаёт **новую дочернюю
form-session** справочника (`documentEntryId=null`), сидирует её scratch значениями исходной
записи (`nameRu`/`nameKz` + все атрибуты; `code` НЕ копируется — присвоит `createEntry`),
грузит исходную запись для **предзаполнения формы** и отвечает `openDialog`-эффектом с
поддеревом формы создания + транспортом дочерней сессии (как `ref.create`). Сохранение
(«Записать и выбрать») создаёт новую запись; исходная не меняется.

«Создать копированием» = аналог 1С: открывается форма новой записи, предзаполненная копией
**выделенной строки** списка.

### Что сделать (фронт)
1. **Трекинг выделенной строки в `LIST`.** При клике «Скопировать» фронт обязан приложить id
   выделенной строки списка в `action.value`:
   `COMMAND {command:"ref.copy:{field}", value:{ id:<selectedRowId> }}`.
   Без выделения бэк отвечает `notify('warning', 'Выберите запись для копирования')` и форму
   не открывает — так что фронту нужно либо требовать выделение, либо дизейблить «Скопировать»
   до выбора строки.
2. **Рендер дочерней формы** — та же инфраструктура `PanelHost`/сессия-на-панель, что и
   `ref.create` (Phase 2, Задача 2). Ответный `openDialog` несёт `sessionId`/`revision` копии;
   поля предзаполнены значениями исходной записи (приходят в дереве панели). Пользователь
   правит копию и жмёт «Записать и выбрать» → стандартный `dict.saveAndSelect`.

> Зависимость та же, что у «Создать»: без `PanelHost` Phase 2 дочернюю форму копии негде
> смонтировать. Если Phase 2 ещё не выкачен — кнопка отрисуется, но drawer не откроется.

### Бэк-детали (для справки)
- `value.id` извлекается через `extractId` (поддержка `{id:N}` и числа).
- Глубина вложенности ограничена `MAX_NESTED_SESSION_DEPTH=3` (как для create/open).
- Формат scratch копии совпадает с EVENT-путём: ссылки — числовой id, примитивы — как есть;
  `DictionaryService.createEntry` присвоит новый `code`.

---

## Сводка

| # | Что | Где правка (фронт) | Бэк |
|---|-----|-----------|-----|
| 3a | Дубль «Выбрать» | `PanelHost`/drawer chrome — не рисовать свою кнопку у `CHOICE_FORM` | ✅ готово (1 кнопка в TOOLBAR) |
| 3b | «Создать» | рендер есть; нужен PanelHost Phase 2 для дочерней формы | ✅ готово (`ref.create`) |
| 3c | «Скопировать» | трекинг выделенной строки → `value:{id}`; рендер как `ref.create` | ✅ готово (`ref.copy`) |
