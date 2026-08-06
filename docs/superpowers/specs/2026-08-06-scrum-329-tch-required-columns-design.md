# SCRUM-329 — Обязательные колонки в ТЧ: «\*» в шапке и подсветка пустой ячейки

Дата: 2026-08-06. Автор: front (fin-web). Основание: `specs-local/scrum-329-obyazatelnye-kolonki-tch/frontend-spec-tch-required-column.md`.

## 0. Сторона задачи — фронт (проверено)

Задача целиком фронтовая, бэк свою часть сделал и задеплоил (подтверждено вживую на dev-api):

- Бэк отдаёт `props.required: true` на `TABLE_COLUMN` (ключ кладётся только при `true`, у необязательной колонки ключа нет). Проверено OPEN-ом формы `RegistratsiyaZayavleniyPoVychetamIPN`: `required:true` у `vychetyIPN.col.vychetIPN`, `grafikVycheta.col.{razmer,periodNachalo,periodKonets}`; служебный `vychetIPNKey` — `visible:false`.
- Утечка метаданных (одноимённые колонки разных ТЧ) починена на бэке (`NodeBuilderTableColumnRequiredTest`).
- Серверная валидация при проведении есть (HTTP 422 `ATTRIBUTE_REQUIRED`).
- На фронте контракт уже разобран: `build-column-defs.ts` кладёт `required` в дескриптор колонки, но **нигде не читается**.

Точечная адресация ошибки от сервера до ячейки (`rowNumber`/`columnCode`) — **вне скоупа** (§4 исходной спеки): контракт `ValidationMessage` адресует ошибку к ТЧ, не к ячейке. Для сценария из баг-репорта не нужна.

**Ключевая находка:** в SDUI нет клиентской валидации полей вообще. У полей шапки «\*» рисует MUI (`required`), а красная рамка/«Обязательное поле» — серверная (`props.error` из патчей, гасится `clearAllErrors` на COMMAND). Сервер не может покрасить конкретную ячейку → §3.2 реализуется как **новая клиентская валидация**.

## 1. Решения (согласованы)

- Клиентская валидация **только подсвечивает**, сабмит НЕ блокирует — авторитет остаётся за серверным 422 (спека называет клиентскую подсветку «дублёром»).
- Текст «Обязательное поле» в тесной ячейке — **красная рамка + tooltip** (`title`), без helperText под ячейкой (не ломает высоту строки ТЧ).

## 2. §3.1 — «\*» в заголовке колонки

Файл: `src/features/sdui/lib/utils/build-column-defs.ts`.

- Leaf `TABLE_COLUMN` (плоская): `header = col.required && !col.readonly ? <RequiredMark label={col.label}/> : col.label`.
- Под-колонки VERTICAL-группы (`COLUMN_GROUP` orientation=VERTICAL): то же правило поштучно для `subLabels` (сейчас `content: col.label`).
- Горизонтальная `COLUMN_GROUP` (label группы) — не трогаем: «\*» только у колонок-реквизитов.
- `readonly` исключаем: такая ячейка — `<span>`, требование невыполнимо.
- `visible:false` уже отсекается до построения заголовка — служебный `vychetIPNKey` не дойдёт, отдельная проверка не нужна.

Компонент: `src/features/sdui/ui/nodes/composite/required-mark.tsx` — `label` + красный `*` (цвет `error.main`, стиль как у MUI-астериска `.MuiFormLabel-asterisk`).

## 3. §3.2 — подсветка пустой обязательной ячейки

### 3.1. Определение пустоты

Файл: `src/features/sdui/lib/utils/is-cell-empty.ts` (чистая функция + тест).

`isCellEmpty(value, cellWidget): boolean`:

- `null` / `undefined` / `""` → пусто;
- `REFERENCE_FIELD` / `OBJECT_FIELD` → пусто, если нет `id` (значение не объект с `id`);
- числовой `0`, `false` (checkbox), непустая строка → НЕ пусто.

### 3.2. Условие показа ошибки

Ячейка красится, если: `required && !readonly && isCellEmpty(value, cellWidget) && (touched || revealErrors)`.

Ошибка **производна от текущего значения ячейки** — гаснет сама на вводе. `updateCell` уже пишет в `localRows` (React-стейт в `useTableSync`) → таблица ре-рендерится на ввод, колонки мемоизированы по `node.children` → инпут не перемонтируется, фокус сохраняется. Дополнительной машинерии для «снять ошибку на вводе» не нужно.

