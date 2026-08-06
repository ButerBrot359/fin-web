# SCRUM-291 — закрытие тикета: 4 оставшихся куска (дизайн)

Дата: 2026-08-06. Скоуп закрытия (утверждён пользователем): **все 4 куска**.
Родитель: [roadmap](2026-08-05-scrum-291-frontend-migration-roadmap-design.md), [K2 REPORT_RESULT](2026-08-06-scrum-291-report-result-design.md).

Всё ядро 291 сдано и влито в dev+main (List Phase 2, дефекты 1/2, J, L, 3b, K1, K2). Ниже — 4 остатка.

## 1. Панель настроек отчёта (фича) — подход A (утверждён)

**Проблема:** §19.1 — панель настроек (поля/отборы/сортировка/группировка/оформление) не переезжает,
но монтируется внутри `REPORT_RESULT`; клиентские `userSettings` накладываются поверх `source.body`.
Прямой импорт легаси-панели в SDUI запрещён.

**Подход A — gateway отдаёт панель целиком:**

- Расширить `ReportResultGatewayImpl` (`report-result-gateway.ts`) опциональным полем:
  `SettingsPanel?: FC<{ reportCode: string; appliedUserSettings: unknown; onApply: (userSettings: unknown) => void; onReset: () => void; open: boolean; onClose: () => void }>`.
- App-слой (`App.tsx`) реализует `SettingsPanel`: монтирует легаси `ReportAltSettingsDrawer`, сам фетчит
  `/api/reportalt/{code}/meta`, держит draft (хук `use-reportalt-user-settings`), на apply собирает
  `ReportAltUserSettingsDto` через `toUserSettingsDto` и зовёт `onApply(dto)`. Вся легаси-оркестрация
  (как в `reportalt-page`) живёт в app/, не в SDUI.
- Нода `REPORT_RESULT`: если `settingsEnabled` — кнопка «Настройки» открывает `gateway.SettingsPanel`;
  локальный стейт `userSettings`; на apply → рефетч с `body = { ...source.body, userSettings }` (overlay,
  НЕ пересборка тела — §19.6 соблюдён, добавляется одно поле); на reset → очистить `userSettings`.
  `appliedUserSettings` прокидывается в панель для инициализации из текущего состояния.
- Незарегистрированный `SettingsPanel` → кнопка «Настройки» не рисуется (fail-closed).

**Тесты:** нода — settingsEnabled+gateway.SettingsPanel есть → кнопка видна, apply кладёт userSettings в
body рефетча, reset убирает; gateway без SettingsPanel → кнопки нет. App-обёртку покрыть смоук-тестом
(меta-фетч + onApply отдаёт DTO) — либо, если тяжело, ручная проверка + пометка.

**Открытый вопрос (в план):** точная форма `toUserSettingsDto`/`draft`/`meta` из `reportalt` — свериться
по `src/pages/reportalt/lib/hooks/use-reportalt-user-settings.ts` при имплементации; если drawer завязан
на роутинг/URL самой страницы — вынести чистую часть, не тащить страничный стейт.

## 2. Split `list-node.tsx` (хайген) — 594 строки > лимита 300

Чистый рефактор без смены поведения (гард — существующий тест-сьют list-node). Вынести в отдельные файлы:

- `list-period-control.tsx` (уже самодостаточный под-компонент внутри list-node),
- `list-sort-header.tsx` — кликабельный заголовок + стрелка сортировки,
- `list-column-defs.ts(x)` — построение columns (accessorFn/cell/ICON-ветка).
  Плюс попутно закрыть a11y-мелочь: `onKeyDown` (Enter/Space) на sortable-заголовке (паттерн
  `workspace-tab-item`). Цель — list-node < 300 строк, все тесты зелёные, build зелёный.

## 3. `in`/`notIn` мультизначение (доделка) — `list-filter-value-control.tsx`

Сейчас `in`/`notIn` падают в одиночный контрол → шлют скаляр вместо массива. Добавить multi-value ветку:
для `in`/`notIn` рендерить мульти-селект (переиспользовать multi-autocomplete-механику из K1 для
reference/enum; для скаляров — список вводимых значений), команда `applyFilter` шлёт `value` массивом.
Обновить guard «Применить» (непустой массив). Тесты: `in` с reference → массив id; `in` с enum → массив value.

## 4. a11y/тест-мелочи (полировка)

Из леджера: усилить тест L (`onSelect` write-back, не только тип); a11y-лейблы фильтр-селектов (native
select) — уже частично; проверить пройденные Minor'ы и закрыть оставшиеся. Мелкие, без риска.

## Порядок и приёмка

Порядок: **2 (split) → 1 (панель настроек) → 3 (in/notIn) → 4 (полировка)**. Split первым — он трогает
list-node, дальше конфликтов нет. Каждый — свой TDD-цикл + ревью + коммит. Финал: `npm run build` зелёный
(не только vitest — дважды ловил build-breaker'ы), merge dev→main, обновить фронт-спеку до v2 в Jira.

DoD закрытия: 4 куска сданы, build+тесты зелёные, влито в main, спека-v2 в тикете; тикет → Backend/тест
(колонку согласовать с пользователем — не двигать зонтичный тикет молча).
