# Профайлинг-аудит проекта fin-web

**Дата:** 2026-09-18 · **Ветка:** `profiling/full-audit` (от `dev`)
**Метод:** механические проверки скриптами по всему `src/` + три параллельных ревью-среза (конструктор дизайна; аналитика/ИИ/уведомления; верификация всех W-пунктов ревью 2026-09-08) + полный прогон тестов и прод-сборки.
**Базовая линия:** [2026-09-08-project-review.md](2026-09-08-project-review.md). С тех пор в dev влито ~17.7k строк (конструктор дизайна Ф1-Ф5, админка, аналитика, ИИ-помощники, центр уведомлений).

---

## 1. Общий вердикт

Проект здоров в коде и болен в инфраструктуре — диагноз десятидневной давности не изменился, а разрыв вырос. Новый код (конструктор + аналитика) написан на том же высоком уровне, что и SDUI-ядро: FSD-границы чистые, секретов нет, i18n почти безупречен, безопасность ИИ-ключей выстроена образцово. Но из плана исправлений прошлого ревью реально закрыт **один пункт из десяти** (W-9, дизайн-токены), а два системных красных — CI без тестов и ключ в build-args — стоят нетронутыми, при том что кода и тестов, которые CI мог бы защищать, стало на 17k строк и 37 тест-файлов больше.

**Здоровье на сегодня:** 1749 тестов в 265 файлах — все зелёные (67 с); `npm run build` (tsc -b + vite) — зелёный (12 с); секретов в репо нет; ru/kk-локали синхронны (по 1332 строки); `console.log` в проде — 0; TODO — 5.

---

## 2. Статус пунктов ревью 2026-09-08

| Пункт                                 | Статус              | Кратко                                                                                                                                                                                                         |
| ------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-1 CI без тестов/typecheck           | ❌ открыт           | `deploy.yml`/`deploy-demo.yml` только собирают и деплоят                                                                                                                                                       |
| W-2 `ANTHROPIC_API_KEY` build-arg'ом  | ❌ открыт           | `deploy.yml:55`, `deploy-demo.yml:59` — ключ в истории слоёв ghcr                                                                                                                                              |
| W-3 импорты features → pages          | ❌ открыт           | 15 точек, все прежние живы (`tree-table.tsx:20`, `form-view.tsx:11`, …)                                                                                                                                        |
| W-4 deep imports мимо barrel          | ❌ открыт           | workspace-tabs, dict-sidebar, auth, table-filter — все точки на месте                                                                                                                                          |
| W-5 eslint-plugin-import не подключён | ❌ открыт           | в `eslint.config.js` только typescript-eslint                                                                                                                                                                  |
| W-6 сырой throw в api.ts              | 🟡 частично         | появились `ApiTransportError` + 409-conflict + timeout 60s, но `api.ts:84` всё ещё `throw error.response?.data`                                                                                                |
| W-7 дыры в тестах утилит              | 🟡 частично         | production-calendar покрыт ✅; write-xlsx, shared/lib/filter, table-export, use-hydrate-node, use-session-heartbeat, use-tabel-matrix-actions — без тестов                                                     |
| W-8 тест-инфраструктура               | ❌ открыт           | нет setupFiles/auto-cleanup, нет jest-dom, нет общего render-хелпера                                                                                                                                           |
| W-9 дизайн-токены                     | ✅ исправлен        | `shared/design/tokens.ts` + страж `no-hex-drift.test.ts`; literal hex вне канона — 0                                                                                                                           |
| W-10 unsafe-правила ESLint            | ❌ открыт           | `no-unsafe-assignment`/`no-unsafe-call` off; `noUncheckedIndexedAccess` нет                                                                                                                                    |
| W-12 ловушки в сторах                 | ❌ открыт           | `confirm-store.ts:20-23`, `unsaved-changes-store.ts:28-31`, `panel-store.ts:70-78` без изменений                                                                                                               |
| W-13 form-configs-api                 | ❌ открыт           | переехал в `shared/api/form-configs-api.ts`, но post без data, без timeout, сырой throw                                                                                                                        |
| README / .env.example                 | ❌ открыты          | README — Vite-шаблон; `.env.example` нет                                                                                                                                                                       |
| docs/.DS_Store                        | ✅ исправлен        | из VCS удалён                                                                                                                                                                                                  |
| a11y тоста / favorite-button          | ❌ открыты          | `show-toast.tsx:113-121` span onClick; `favorite-button.tsx:21` useState-заглушка                                                                                                                              |
| Карта границ CLAUDE.md                | ❌ устарела сильнее | + новые неотнесённые зоны: pages/analytics, admin, ai-assistant, ai-connections, analytics-\*, notification-center, reportalt, report-result-view, support-call, treasury-export, background-tasks, auth и др. |