### 3.3. `touched` (blur)

Локальный стейт внутри `TableCellEditor` (`useState`), ставится в `true` на `onCommit` (blur/Enter). React сохраняет стейт по позиции (row keyed by `rowId`, колонки стабильны) — при смене строки стейт корректно сбрасывается.

### 3.4. `revealErrors` (сабмит «Записать/Провести»)

Булев стейт на таблицу. Взводится в момент сабмита, красит все пустые обязательные ячейки, включая **полностью пустые новые строки** (эталон 1С).

Механизм — реестр-близнец существующего `pending-table-commits.ts`:

- Новый `src/features/sdui/lib/table-validation-registry.ts`: `registerRevealErrors(cb): symbol`, `unregisterRevealErrors(token)`, `revealAllTableErrors()`.
- Хук `src/features/sdui/lib/hooks/use-table-validation.ts`: держит `revealErrors` (useState), регистрирует `() => setRevealErrors(true)` в реестре (эффект по `node.binding`, как `registerPendingFlush`).
- `dispatch.ts`: в ветке `COMMAND` при `shouldFlush` (тот же момент, что `flushAllPendingTableCommits()`) дополнительно вызывает `revealAllTableErrors()`. Не блокирует, не влияет на flush.

Сброс: `revealErrors` не нужно явно гасить — пустые обязательные, будучи заполнены, перестают краситься индивидуально; после успешного сохранения ТЧ заполнена. На новом OPEN таблица перемонтируется (`tree reset`), стейт сбрасывается.

### 3.5. Подача ошибки

`TableCellEditor` при активной ошибке: красная рамка (`outline`/`border` цвета `error.main`) на контейнере ячейки + `title="Обязательное поле"` (i18n `field.required`, RU/KZ уже есть в `common.json:487`). Без helperText.

## 4. Разводка (одна ответственность на файл)

| Файл                                                                   | Роль                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `lib/utils/is-cell-empty.ts`                                           | чистая утилита пустоты + тест                                      |
| `lib/hooks/use-table-validation.ts`                                    | `revealErrors` + регистрация в реестре                             |
| `lib/table-validation-registry.ts`                                     | реестр reveal-колбэков (близнец pending-flush)                     |
| `ui/nodes/composite/required-mark.tsx`                                 | маркер «\*» в заголовке                                            |
| `lib/utils/build-column-defs.ts`                                       | прокидывает `required`/validation в header и cell                  |
| `ui/nodes/composite/table-cell-editor.tsx`                             | `touched`, рамка + tooltip                                         |
| `ui/nodes/composite/complex-editable-table.tsx` / `editable-table.tsx` | подключение `useTableValidation`, прокидывание в `buildColumnDefs` |

`useTableSync` (уже >300 строк) НЕ трогаем логикой валидации — валидация отдельным хуком.

## 5. Поток данных

1. OPEN формы → `props.required` в дереве → `nodeToTableColumnDef` кладёт `required` в дескриптор.
2. `buildColumnDefs`: header получает `RequiredMark` при `required && !readonly`; cell получает `required` + доступ к `revealErrors` (через `validationRef`, как `syncRef`).
3. Пользователь: blur пустой обязательной ячейки → `touched=true` → рамка + tooltip. Ввод значения → `isCellEmpty=false` → рамка гаснет.
4. «Записать/Провести» → `dispatch` COMMAND → `revealAllTableErrors()` → все таблицы `setRevealErrors(true)` → пустые обязательные (вкл. новые строки) краснеют. Сабмит уходит на сервер; при 422 показывается серверное сообщение (как сейчас).

## 6. Тесты

- `is-cell-empty`: null/""/0/false/строка/ref-с-id/ref-без-id/object-field.
- `required-mark` / header: матрица `required × readonly` (маркер только при `required && !readonly`); VERTICAL-подколонки; горизонтальная группа без маркера.
- `table-cell-editor`: пусто + touched → рамка+tooltip; ввод → гаснет; readonly required → без рамки и без «\*»; `revealErrors` → пустая новая строка красится без blur.
- `table-validation-registry`: register/unregister/revealAll.

## 7. Границы

- Не блокируем сабмит; не дублируем серверные правила условной обязательности.
- Не трогаем легаси и не-табличные ноды.
- Серверная адресация ошибки до ячейки — отдельный раунд (расширение `ValidationMessage`), вне этого тикета.
