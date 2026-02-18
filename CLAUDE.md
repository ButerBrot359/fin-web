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
- OpenAPI specs: `docs/api/*.openapi.json`
- **Base URL:** `http://92.38.49.213:31880`