---

## 3. Новая зона: конструктор дизайна (SDUI)

**Хорошо:** `lib/customize-form/` — 12 маленьких файлов с одной ответственностью; FSD-нарушений нет (админка ходит через barrel `@/features/sdui`); хардкода строк нет (всё через `t('sdui.customizeForm.*')`, ru/kk в наличии); hex только в allowlist-каноне `theme-presets.ts`; секретов нет.

**Проблемы (по убыванию):**

1. **`ui/customize-form-dialog.tsx` — 645 строк (лимит ×2)**, пять ответственностей в одном компоненте: выбор API-слоя (:99-111), загрузка+слияние патча (:113-130), сидинг состояния в рендер-фазе (:132-177), мутации секций/зон (:251-349), сериализация патча (:198-223). Из-за этого логика, пишущая персистентные ролевые слои, не тестируема. Разбивка: `lib/customize-form/section-mutations.ts` (чистые функции над `PageSection[]`), `seed-editor-state.ts`, `lib/hooks/use-view-settings-layer.ts`, `ui/customize-form-inspector.tsx` (:511-575).
2. **Ядро грид-математики без тестов:** `grid-zones.ts` (`reflowZone` :168-182 — каскадное перетекание, `extractGridZones`), `page-sections.ts` (`buildPageSections`/`sectionDecisions` — сериализация модели в патч), `merge-patch-layers.ts` (клиентское зеркало серверного mergeLayers), `build-preview-model.ts`. Чистые функции, ошибка молча портит сохранённые раскладки всех ролей; покрытие дешёвое.
3. **`ui/customize-form-grid-editor.tsx` — 383 строки:** DnD-drop с тройной компенсацией индексов (:125-137) — классическое место off-by-one — без тестов. Разбивка: `lib/customize-form/grid-drop.ts`, `use-grid-resize.ts`, `ui/grid-editor-item.tsx`.
4. **`app/theme/theme.ts` — 466 строк:** один объект-конфиг; механическая разбивка по семействам MUI (`theme/inputs.ts`, `pickers.ts`, `menus.ts`, `tabs.ts`).
5. **Модульные синглтоны жизненного цикла:** `admin-customize-auto-open.tsx:24,29` (без тестов, `navigate(-1)`-переходы), `apply-server-theme.ts:42,94-95,108` (несъёмный resize-listener).
6. Мелочь: сентинел `'⋯'` как строковый контракт между `grid-zones.ts:98` и `customize-form-dialog.tsx:535` — лучше флаг `unlabeled: boolean`; глифы-стрелки `↑↓⚠‹›` текстом вместо иконок реестра.

---

## 4. Новая зона: аналитика, ИИ-помощники, уведомления

**Хорошо:** лимит строк соблюдён везде (макс. 293); внутрисегментных barrel'ов нет; API в `api/`, мутации через `useMutation`; hex-цветов нет; **безопасность ИИ-ключей образцовая** — ключ никогда не возвращается с сервера (только `hasApiKey`+`apiKeyMask`), поле всегда стартует пустым, `apiKey: null` если не менялся, ни localStorage, ни логов, ни кэша с ключом.

**Проблемы (по убыванию):**

