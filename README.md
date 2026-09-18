# fin-web

CRM-система с бухучётом и динамическим рендерингом UI по JSON-схеме от бэкенда (SDUI).

React 19 · TypeScript 5.9 · Vite 7 · TailwindCSS · Zustand · TanStack Query/Table · React Hook Form + Zod

## Быстрый старт

```bash
npm ci
cp .env.example .env   # заполнить значения
npm run dev
```

## Команды

| Команда                           | Что делает                    |
| --------------------------------- | ----------------------------- |
| `npm run dev`                     | Dev-сервер                    |
| `npm run build`                   | Прод-сборка (tsc -b + vite)   |
| `npm test`                        | Unit-тесты (vitest)           |
| `npm run test:visual`             | Визуальные тесты (playwright) |
| `npm run lint` / `npm run format` | ESLint / Prettier             |

## Документация

- **[CLAUDE.md](CLAUDE.md)** — правила кода, структура FSD, граница SDUI/легаси, команды
- **[docs/design-rules.md](docs/design-rules.md)** — правила дизайна (токены, отступы, кнопки, иконки)
- **[docs/api/](docs/api/)** — документация API бэкенда (+ OpenAPI-спеки)
- **[docs/superpowers/specs/](docs/superpowers/specs/)** — архитектурные спеки; ключевые:
  - `2026-07-02-sdui-course-audit.md` — авторитетная спека SDUI-архитектуры
  - `2026-07-02-sdui-code-review.md` — карта границы легаси/SDUI
  - `2026-09-04-sdui-design-constructor-spec.md` — конструктор дизайна

## Архитектура в двух словах

Два мира: **SDUI** (бэкенд присылает дерево нод через `POST /api/view`, фронт рендерит без бизнес-логики) и **легаси** (статические страницы, удаляется по мере миграции). Прямые импорты между мирами запрещены; мост — только gateway-паттерн через `app/`. Подробности и таблица зон — в [CLAUDE.md](CLAUDE.md).

`form-configs-server/` — вспомогательный Node-сервер (генерация форм-конфигов, ИИ-фичи); `ANTHROPIC_API_KEY` он получает в рантайме из окружения (в k8s — секрет `fin-web-secret`), ключ не запекается в образ.
