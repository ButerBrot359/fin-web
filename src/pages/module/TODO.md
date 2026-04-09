# Module Page — TODO

## Поиск

- `ModuleToolbar` имеет `SearchInput` со стейтом `search` — но он **никуда не подключён**
- Нужно: поднять стейт в `ModulePage`, прокинуть в `ModuleNavList`, фильтровать элементы через `useMemo` по `getLocalizedName`

## Кнопка настроек

- Кнопка ⚙️ в `ModuleToolbar` рендерится, но не имеет обработчика
- Нужно: определить что открывает (боковая панель? модалка?) и подключить

## Избранное

- `FavoriteButton` использует локальный `useState` — состояние сбрасывается при навигации
- Нужно: персистить через API или `localStorage`

## `getLocalizedName` — миграция остальных файлов

- Утилита создана в `src/shared/lib/utils/get-localized-name.ts`
- Паттерн `i18n.language === 'kz' ? nameKz : nameRu` остался в ~13 файлах:
  - `src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx`
  - `src/features/dict-sidebar/ui/dict-sidebar-form-view.tsx`
  - `src/features/dict-sidebar/ui/dict-sidebar-drawer.tsx`
  - `src/shared/ui/form-fields/dict-field.tsx`
  - `src/entities/document-type/lib/hooks/use-document-type.ts`
  - `src/pages/documents/document-list/lib/hooks/use-document-columns.tsx`
  - и др.
- Отдельный рефакторинг-PR
