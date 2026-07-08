# fin-web

CRM система с бухучётом и динамическим рендерингом UI по JSON-схеме от бэкенда.

## Стек

- React 19 + TypeScript 5.9 + Vite 7
- TailwindCSS
- Zustand (state)
- TanStack Query (server state)
- TanStack Table (таблицы)
- React Hook Form + Zod (формы/валидация)
- date-fns (даты)

## Структура (FSD)

```
src/
├── app/                  # Точка входа, провайдеры
│   ├── providers/        # QueryProvider и др.
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── pages/                # Страницы
├── widgets/              # Композитные блоки (Header, Sidebar)
├── features/             # Бизнес-фичи
├── entities/             # Бизнес-сущности
├── shared/               # Переиспользуемое
│   ├── api/              # HTTP клиент
│   ├── lib/              # Утилиты (date.ts)
│   ├── ui/               # UI компоненты
│   ├── types/            # Общие типы
│   └── config/           # Конфигурация
└── assets/               # Статика
```

### Структура внутри FSD-слайса

```
features/example/
├── index.ts              # Публичный API слайса (единственный barrel-экспорт)
├── ui/                   # React-компоненты
├── lib/
│   ├── hooks/            # Хуки
│   ├── consts/           # Константы
│   └── utils/            # Утилиты
├── types/                # Типы
└── api/                  # Запросы к бэкенду
```

## Архитектура: SDUI vs Легаси

В проекте два мира. **Легаси** — статические страницы и form-renderer, будет удалён после миграции. **SDUI** — новая архитектура: бэкенд присылает дерево нод (`POST /api/view`), фронт рендерит его без бизнес-логики.

### Граница

| Зона | Пути |
|---|---|
| **SDUI** | `src/features/sdui/`, `src/pages/documents/documents-entry/ui/sdui-document-page.tsx`, `src/pages/documents/document-redirect/` |
| **Легаси** | `src/features/form-renderer/`, `src/features/generate-form-config/`, `src/features/tarifikatsiya/`, `src/features/dict-sidebar/`, `src/pages/documents/documents-entry/ui/legacy-document-entry-page.tsx`, `src/pages/documents/document-list/`, `src/pages/documents/document-movements/`, `src/pages/dictionaries/`, `src/pages/account-plan/`, `src/pages/account-card/`, `src/pages/accounting-register/`, `src/pages/accumulation-register/`, `src/pages/information-register/`, `src/pages/financing-plan-upload/`, `src/pages/osv-report/`, `src/pages/reports/`, `src/pages/universal-domain/`, `src/entities/form-config/`, `src/shared/lib/eav/`, `src/shared/lib/filter/`, `src/shared/lib/dictionary-entry/` |
| **Общее** | `src/shared/ui/`, `src/shared/api/`, `src/shared/types/`, `src/entities/*` (кроме form-config), `src/features/workspace-tabs/`, `src/features/table-filter/`, `src/features/navigation-buttons/`, `src/features/favorite-button/` |

**Точка ветвления:** `src/pages/documents/documents-entry/ui/document-entry-page.tsx` — флаг `newView` из `useDocumentType`.

### Правила изоляции

- Прямые импорты между SDUI и легаси **запрещены в обе стороны**.
- Единственный допустимый мост — gateway-паттерн (образец: `src/features/sdui/lib/reference-picker-gateway.ts`): SDUI владеет интерфейсом, реализация подключается на уровне `app/`. Новый gateway — только с явного согласования с пользователем.
- Таска по легаси → не трогать SDUI и не рефакторить легаси под новые стандарты (минимальные изменения).
- Таска по SDUI → не трогать легаси.
- Изменения в общем коде (`shared/`, общие features) не должны ломать ни один из миров.

### Документация SDUI

- Авторитетная спека архитектуры: `docs/superpowers/specs/2026-07-02-sdui-course-audit.md`
- Карта границы легаси/SDUI: `docs/superpowers/specs/2026-07-02-sdui-code-review.md`

## Правила кода

- Для текстов всегда использовать `useTranslation` из `react-i18next` и ключи из `common.json`. Не хардкодить строки в JSX.
- Для текстовых элементов использовать `<Typography>` из `@mui/material`.
- Один файл — одна ответственность, максимальная декомпозиция.
- Новый код: цель ~200 строк на файл; файл >300 строк обязан быть разбит.
- Легаси-файлы под лимит строк не рефакторим.

## Проверки

НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build` после каждого изменения. Запускать только если пользователь явно попросит.

## Команды

```bash
npm run dev       # Dev сервер
npm run build     # Сборка
npm run lint      # ESLint
npm run format    # Prettier
```

## Git hooks (Husky)

- `pre-commit`: lint-staged (ESLint + Prettier)
- `commit-msg`: проверка формата `feat|fix|add|refactor: описание`

## FSD экспорты

Barrel-экспорты (`index.ts`) делать **только на уровне FSD-сегментов** (слайсов), например `src/features/sidebar/index.ts`. Внутри сегмента (model/, ui/, lib/) barrel-файлы НЕ создавать — импортировать напрямую из конкретных файлов.

## Алиасы

`@/*` → `src/*`

## API клиент

`@/shared/api` — базовый HTTP клиент с методами get/post/put/delete.

## API документация

- [Dictionary API (Универсальный справочник)](docs/api/dictionary-api.md) — CRUD типов справочников, записей, атрибутов
- [Enums API (Перечисления)](docs/api/enums-api.md) — CRUD перечислений и их значений
- [Document Types API (Типы документов)](docs/api/document-types-api.md) — метаданные типов документов, атрибуты, данные форм
- [Document Entries API (Записи документов)](docs/api/document-entries-api.md) — CRUD записей документов, печатные формы (PDF)
- [Settings API (Настройки)](docs/api/settings-api.md) — настройки модулей
- OpenAPI specs: `docs/api/*.openapi.json`
- **Base URL:** `http://92.38.49.213:31880`
