# Иерархическая навигация в справочниках

## Обзор

Добавить иерархическую drill-down навигацию в таблицу справочников. При `isHierarchical: true` в типе справочника записи отображаются с иконками папок/элементов. Клик по папке "проваливает" внутрь — показывает только содержимое этой папки. Цепочка открытых папок-предков отображается прямо в таблице с отступами, позволяя вернуться на любой уровень.

## Ссылка на поведение

Модель навигации повторяет 1С: Предприятие — иерархические справочники с drill-down в папки.

## API

Используются существующие эндпоинты, новых не требуется.

### Получение типа справочника

`GET /api/universaldomain-types/{domain}/{code}`

В ответе поле `isHierarchical: boolean` в атрибутах. Если `true` — включаем иерархический режим таблицы.

### Получение записей с фильтром по родителю

`GET /api/universaldomain-entries/{domain}/{code}/paged?page=0&size=25&parent={parentId}`

- Без `parent` — возвращает записи корневого уровня
- С `parent=ID` — возвращает дочерние записи/папки указанной группы
- В ответе у каждой записи есть поле `isGroup: boolean`

### Создание группы

`POST /api/universaldomain-entries/{domain}/{code}`

Тело запроса:
```json
{
  "nameRu": "Название группы",
  "nameKz": "Название на казахском",
  "isGroup": true,
  "parentId": 50472
}
```

- `isGroup: true` — создаёт группу (папку)
- `parentId` — ID родительской группы (опционально, без него — в корень)

## Типы

### Расширение DictEntry

Добавить `isGroup: boolean` в тип `DictEntry`. Поле приходит в ответе `/paged`.

### Новый тип OpenFolder

```ts
type OpenFolder = { id: number; name: string }
```

Используется в стеке навигации.

## Стейт

### useFolderNavigationStore (Zustand, in-memory)

Хранит стек открытых папок для каждой вкладки. Персистится в памяти (не в sessionStorage) — переживает переключение вкладок, но не перезагрузку страницы (при F5 возвращаемся в корень).

```ts
interface FolderNavigationStore {
  cache: Record<string, OpenFolder[]>  // ключ = location.pathname
  setFolders(path: string, folders: OpenFolder[]): void
  getFolders(path: string): OpenFolder[] | undefined
  removeFolders(path: string): void
}
```

### Хук useFolderNavigation

Используется в `dictionary-page.tsx`. Читает/пишет в `useFolderNavigationStore`, предоставляет:

```ts
interface UseFolderNavigation {
  openFolders: OpenFolder[]           // текущий стек папок
  currentParentId: number | undefined // ID последней папки или undefined для корня
  openFolder(folder: OpenFolder): void   // пушит в стек
  closeFolder(folderId: number): void    // обрезает стек до этого элемента (не включая)
}
```

- `openFolder` — добавляет папку в конец стека
- `closeFolder(id)` — находит папку в стеке и обрезает всё начиная с неё (возврат на уровень родителя этой папки)

## Рендеринг таблицы

### Условная активация

Все изменения рендеринга активируются **только** при `isHierarchical: true`. Без этого флага таблица работает как сейчас — плоский список без иконок.

### Структура отображения

Таблица рендерит два блока последовательно:

**1. Строки-предки** (из `openFolders`):
- Каждая открытая папка — отдельная строка в таблице
- Иконка `arrow-down.svg` (▼) + `folder-icon.svg` + имя папки
- Отступ слева: `уровень * 24px` (0px для первой папки, 24px для второй и т.д.)
- Клик по строке-предку → `closeFolder(id)` — сворачиваем до этого уровня

**2. Дочерние элементы** (из ответа API `/paged?parent=currentParentId`):
- Сначала папки (`isGroup: true`), потом записи (`isGroup: false`)
- Папки: иконка `arrow-down.svg` повёрнутая на -90° (▶) + `folder-icon.svg` + имя
- Записи: `list-element-icon.svg` + имя
- Отступ: `openFolders.length * 24px`