1. **Deep-импорты между page-слайсами:** `analytics-report/ui/report-view.tsx:11` → `analytics-dashboard/lib/utils/params-ready` (по смыслу место утилиты — `features/analytics-params`); `analytics-assistant/ui/assistant-preview.tsx:6-7` → чужие `ui/` мимо barrel'ов; `analytics-assistant-page.tsx:17` — deep import константы, которая уже есть в barrel.
2. **Хардкод русских строк:** `ai-assistant/ui/assistant-context-bar.tsx:30-40` («список документов», «запись №…» и др. в JSX) и `use-assistant-session.ts:38` (фолбэк в ленту чата) — kz-локаль увидит русский текст.
3. **Тесты:** без покрытия `build-table-model.ts` (группировка+итоги+типизированная сортировка — самая насыщенная логика зоны), `report-export.ts` (CSV-экранирование, BOM), `text-widget.tsx:23-81` (рукописный markdown-парсер), `assistant-error.ts` (эвристика «нет настроек ИИ»), оба `use-assistant-session.ts`.
4. **`useCallback` без перф-причины** (нарушение правила проекта): 6 шт. в `analytics-assistant/lib/hooks/use-assistant-session.ts:53-123`, 3 шт. в `ai-assistant/.../use-assistant-session.ts`.
5. **Дубли:** реестр провайдеров задан дважды (`analytics-ai-settings/lib/consts/providers.ts:21-42` ↔ `ai-connections/ui/connection-form-dialog.tsx:19-24`); label-by-lang реализован трижды; `unwrap` и разбор ошибок — по два раза.
6. Точечно: ENUM-значение кодируется индексом опции (`param-field.tsx:131-141` — сломается при пересортировке); `localeCompare(…, 'ru')` жёстко (`build-table-model.ts:56`); refetch через счётчик с `eslint-disable` (`dashboard-widget-card.tsx:41-42`).

---

## 5. Механические проверки по всему src/

### 5.1 Лимит строк (>300, не-тестовые, вне легаси)

**29 файлов (было 26).** Новые нарушители — конструктор: `customize-form-dialog.tsx` (645), `theme.ts` (466), `customize-form-grid-editor.tsx` (383), `object-cell-editor.tsx` (336). Рост старых: `complex-editable-table.tsx` 937→1011, `tree-table.tsx` 921→959, `form-view.tsx` 570→606, `build-column-defs.ts` 497→528, `dispatch.ts` 373→431. Легаси-файлы (18) — вне лимита по правилам.

### 5.2 Barrel'ы

Внутрисегментные barrel'ы — те же зоны `shared/` (buttons, form-fields, icons, inputs, shimmer-block, micro-label, select-operation-dialog, lib/eav, lib/table-export, lib/dictionary-entry) + `app/config/i18n`. Для `shared/ui/*` это фактически сложившаяся политика «папка-компонент = barrel» — стоит либо узаконить её в CLAUDE.md, либо ликвидировать; сейчас правило и практика расходятся.

### 5.3 Секреты

В затрекканных файлах — чисто (скан по паттернам ключей/токенов/паролей, sk-/ghp-/AKIA, .env/credentials в git). Единственная утечка-риск — прежняя W-2 (build-arg в CI).

### 5.4 Зависимости

`npm audit --omit=dev`: **4 high, 2 moderate** — axios (SSRF, прямая), react-router/react-router-dom (advisory RCE в turbo-stream-десериализации), form-data (CRLF), follow-redirects, yaml. Все чинятся `npm audit fix` (минорные апдейты).

### 5.5 Бандл

Главный чанк **2 549 kB (756 kB gzip)** — код-сплиттинг практически отсутствует (единственный отделённый крупный чанк — dashboard-view 336 kB). Ленивая загрузка легаси-страниц и конструктора срезала бы холодный старт кратно.

### 5.6 Прочее

Deep-relative импорты (≥3 уровней): 269 (было 253). `useMemo`/`useCallback` — концентрация в таблицах оправдана, новые аутлаеры — assistant-хуки (§4.4).

---

## 6. Приоритетный план

