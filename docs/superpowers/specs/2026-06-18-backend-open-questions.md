# Открытые вопросы к бэкенду — SDUI Server-Driven Reference Field

> **Дата:** 2026-06-18
> **Контекст:** Фронт реализовал Phase 1 и Phase 2 server-driven ссылочного поля. Ниже — вопросы, по которым фронт сделал допущения. Нужно подтвердить или скорректировать.

---

## Phase 1: LIST node + Drawer + optionsSource

### 1. Параметр поиска для LIST

**Вопрос:** Какой параметр использовать для поиска в `LIST` узле?

**Текущее допущение фронта:** Поиск идёт на тот же `source.url` с параметром `search`:
```
GET /api/universaldomain-entries/DICTIONARY/DogovoryKontragentov/paged?af=Vladelets:30267&search=договор&page=0&size=25
```

**Альтернатива:** Если бэк хочет использовать отдельный `/search` эндпоинт, нужно либо:
- Положить его URL в `source.url` (тогда фронт ничего не меняет)
- Добавить отдельное поле `source.searchUrl` (фронту нужно будет переключаться)

**Нужно:** Подтвердить что `search` параметр на `/paged` работает, или указать другой подход.

---

### 2. Структура строки /paged для TABLE_COLUMN.binding

**Вопрос:** Где в строке ответа `/paged` лежат значения для колонок LIST-грида?

**Текущее допущение фронта:** Фронт пробует оба варианта:
```ts
const value = row[binding] ?? row.attributes?.[binding]
```

Примеры binding из TABLE_COLUMN: `Nomer`, `Data`, `nameRu`.

**Нужно:** Подтвердить структуру строки. Лежат ли `Nomer`, `Data` на top-level (`row.Nomer`) или внутри `row.attributes.Nomer`? Или часть полей top-level (`nameRu`, `code`), а часть в `attributes` (`Nomer`, `Data`)?

---

### 3. Крестик/Back в drawer

**Вопрос:** Кто рендерит кнопку закрытия (крестик) в drawer?

**Текущее допущение фронта:** Фронт рисует крестик в header drawer'а (поверх NodeRenderer). Бэк не присылает кнопку закрытия в поддереве.

**Нужно:** Подтвердить. Если бэк хочет управлять кнопкой (например, Back vs Close в Phase 2 стеке), нужно перейти на серверную кнопку.

---

## Phase 2: Сессия-на-панель + applyToParent

### 4. Формат эффекта applyToParent

**Вопрос:** Какой точный формат эффекта возврата выбора из дочерней панели?

**Текущее допущение фронта:** Отдельный EffectType `applyToParent`:
```jsonc
{
  "type": "applyToParent",
  "parentSessionId": "<id родительской сессии>",
  "targetNodeId": "field.dogovorKontragenta",
  "value": { "id": 88, "presentation": "Договор №12 от 01.01.2026" }
}
```

**Альтернатива из спеки:** Может быть реализован как поля внутри `closeDialog`:
```jsonc
{
  "type": "closeDialog",
  "id": "panel.create.field.dogovorKontragenta",
  "parentSessionId": "...",
  "targetNodeId": "...",
  "value": { ... }
}
```

**Нужно:** Зафиксировать точную форму. Фронт поддержит оба варианта, но нужно знать что придёт.

---

### 5. CLOSE дочерней сессии при отмене

**Вопрос:** Когда пользователь закрывает дочернюю панель-форму (крестик/Back без сохранения), нужно ли слать `CLOSE` в дочернюю сессию?

**Текущее допущение фронта:** Фронт вызывает `popPanel()` (убирает панель из стека), но **НЕ шлёт** `CLOSE` в дочернюю сессию. Сессия просто остаётся на бэке до TTL.

**Нужно:** Подтвердить. Если бэк хочет явный `CLOSE` для очистки ресурсов — фронт добавит `dispatch({ type: 'CLOSE' })` в дочернюю сессию при закрытии панели.

---

### 6. Содержимое openDialog для дочерней панели-формы

**Вопрос:** Какие данные приходят в `openDialog` эффекте для `ref.create` / `ref.open`?

**Текущее допущение фронта:** Эффект содержит:
```jsonc
{
  "type": "openDialog",
  "node": { "id": "panel.create.field.xxx", "type": "PAGE", "props": { "presentation": "drawer" }, "children": [...] },
  "sessionId": "<childFormSessionId>",
  "revision": 0,
  "state": { "Kontragent": { "id": 30267, "presentation": "ТОО Рога и Копыта" }, ... }
}
```

**Нужно:** Подтвердить что `sessionId`, `revision`, `state` действительно приходят в `openDialog`. Если формат другой — скорректировать.

---

## Общие вопросы

### 7. Эталонные поля для тестирования

**Вопрос:** Какие поля уже мигрированы на новый контракт (отправляют `optionsSource` и `ref.*` actions)?

**Из спеки:** `dogovorKontragenta` и `schetKontragenta` документа «Заявка на регистрацию ГП-сделки».

**Нужно:** Подтвердить что эти поля уже отдают:
- `props.optionsSource` с готовым URL
- `actions` с `ref.showAll` (Phase 1)
- `actions` с `ref.create` / `ref.open` (Phase 2, если готово)

---

## Резюме: что фронт реализовал и с какими допущениями

| Фича | Допущение | Статус |
|---|---|---|
| Поиск в LIST | `search` на `/paged` | Ждём подтверждения |
| Binding строки | `row[binding] ?? row.attributes?.[binding]` | Ждём подтверждения |
| Крестик drawer | Фронт рисует | Ждём подтверждения |
| applyToParent | Отдельный EffectType | Ждём формата |
| CLOSE дочерней сессии | Не шлём | Ждём подтверждения |
| openDialog с сессией | sessionId + revision + state в эффекте | Ждём подтверждения |
| Эталонные поля | dogovorKontragenta / schetKontragenta | Ждём миграции на бэке |