### Иконки

- Папка: `src/shared/assets/icons/folder-icon.svg`
- Запись: `src/shared/assets/icons/list-element-icon.svg`
- Стрелка: `src/shared/assets/icons/arrow-down.svg` (▼ для открытой папки, повёрнутая ▶ для закрытой)

### Колонки

Первая колонка (название) расширяется для отображения отступа + иконок + текста. Остальные колонки без изменений.

### Сортировка внутри уровня

Папки всегда отображаются сверху, записи ниже. Фронтенд разделяет ответ API на две группы по `isGroup` и конкатенирует: группы первыми.

## Взаимодействие

### Папки

| Действие | Результат |
|----------|-----------|
| Клик по стрелке ▶ / двойной клик по строке папки | `openFolder({id, name})` — проваливаемся внутрь |
| Клик по строке-предку (▼) | `closeFolder(id)` — возврат на уровень выше |

### Записи

| Действие | Результат |
|----------|-----------|
| Клик | Выделение строки (selected row) |
| Двойной клик | Переход к редактированию (как сейчас) |

### Что происходит при drill-down

1. `openFolder({id, name})` — пушим папку в стек
2. `currentParentId` обновляется → `queryKey` меняется → React Query запрашивает `/paged?parent=newId`
3. Таблица перерисовывается: строки-предки + новые дочерние элементы
4. Infinite scroll сбрасывается (новый запрос с page=0)

### Что происходит при сворачивании

1. `closeFolder(id)` — обрезаем стек до этой папки
2. `currentParentId` обновляется на родителя этой папки (или `undefined` для корня)
3. React Query запрашивает данные для нового уровня
4. Таблица перерисовывается с укороченной цепочкой предков

## Кнопка "Создать группу"

### Условие отображения

Кнопка появляется рядом с "Создать" только при `isHierarchical: true`.

### Модалка

При клике открывается модальное окно с двумя полями:
- "Наименование (рус.)" — `nameRu`, обязательное
- "Наименование (каз.)" — `nameKz`, необязательное

### Создание

При сабмите отправляется `POST /api/universaldomain-entries/{domain}/{code}`:
```json
{
  "nameRu": "...",
  "nameKz": "...",
  "isGroup": true,
  "parentId": currentParentId
}
```

`parentId` берётся из текущей позиции в стеке (последний элемент `openFolders`). Если в корне — `parentId` не передаётся.

После успешного создания:
- Закрываем модалку
- Инвалидируем query `['dict-entries', ...]` — новая папка появляется в списке

## Сохранение состояния при переключении вкладок

`useFolderNavigationStore` хранит стек папок в памяти с ключом `location.pathname`. При размонтировании страницы стек остаётся в сторе. При повторном монтировании (возврат на вкладку) — восстанавливаем стек и делаем запрос с нужным `parent`.

При перезагрузке страницы (F5) — стор очищается, пользователь возвращается в корень.

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/features/dict-sidebar/api/dict-sidebar-api.ts` | Добавить `isGroup` в тип `DictEntry` |
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-entries.ts` | Добавить `parent` параметр в запрос и queryKey |
| `src/pages/dictionaries/dictionary-list/ui/dictionary-page.tsx` | Подключить `useFolderNavigation`, кнопка "Создать группу", передать стейт в таблицу |
| `src/pages/dictionaries/dictionary-list/ui/dictionary-table.tsx` | Рендеринг строк-предков, иконки, отступы, обработка кликов по папкам |
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-columns.tsx` | Расширить первую колонку для иконок и отступов |
| `src/pages/dictionaries/dictionary-list/types/dictionary-table.ts` | Обновить типы пропсов таблицы |

## Новые файлы

| Файл | Назначение |
|------|-----------|
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation-store.ts` | Zustand стор для кэша стека папок |
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation.ts` | Хук навигации по папкам |
| `src/pages/dictionaries/dictionary-list/ui/create-group-modal.tsx` | Модалка создания группы |