| #   | Действие                                                                                                                                                             | Закрывает  | Оценка                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------- |
| 1   | CI-гейт: `npm test` + `tsc -b` + `eslint .` (PR-workflow) — **третий раз в плане, кода стало на 17k строк больше**                                                   | W-1        | ~полдня                |
| 2   | `ANTHROPIC_API_KEY` → BuildKit secret mount                                                                                                                          | W-2        | ~час                   |
| 3   | `npm audit fix` (axios/react-router/form-data)                                                                                                                       | §5.4       | ~час с прогоном тестов |
| 4   | Тесты на грид-ядро конструктора (`grid-zones`, `page-sections`, `merge-patch-layers`) + `build-table-model` + CSV-экспорт                                            | §3.2, §4.3 | 1-2 дня                |
| 5   | Декомпозиция `customize-form-dialog.tsx` (645) и `customize-form-grid-editor.tsx` (383) — вынести чистую логику в `lib/customize-form/` заодно сделав её тестируемой | §3.1, §3.3 | ~день                  |
| 6   | i18n-фиксы: `assistant-context-bar.tsx`, `use-assistant-session.ts:38` + хвосты прошлого ревью (`unknown-node.tsx` и др.)                                            | §4.2       | ~полдня                |
| 7   | eslint-plugin-import (no-restricted-paths, no-cycle, запрет deep imports) — остановит W-3/W-4 и новые deep-импорты аналитики                                         | W-5, §4.1  | ~день                  |
| 8   | Разбить `theme.ts` по семействам MUI                                                                                                                                 | §3.4       | ~2 часа                |
| 9   | Актуализировать карту границ CLAUDE.md (+15 неотнесённых зон) и зафиксировать политику barrel'ов в `shared/ui`                                                       | §2, §5.2   | ~час                   |
| 10  | Код-сплиттинг: lazy-роуты легаси-страниц и конструктора                                                                                                              | §5.5       | ~полдня                |
| 11  | Хвосты: единый API-error (W-6), form-configs-api (W-13), сторы (W-12), README/.env.example, a11y тоста                                                               | W-6/12/13  | по мере захода         |

Пункты 1-3 — те же системные и дешёвые, что и в прошлом плане; их невыполнение — главный процессный риск проекта: 1749 зелёных тестов ничего не гейтят.

---

## 7. Статус выполнения (конец дня 2026-09-18, ветка profiling/full-audit)

Выполнено всё из плана §6, кроме п.1 (CI-гейт — отключён сознательно на время МВП, решение пользователя). 23 коммита, 283 файла, тесты 1749→1993 (все зелёные), билд и визуальные тесты чистые.

- **Инфраструктура:** ключ ушёл из build-args в k8s-секрет (W-2 ✅); npm audit — 0 уязвимостей; eslint-plugin-import подключён (3 FSD-правила, warn-режим; no-cycle за LINT_CYCLES=1); vitest setupFiles + jest-dom (W-8 ✅); README/.env.example/карта границ CLAUDE.md актуализированы; .playwright-mcp сняты с трекинга.
- **W-хвосты:** единый ApiHttpError (W-6 ✅), form-configs-api починен (W-13 ✅), confirm-сторы не теряют промисы (W-12 ✅), a11y тоста ✅.
- **Декомпозиция (свип §8 по 2026-09-18-decomposition-sweep.md):** сняты все дубли §7.1–7.7 (buildHeadModel ×6→1, applyServerPatches ×3→1, табличные команды/спейсеры/ref-фабрика, reference-value, debounce→shared, ShimmerBlock); файлы >300 вне легаси: 29 → 4, у оставшихся (use-table-sync 417, complex-editable-table 351, sheet-xml 328, build-column-defs 315) остаток — несущие инварианты и комментарии, дожимать вредно.
- **Код-сплиттинг:** главный чанк 762→542 KB gzip (livekit/dict-sidebar/ИИ-виджеты вне критического пути).
- **Не делалось (осознанно):** CI-гейт (п.1, МВП); легаси-god-файлы (заморожены правилами); reportalt (в карте границ отнесён к легаси — план разбивки лежит в свипе §5 на случай пересмотра); favorite-button — нужно продуктовое решение (тикет на персист или удаление).
