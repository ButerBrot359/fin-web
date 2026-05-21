# Кнопка "Отменить проведение" в списке документов

**Дата:** 2026-05-14

## Суть

Добавить кнопку "Отменить проведение" в тулбар списка документов. Кнопка вызывает `POST /api/document-entries/{id}/unpost` для выделенного документа. Эндпоинт идемпотентный — для не проведённого документа ничего не делает.

## API

Новая функция в `src/entities/document-entry/api/document-entry.ts`:

- `unpostDocumentEntry(id: number)` → `apiService.post({ url: '/api/document-entries/${id}/unpost' })`
- Экспортировать из barrel `src/entities/document-entry/index.ts`

## Тулбар

В `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx`:

- **Убрать** кнопку "Изменить выделенные..." (не реализована)
- **Добавить** на её место кнопку "Отменить проведение" (`Button variant="secondary"`)
- Disabled: когда `!selectedRowId`
- По клику: `useMutation` → `unpostDocumentEntry(selectedRowId)`
- На успех: `queryClient.invalidateQueries` по ключу записей таблицы + toast "Проведение отменено"
- На ошибку: toast "Ошибка отмены проведения"

## i18n

Новые ключи в обоих локалях:

**ru/common.json** — в секции `documentListToolbar`:
- `"unpost": "Отменить проведение"`
- `"unpostSuccess": "Проведение отменено"`
- `"unpostError": "Ошибка отмены проведения"`

**kz/common.json** — в секции `documentListToolbar`:
- `"unpost": "Өткізуді болдырмау"`
- `"unpostSuccess": "Өткізу болдырмалды"`
- `"unpostError": "Өткізуді болдырмау қатесі"`

## Что не меняется

- Выделение строк в таблице — без изменений
- Остальные кнопки тулбара — без изменений
- API для document-entries — существующие функции не трогаем
