# Frontend-handoff: кнопки «Показать все» / «Добавить» в SDUI-справочном поле

**Репозиторий:** `fin-web-main` (фронт)
**Задача:** в выпадающем списке справочного поля SDUI-формы показать футер с кнопками **«Показать все»** и **«Добавить»** — как это уже работает в легаси-рендерере форм.
**Бэкенд:** доработок НЕ требует (всё нужное уже отдаётся, см. §4).

---

## 1. Контекст

В SDUI-формах (например, документ «Заявка на регистрацию ГП Сделки») справочные поля рендерит компонент:

```
src/features/sdui/ui/nodes/fields/reference-field-node.tsx
```

Он использует `AutocompleteInput` (`src/shared/ui/inputs/autocomplete-input.tsx`), который **уже умеет** рисовать футер выпадашки с кнопками «Показать все»/«Добавить» — через пропсы `onShowAll` и `onAdd`. Сейчас SDUI-компонент эти пропсы **не передаёт**, поэтому футера нет.

В **легаси**-рендерере форм футер работает — см. эталон:

```
src/features/form-renderer/ui/field-node.tsx        (handleShowAll / handleAdd, строки ~156–212)
src/shared/ui/form-fields/dict-field.tsx            (как onShowAll/onAdd прокидываются в AutocompleteInput)
```

Нужно повторить этот паттерн в SDUI-компоненте.

---

## 2. Что должно получиться (acceptance criteria)

1. В выпадающем списке любого справочного поля SDUI-формы внизу появляется футер с двумя кнопками: **«Показать все»** и **«Добавить»** (лейблы из i18n — те же ключи, что использует `AutocompleteInput`: `dictSidebar.showAll`, `dictSidebar.add`).
2. **«Показать все»** → открывает боковую панель справочника (`DictSidebarDrawer`, уже смонтирован глобально в `src/app/App.tsx`) в режиме списка (`mode: 'list'`) для того же справочника, что и поле.
3. **«Добавить»** → открывает ту же панель в режиме создания (`mode: 'create'`).
4. После выбора/создания записи в панели её значение **подставляется в поле** и **уходит на сервер тем же путём, что и обычный выбор из выпадашки** (через server EVENT — см. §3, иначе значение не синкается и не сохранится).
5. Кнопки показываются только для редактируемого поля, у которого известен `targetTypeCode` (т.е. `!readonly && enabled && !!targetTypeCode`). Для readonly/disabled — не показываем.
6. Никаких изменений в бэкенде и в других компонентах не требуется.

---

## 3. Технические детали

### 3.1. Откуда берём `domain` и `targetTypeCode`

Они уже приходят в `node.props` (бэк их проставляет в SDUI-дереве):

```ts
const domain = (node.props?.domain as string | undefined) ?? 'DICTIONARY' // напр. 'DICTIONARY'
const targetTypeCode = node.props?.targetTypeCode as string | undefined // напр. 'Kontragenty'
```

Эти же значения используются для `push(...)` в dict-sidebar.

### 3.2. Открытие боковой панели

Стор: `useDictSidebarStore` из `@/features/dict-sidebar` (тот же, что зовёт легаси `field-node.tsx`). Панель глобально смонтирована в `App.tsx`, поэтому достаточно вызвать `push`:

```ts
import { useDictSidebarStore } from '@/features/dict-sidebar'

// «Показать все»
useDictSidebarStore.getState().push({
  mode: 'list',
  domain,
  typeCode: targetTypeCode, // string
  onSelect: applySelected, // см. 3.3
})

// «Добавить»
useDictSidebarStore.getState().push({
  mode: 'create',
  domain,
  typeCode: targetTypeCode,
  onSelect: applySelected,
})
```

Тип панели — `DictSidebarPanel` (`src/types/dict-sidebar.ts`): `{ mode, domain, typeCode, searchParams?, onSelect?, ... }`. Список/создание ходят в существующие `universaldomain`-эндпоинты бэка (через `dict-sidebar-api`) — ничего дополнительно настраивать не нужно.

### 3.3. Применение выбранной записи + синхронизация с сервером

ВАЖНО: в SDUI значение поля синхронизируется с бэком **только через server EVENT** (в COMMAND save фронт не шлёт state формы). Поэтому `onSelect` должен сделать ровно то же, что текущий `onChange` автокомплита — обновить view-state **и** отправить EVENT:

```ts
const applySelected = (opt: SelectOption | null) => {
  const newVal = opt ? fromSelectOption(opt) : null // fromSelectOption уже есть в файле: { id, presentation }
  if (node.binding) setValue(node.binding, newVal)
  fireServerEvent('change', newVal) // fireServerEvent уже есть в файле
}
```

(Текущий `onChange={(opt) => { ... }}` дублирует эту логику — можно заодно переиспользовать `applySelected`.)

`SelectOption`, который вернёт панель в `onSelect`, имеет поля `{ id, code, label, raw? }`; `fromSelectOption` берёт `id` и `label` (→ `presentation`).

### 3.4. Подключение к AutocompleteInput

```tsx
const canBrowse = !!targetTypeCode && !readonly && enabled

<AutocompleteInput
  /* ...существующие пропсы... */
  onShowAll={canBrowse ? openDictList : undefined}
  onAdd={canBrowse ? openDictCreate : undefined}
/>
```

`onShowAll`/`onAdd` у `AutocompleteInput` имеют сигнатуру `() => void`; футер рисуется автоматически, если передан хотя бы один колбэк.

### 3.5. Про фильтр зависимых справочников (`node.props.filter`) — опционально

У поля может быть `filter` (напр. «Счёт контрагента» отфильтрован по владельцу). Семантически «Показать все» = показать ВСЕ записи типа, поэтому в `push` фильтр можно **не** передавать (показываем весь справочник). Если потребуется ограничить список по фильтру — `DictSidebarPanel.searchParams` ожидает формат `Record<string,string>` в конвенции `af` (как в легаси `field-node.tsx`: `{ af: 'AttrCode:id' }`), а не плоский `{ AttrCode: id }`, который шлётся в inline-выпадашку. На текущий момент фильтр для футера НЕ требуется — оставляем «показать все».

---

## 4. Чек-лист

- [ ] Импортирован `useDictSidebarStore` из `@/features/dict-sidebar` (как в `form-renderer/ui/field-node.tsx`; если есть eslint-правила границ фич — там этот импорт уже разрешён).
- [ ] Добавлены `applySelected`, `openDictList`, `openDictCreate`.
- [ ] В `AutocompleteInput` переданы `onShowAll`/`onAdd` под условием `canBrowse`.
- [ ] Выбор записи в панели подставляется в поле и шлёт server EVENT (значение сохраняется при save).
- [ ] `npm run build` (tsc) и `npm run lint` зелёные.

## 5. Затрагиваемые файлы

- Меняем: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` (единственный файл).
- Эталон (только смотреть): `src/features/form-renderer/ui/field-node.tsx`, `src/shared/ui/form-fields/dict-field.tsx`, `src/shared/ui/inputs/autocomplete-input.tsx`.
- Бэкенд: без изменений.
