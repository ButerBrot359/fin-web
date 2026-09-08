# Ревью проекта fin-web: сильные и слабые стороны

**Дата:** 2026-09-08
**Метод:** пять параллельных ревью-срезов (архитектура/FSD, SDUI, легаси, shared/API, тесты/инфраструктура) + исчерпывающая скриптовая проверка правил код-стайла по всей кодовой базе.

**Охват:** все механические проверки (лимит строк, barrel'ы, кириллица в коде, импорты, хуки) прогнаны по **всем** файлам `src/` скриптами. Чтение кода — полное для горячих зон (SDUI-ядро: dispatch/effects/patch-applier/сторы/таблицы; shared/api; конфиги; CI) и выборочное для остального (~954 файла, ~95k строк — построчно прочитано не всё, но каждая зона покрыта грепами по всему объёму + чтением ключевых файлов).

---

## 1. Общий вердикт

Проект в заметно лучшем состоянии, чем типичная кодовая база при такой скорости разработки (1294 коммита за 3 месяца). Ядро (SDUI) спроектировано и оттестировано на высоком уровне, типовая дисциплина почти эталонная. Главные риски — **не в коде, а в инфраструктуре**: CI не гоняет ни тесты, ни typecheck, и секрет утекает в Docker build-args.

---

## 2. Сильные стороны

### 2.1 SDUI-ядро — лучшая часть кодовой базы

- Контрактная модель: закрытые юнионы `NodeType`/`EffectType`/`PatchOp`/`ActionType` (`src/features/sdui/types/node-types.ts`), реестр из 37 нод (`lib/component-registry.ts`), единая точка диспатча (`ui/node-renderer.tsx`). Новая нода = изменение в 3 местах, новый эффект = 3 места.
- Обработка гонок сделана всерьёз: in-flight-guard по `formSessionId` (`lib/dispatch.ts:70-77`), сериализованная очередь табель-матрицы (`tabel-matrix-queue.ts`), drain-логика `use-table-sync.ts:264` с отказом от сохранения при частичных данных. Всё покрыто тестами.
- Патчи к дереву полностью иммутабельны (`patch-applier.ts`), на wire-границе — Zod-валидация (`validation.ts`), типизированные ошибки транспорта (`api/view-transport.ts`).
- Полная таксономия ошибок в dispatch: 422 → highlight-патчи, конфликт → retry/reopen, OPEN 404/422 → колбэки, фолбэк — тост.
- **Багов в мутациях, гонках и промисах не найдено** — самые опасные зоны оказались самыми аккуратно сделанными.

### 2.2 Типовая дисциплина

- **Ноль `: any` и ноль `@ts-ignore`/`@ts-expect-error` во всём продакшн-коде, включая легаси.** Вместо `any` — `unknown` с сужением (203 вхождения в легаси).
- `strict: true` + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`; ESLint `strictTypeChecked` + `stylisticTypeChecked` с type-aware линтингом.
- В SDUI всего 5 as-кастов, все — обоснованные сужения на границах доверия.

### 2.3 Изоляция SDUI/легаси — образцовая

- Ни одного прямого импорта из SDUI в легаси-зоны (проверено грепом по всем легаси-путям).
- Три gateway-моста (`reference-picker-gateway.ts`, `report-result-gateway.ts`, `workspace-tab-gateway.ts`) подключаются исключительно в `src/app/App.tsx` — ровно по предписанию CLAUDE.md.

### 2.4 Тесты — много и осмысленные

- 228 тест-файлов, 163 — на SDUI. Ядро (dispatch 1111 строк тестов, effects, patch-applier, все сторы, build-column-defs 580) покрыто плотно.
- Тесты проверяют контракты (`toHaveBeenCalledWith` ×110), есть parity-тесты рендеринга таблиц, богатые комментарии о намерениях.

### 2.5 Инженерия в деталях

- Auth-контур: single-flight refresh (`refresh-session.ts`), разрыв рекурсии 401→refresh→401 через отдельный инстанс, `_authRetry`-guard, событийная развязка стора (FSD-чисто).
- Самописный xlsx-генератор без уязвимых зависимостей (`shared/lib/xlsx/write-xlsx.ts`): ZIP+CRC32, XML-escape, автоширина с поправкой на кириллицу.
- i18n: ru/kk синхронны (по 906 строк), generic-компоненты принимают переведённые строки пропами.
- Сторы zustand: правильный `partialize` в persist (`use-workspace-tabs-store.ts`), `useShallow`-селекторы, иммутабельные обновления.
- Документация «почему» в коде — плотная и полезная (auth.types.ts, api-error.ts, dispatch.ts).

---

## 3. Слабые стороны (по серьёзности)

### 🔴 Критично — инфраструктура

**W-1. CI не гоняет ни тесты, ни линт, ни `tsc -b`.**
`.github/workflows/deploy.yml` и `deploy-demo.yml` только собирают Docker и деплоят в K8s. Push в `main` уходит в прод-сборку без единой проверки. Pre-commit линтит только staged-файлы → 228 тестов и строгий typecheck **нигде не гейтят автоматически**.

**W-2. `ANTHROPIC_API_KEY` как Docker build-arg** (`deploy.yml:55`, `deploy-demo.yml:59`).
Build-args сохраняются в истории слоёв образа в ghcr — ключ доступен любому, кто вытянет образ. Нужен BuildKit secret mount.

### 🔴 Высоко — архитектура

**W-3. Восходящие импорты `features → pages`.**
`report-result-view` почти целиком зависит от `@/pages/reports/report-list/types/report` (9+ точек: `tree-table.tsx:19`, `form-view.tsx:9`, `ledger-table.tsx:15`, …), `report-settings` — 2 точки, `dict-sidebar-form-view.tsx:11,19` → внутренности страниц. Типы `report` должны жить в `entities`/`shared`.

**W-4. Системный обход публичных API слайсов (deep imports).**
Импорты во внутренности `workspace-tabs` (`fresh-form-instance-registry`, `form-instance-id`, `use-form-cache-store` — 5+ точек из sdui и pages), `dict-sidebar/{api,lib}` (из pages/dictionaries), `auth/lib/hooks` (из support-call), `table-filter/lib/hooks` (из sdui, при этом рядом тот же хук берётся через barrel — непоследовательно).

**W-5. `eslint-plugin-import` установлен, но не подключён.**
FSD-границы (направление слоёв, запрет deep imports, циклы) ничем не защищены автоматически — все нарушения W-3/W-4 накопились именно поэтому. Есть цикл `dict-sidebar ⇄ form-renderer` (оба легаси) и `shared → entities` (`enum-field.tsx:6`, `format-cell-value.ts:1`).

**W-6. `api.ts:84` бросает сырое тело ответа** (`throw error.response?.data`) — наверх летит `unknown`/`undefined`, каждый потребитель угадывает форму. Плюс две несогласованные модели ошибки (`ApiErrorResponse` в `api.types.ts:33` vs `ApiErrorBody` в `auth.types.ts:78`). Транспортные ошибки уже типизированы — довести до единого класса.

### 🟡 Средне

**W-7. Дыры в тестах на критичных утилитах:**

- `shared/lib/xlsx/write-xlsx.ts` — 626 строк байтовой логики (CRC32, ZIP, XML-escape) **без единого теста**; регрессия молча ломает открытие в Excel.
- `shared/lib/filter/` (сериализация URL/API) и `shared/lib/table-export/` — без тестов.
- SDUI: `use-hydrate-node.ts` (ядро deferred-загрузки, SCRUM-384), `use-tabel-matrix-actions.ts`, `use-session-heartbeat.ts`, production-calendar-подсистема — не покрыты.

**W-8. Хрупкая тестовая инфраструктура:**

- Нет `setupFiles` с авто-`cleanup` (vitest `globals: false`) — 13 рендер-файлов без `cleanup` сломаются при добавлении второго теста.
- Нет `@testing-library/jest-dom`, `fireEvent` вместо `userEvent` (58 файлов), нет общего render-хелпера с провайдерами.

**W-9. Нет единого источника дизайн-токенов.** `#2a75f4` и остальная палитра захардкожены трижды: `tailwind.config.ts:51`, `app/theme/theme.ts:8` (+десятки inline), `show-toast.tsx:8,15,74`. Смена бренд-цвета = правки в 3+ файлах. (Частично закрывается веткой SCRUM-398 design-system.)

**W-10. Ослаблены type-safety правила там, где нужнее всего:** `no-unsafe-assignment`/`no-unsafe-call` выключены (`eslint.config.js:50-51`) — при том что SDUI работает с динамическим JSON от бэкенда. `noUncheckedIndexedAccess` не включён.

**W-11. Легаси (~22% кода, ~21k строк):** копипаст-семейство трёх реестров (API-слой `accounting`/`accumulation`-register **идентичен байт-в-байт** — правка = ×3 работы и риск рассинхрона), god-компоненты без тестов с подавленным линтером хуков (`report-page.tsx` 1132 строки, 30 хуков, 2×`eslint-disable set-state-in-effect`; `table-cell-renderer.tsx` 898). Вердикт: заморозить, рефакторинг экономически не оправдан; при багфиксе в реестрах проверять все три копии.

**W-12. Латентные ловушки в SDUI-сторах:** `confirm-store.ts:20-23` и `unsaved-changes-store` при повторном `ask()` молча теряют первый промис — безопасно только благодаря инварианту эксклюзивности в `effect-handler.ts:209` (гарантия живёт в чужом файле). Dup-panelId-защита `panel-store.ts:70-78` работает только в DEV.

**W-13. `form-configs-api.ts`:** `post` не передаёт `data` (`:29`), у инстанса нет timeout — расхождение поведения с основным клиентом.

### 🟢 Низко

- A11y: `show-toast.tsx:97` — `<span onClick>` вместо кнопки, нет `aria-live`; `warning` = цвет `error`, `info` = `success`; крестики без `aria-label` (`confirm-dialog.tsx:52`, `favorite-button.tsx:31`).
- `favorite-button.tsx:21` — состояние только локальное (`useState(false)`), не отражает сервер. Похоже на заглушку.
- README — дефолтный шаблон Vite, не ведёт к реальной документации (`CLAUDE.md`, `docs/`).
- Нет `.env.example`; `docs/.DS_Store` в VCS; образ деплоится по тегу `latest` (нет трассируемости отката).
- Карта границ CLAUDE.md устарела: `universal-domain-entry` уже на SDUI (SCRUM-388), `pages/reportalt`, `report-result-view`, `report-settings`, `support-call`, `treasury-export`, `background-tasks`, `auth` не отнесены ни к одной зоне.
- Дублирование bridge-логики `closeDialog`/`replaceDialog` между `dispatch.ts:108-134` и `use-sdui-effects.ts:29-52`.

---

## 4. Проверка код-стайла (исчерпывающая, по всем файлам)

### 4.1 Лимит строк («новый код >300 строк обязан быть разбит; легаси не рефакторим»)

Всего не-тестовых файлов >300 строк: **44**. Из них легаси (освобождены от лимита): **18**. **Нарушений в не-легаси коде: 26.**

SDUI (14):

| Файл                                                                      | Строк |
| ------------------------------------------------------------------------- | ----- |
| `features/sdui/ui/nodes/composite/complex-editable-table.tsx`             | 937   |
| `features/sdui/ui/nodes/composite/editable-table.tsx`                     | 547   |
| `features/sdui/lib/utils/build-column-defs.ts`                            | 497   |
| `features/sdui/lib/hooks/use-table-sync.ts`                               | 491   |
| `features/sdui/ui/nodes/composite/list-node.tsx`                          | 408   |
| `features/sdui/lib/dispatch.ts`                                           | 373   |
| `features/sdui/ui/nodes/calendar/production/production-calendar-node.tsx` | 340   |
| `features/sdui/ui/nodes/composite/reference-cell-editor.tsx`              | 339   |
| `features/sdui/ui/nodes/composite/read-only-table.tsx`                    | 338   |
| `features/sdui/ui/nodes/composite/table-cell-editor.tsx`                  | 336   |
| `features/sdui/ui/nodes/composite/selection-list-table.tsx`               | 314   |
| `features/sdui/ui/nodes/fields/reference-field-node.tsx`                  | 312   |
| `features/sdui/ui/nodes/composite/accounting-postings-block.tsx`          | 304   |
| `features/sdui/ui/nodes/composite/tabel/use-tabel-matrix-actions.ts`      | 302   |

Общий код (3): `shared/lib/xlsx/write-xlsx.ts` (626), `shared/ui/inputs/autocomplete-input.tsx` (358), `features/table-filter/ui/value-controls.tsx` (350).

Зоны вне карты границ (9): `report-result-view` — `tree-table.tsx` (921), `form-view.tsx` (570), `ledger-table.tsx` (436); `pages/reportalt` — `reportalt-page.tsx` (480), `types/reportalt.ts` (360), `reportalt-param-field.tsx` (359); `widgets/eav-entity-table/ui/eav-entity-table.tsx` (407); `features/support-call/ui/call-room-dialog.tsx` (398); `pages/sdui-catch-all` — в норме.

Основной долг сконцентрирован в табличной подсистеме SDUI.

### 4.2 Barrel-экспорты («только на уровне слайсов, внутри сегментов — нет»)

Каждый слайс `features/*`, `entities/*`, `widgets/*`, `pages/*` имеет ровно один `index.ts` — ✅.
**Нарушения — 7 внутрисегментных barrel'ов, все в `shared/`:** `shared/ui/buttons/`, `shared/ui/form-fields/`, `shared/ui/shimmer-block/`, `shared/ui/inputs/`, `shared/lib/eav/` (легаси), `shared/lib/table-export/`, `shared/lib/dictionary-entry/` (легаси). При этом другие `shared/ui`-компоненты импортируются полным путём — политика непоследовательна, нужно зафиксировать одно правило.

### 4.3 i18n («не хардкодить строки в JSX»)

Кириллица в коде (комментарии вырезаны): **39 файлов**, из них не-легаси — 22. Разбор не-легаси:

- Большинство — технические `console.warn/error` по-русски (`effect-handler.ts:143,154`, `subordination-tree.tsx:57`, `treasury-export-page.tsx:71`, `api-error.ts` — последнее задокументировано как осознанное) и матчинг бэкендных лейблов (`nowrap-columns.ts`). Не пользовательский текст — низкая серьёзность, но для консистентности лучше перевести на английский в логах.
- **Реальные нарушения (пользовательский текст в JSX):** `features/sdui/ui/unknown-node.tsx:16` («Тип … не поддерживается…»), `widgets/top-bar/ui/top-bar.tsx:14-15,55` (`'РУС'/'ҚАЗ'` — спорно, это самоназвания языков), `features/report-result-view/ui/report-signature.tsx:11` (фолбэк `'подпись'`), + точечные строки в `form-view.tsx`, `report-cell.tsx`, `format-title.ts`, `document-redirect.tsx`, `use-ready-reports-section.ts`, `write-xlsx.ts`. Итого ~8-10 файлов с настоящим хардкодом вне легаси.
- В легаси — ~17 файлов (заморожены, чинить только если блокирует релиз).

### 4.4 useMemo/useCallback («только при явной перф-причине»)

`useCallback`: 42 вызова в 22 файлах; `useMemo`: 116 в 76 файлах. Концентрация — в таблицах/виртуализации/колонках (`use-virtual-table-rows`, `use-sdui-column-sizing`, `use-auto-fit-columns`, column-defs для TanStack Table), где мемоизация обоснована требованиями библиотек. Явного злоупотребления не выявлено; аутлаер — `support-call/model/use-remote-control.ts` (6 useCallback), стоит глянуть при следующем заходе в фичу.

### 4.5 Прочее

- Алиас `@/*` используется, но есть 738 относительных `../`-импортов (253 из них глубиной ≥3). Внутри слайса относительные допустимы; глубокие (`../../..`) обычно пересекают сегменты — кандидаты на `@/`.
- Правило `<Typography>` для текстов исчерпывающе не проверялось (не автоматизируется грепом надёжно); выборочно в SDUI-нодах текст часто в `<span>`/`<div>` с Tailwind-классами — стоит уточнить у команды, распространяется ли правило на SDUI-ноды.

---

## 5. Приоритетный план исправлений

| #   | Действие                                                                                                        | Закрывает                       | Оценка                                                |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| 1   | CI-гейт: `npm test` + `tsc -b` + `eslint .` перед деплоем (+ PR-workflow)                                       | W-1                             | ~полдня                                               |
| 2   | `ANTHROPIC_API_KEY` → BuildKit secret mount                                                                     | W-2                             | ~час                                                  |
| 3   | Включить `eslint-plugin-import`: `no-restricted-paths` (слои FSD), `no-cycle`, запрет deep imports              | W-5, останавливает рост W-3/W-4 | ~день с фиксом текущих нарушений или warn-режим сразу |
| 4   | Тесты на `write-xlsx.ts` и `shared/lib/filter/`                                                                 | W-7                             | 1-2 дня                                               |
| 5   | vitest `setupFiles` с авто-cleanup + `jest-dom` + общий render-хелпер                                           | W-8                             | ~полдня                                               |
| 6   | Поднять типы `report` из `pages/reports` в `entities`/`shared`, починить `features → pages`                     | W-3                             | 1-2 дня                                               |
| 7   | Единый класс ошибки API вместо `throw error.response?.data`                                                     | W-6                             | ~день                                                 |
| 8   | Актуализировать карту границ CLAUDE.md (universal-domain-entry, reportalt, report-result-view, support-call, …) | документация                    | ~час                                                  |
| 9   | Декомпозиция `complex-editable-table.tsx` (937) и топ-5 SDUI-файлов сверх лимита                                | §4.1                            | по мере захода в файлы                                |
| 10  | i18n-хвосты: `unknown-node.tsx`, `report-signature.tsx` и ~8 файлов из §4.3                                     | §4.3                            | ~полдня                                               |

Пункты 1-3 — системные: они дешёвые и предотвращают появление новых долгов автоматически. Остальное — по мере работы в соответствующих зонах.
