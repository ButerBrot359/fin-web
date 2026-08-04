# SCRUM-301 «Связанные документы»: дерево структуры подчинённости — фронт-дизайн

**Дата:** 2026-08-04 · **Основание:** `specs-local/scrum-301-svyazannye-dokumenty/SCRUM-301-spec-v1-2026-08-03-back.md` (бэк готов, все 6 пунктов таски).
**Решения зафиксированы с пользователем:** линии дерева не рисуем (минимум: отступ + жирный + иконка); баг «Движений» (константный node.id + пер-документный tabKey) не трогаем — чинится отдельным тикетом на бэке.

## 1. Суть

Панель «Связанные документы» перестаёт быть двумя вкладками («Основания»/«Зависимые») и
становится одним деревом произвольной глубины, как «Структура подчинённости» в 1С.
Дерево приходит **плоским списком строк** (binding `related.tree`), порядок строк = порядок
отрисовки, фронт не сортирует. Ключи строки: `_level` (отступ), `_direction`
(`UP | SELF | DOWN`), `_isCurrent` (жирный, ровно один), `_parentRowId`, `_presentation`,
`_isPosted` / `_isDeletionMarked` (иконка), `_status` (tooltip), `_route` / `_type.entityRef`
(проваливание), `_isTruncated` (маркер обрыва, некликабелен).

Таблица приходит с `props.rowMode === 'TREE'`, `navigable: true`, `anchorId`.
PAGE: `openInWorkspaceTab: true`, `tabKey: related:<anchorId>`, id `dialog.related.<anchorId>`
(пер-anchor — две панели не делят запись стора).

## 2. Архитектура (вариант A — принят)

Всё в SDUI-мире, легаси не трогаем. Единственное заимствование — иконки из
`shared/assets/icons` (уже используются в списке документов).

| Файл                                                                         | Роль                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/sdui/api/related-docs-api.ts`                                      | GET `/api/view/related-documents/{id}?anchorId=` + POST `…/{id}/post` / `unpost` / `toggle-deletion-mark` (`rootId`, `anchorId` в query) — зеркало `movements-api.ts` |
| `features/sdui/lib/open-related-docs.ts`                                     | ответ (`ViewResponse`) → эффекты: `openDialog` → `openDialogAsPanel`, `notify` → тост — зеркало `open-movements.ts`; там же обработчики пяти команд тулбара           |
| `features/sdui/lib/stores/related-docs-store.ts`                             | выделенная строка: `Record<anchorId, rowId \| null>` (zustand)                                                                                                        |
| `features/sdui/ui/nodes/composite/subordination-tree.tsx`                    | рендер дерева: отступ `_level` × шаг, жирный `_isCurrent`, иконка статуса, `_status` в `title`/aria, `_isTruncated` неактивен, выделение строки                       |
| `features/sdui/ui/nodes/composite/table-node.tsx`                            | ветка `props.rowMode === 'TREE'` в read-only пути → `SubordinationTree`                                                                                               |
| `features/sdui/ui/nodes/action/button-node.tsx`                              | перехват команд `related.*` до `dispatch` (фронтовый транспорт)                                                                                                       |
| `features/sdui/types/`                                                       | типы строки дерева; `_direction` — union-литерал `'UP' \| 'SELF' \| 'DOWN'`                                                                                           |
| `pages/documents/document-redirect/ui/document-redirect.tsx` + `app/App.tsx` | 🔴 блокер §4.2 спеки: `mode: 'entry'`, роут `/documents/:typeCode/:entryId` (симметрично `/dictionaries/:typeCode/:entryId`)                                          |

Отвергнутые варианты: дерево внутри `ReadOnlyTable` (связывает generic-рендерер с фичей;
`ReadOnlyTable` не читает `cellWidget`); перехват команд в `dispatch.ts` (dispatch завязан на
form-сессию, которой у панели нет).

## 3. Поведение

- **Клики:** одиночный = выделение (стор по `anchorId`), двойной = проваливание по
  `row._route`, фолбэк — `_type.entityRef.{typeCode,id}`. `_isTruncated` — ни выделения,
  ни проваливания. Маршрут: `/documents/:typeCode/:entryId` → `DocumentRedirect mode='entry'`
  → `/modules/<pageCode>/document/<typeCode>/<entryId>`.
- **Тулбар (5 кнопок, транспорт фронтовый, контекст из props кнопки `anchorId`/`rootId`):**
  - `related.refresh` → GET, те же `rootId`/`anchorId`;
  - `related.setRoot` → GET, `documentEntryId` = выделенная строка;
  - `related.post` / `related.unpost` / `related.toggleDeletionMark` → POST,
    `documentEntryId` = выделенная строка.
  - Нет выделения или выделен маркер обрыва → notify, запрос не отправлять.
  - Кнопки не гасим по состоянию узла (§4.5 спеки, паритет с единственным кадром 1С).
  - `requiresSelectedRow` НЕ выставлять — это резолв через стор пикера ссылок, к дереву
    отношения не имеет; активность ведём своим состоянием.
- **Подтверждение пометки:** нативный диалог (существующий `confirm-store`); текст —
  серверный `confirmMessageSet` (когда `_isDeletionMarked === false` у выделенной) или
  `confirmMessageUnset` (когда `true`). Серверный эффект `CONFIRM` невыразим — у панели нет
  form-сессии.
- **Ответы POST:** всегда 200; эффекты в порядке прихода: `notify` (тост) +
  `openDialog` (перестроенное дерево того же корня — заменяет содержимое той же вкладки по
  `tabKey`/`panelId`). «Документ не найден» — `warning` с одним эффектом, код общий.
- **Иконка статуса:** приоритет `_isDeletionMarked` → `_isPosted` → черновик
  (`DocDeletedIcon` / `DocPostedIcon` / `DocDraftIcon`); внутри ячейки, после отступа, слева
  от текста.

## 4. Чего НЕ делаем

- Линии ├─ └─ │ — решение пользователя; контракт (`_parentRowId`) позволяет добавить позже.
- Гашение кнопок по состоянию узла — §4.5 спеки.
- Кнопка «Найти…» из 1С — в таске нет.
- Справочники в дереве — следующая волна.
- Фикс «Движений» — отдельный тикет (бэк).
- Виртуализация — бэк режет дерево на 200 узлах.

## 5. Ошибки и краевые случаи

- Несуществующий id в GET → бэк отвечает notify, панель не открывается (путь движений).
- Помеченный документ + «Провести» → `error`-notify от бэка, фронт ничего не делает.
- Связи через ТЧ не показываются — паритет с 1С, не баг (§6.1 спеки).
- Лестница предков всегда линейна на реальных данных; рендер пишем по `_level`, ветвление
  UP не обрабатываем специально.
- Панель переживает форму-родителя (`panel-store.reset()` сохраняет workspace-вкладки);
  GET session-less — «Обновить» работает и после закрытия формы.

## 6. Тесты

- Юнит (рядом с файлами, как принято в фиче): рендер дерева (отступ / жирный / иконки /
  маркер обрыва), стор выделения, обработчики команд (нет выделения → notify; есть →
  корректный URL и query), выбор `confirmMessageSet/Unset`, `DocumentRedirect mode='entry'`,
  ветка `rowMode === 'TREE'` в `table-node`.
- Сквозная проверка на дев-стенде после выката бэка: тип `ЗаявкаНаРегистрациюГПСделки`
  (единственный SDUI-тип с цепочкой в дев-базе; дерево короткое — состояние данных).
  Проверить: смену корня («Вывести для текущего»), три действия, notify-исходы, живучесть
  панели после закрытия формы-родителя.
