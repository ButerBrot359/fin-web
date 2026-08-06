# SCRUM-291 (добить) — печать отчёта через `props.printSource`

Дата: 2026-08-06. Автор: front (fin-web). Основание: ответы бэка `specs-local/scrum-291-perevod-ekranov-na-sdui/backend-answers-SCRUM-291-screens.md` §2 (закрывает мой follow-up из v2-спеки, `SCRUM-291-spec-v2-2026-08-06-front.md`, «Печать: URL печати строю на app-слое; появится print-source — переключимся»).

## 0. Контекст

Зонтичный SCRUM-291 (перевод экранов на SDUI) фронтом сдан (List Phase 2, дефекты, REPORT_RESULT, панель настроек, in/notIn, полировка — всё в dev/main). Alisher ответил на follow-up-и v2-спеки. Единственный разблокированный концом-к-концу фронт-хвост — печать отчёта: бэк сделал явный `printSource`, и по моему же обещанию фронт переключается на его чтение.

Остальные ответы бэка не требуют фронт-кода сейчас: §1 `settingsEnabled` — уже отдаётся (проверить после выката main); §5 зависимые ссылки / 2 отчёта — в работе у бэка; §4 `__subkontoAllowedTypes` — отдельный тикет; §6 DTO→draft инверсия — бэк не блокирует, опциональный future; §7 `requiresSelectedRow` — переделывать нечего.

## 1. Проблема

`ReportResultNode` (`src/features/sdui/ui/nodes/composite/report-result-node.tsx`) на «Печать» зовёт `gateway.print(reportCode, effectiveBody, i18n.language)`. App-слой (`src/app/App.tsx`) строит адрес `/api/reportalt/{code}/print` из `code` через `printReportAlt(...)` и открывает blob. **URL печати конструируется на фронте** — тот же антипаттерн, что A4 убрал для справочных данных (карта доменов удалена, бэк отдаёт готовый `optionsSource.url`).

## 2. Контракт бэка (ответы §2)

```json
"printSource": { "url": "/api/reportalt/{code}/print", "method": "POST" }
```

- Проп — `printSource` в `props` узла `REPORT_RESULT`. Форма та же, что у `source` списка (`url`/`method`).
- `body` бэк НЕ присылает — его собирает фронт (`userSettings` overlay поверх `source.body`, уже реализовано в ноде как `effectiveBody`).
- **Язык уже в url** (`?language=Kz` только для казахского; для русского параметра нет). Фронт язык не добавляет.
- Печать недоступна ⇒ **ключа `printSource` нет вовсе** (не `null`).
- Адрес побайтово совпадает с тем, что фронт строит сегодня, — переключение безопасно, поведение не меняется.

## 3. Изменения

### 3.1. `report-result-node.tsx`

- Читать `const printSource = node.props?.printSource as { url: string; method?: string } | undefined`.
- Кнопку «Печать» гейтить по наличию `printSource` (его присутствие = печать доступна, по контракту), вместо `printEnabled`.
- На клик: `void gateway?.print?.(printSource.url, effectiveBody)`. Язык не передаём — он в url.
- `printEnabled` для печати больше не читаем (проп может ещё приходить с бэка — безвредно).

### 3.2. `report-result-gateway.ts`

- Сигнатура: `print?: (url: string, body: unknown) => Promise<void>` (было `(code, body, language)`). Комментарий обновить: печать = generic POST по url от бэка, blob открывает impl.

### 3.3. `App.tsx` (реализация gateway)

- `print: (url, body) => apiService.post({ url, data: body, responseType: 'blob' }).then((res) => { window.open(URL.createObjectURL(res.data as Blob)) })`.
- Убрать сборку адреса из `code`, `printLanguage` и вызов `printReportAlt` (в печатной ветке). `buildReportAltExport`/`exportXlsx`/`ReportResultView`/`SettingsPanel` — не трогаем.

## 4. Границы

- Печать становится generic «POST по url от бэка → blob»; blob/window остаются в app-слое (gateway).
- `exportXlsx`, `Renderer`, `SettingsPanel` gateway — без изменений.
- Только SDUI + app-gateway; легаси-рендерер отчёта не трогаем.
- Вживую не проверить: отчёты пока не SDUI-включены на dev (`report-form.enabled-codes: []`). Опираемся на контракт Alisher (URL побайтово тот же) + юнит-тесты.

## 5. Тесты

- `report-result-node`: кнопка «Печать» видна при `props.printSource`, скрыта без него; клик зовёт `gateway.print` с `printSource.url` (адрес от бэка, не сконструированный) и `effectiveBody`.
- (app-слой gateway impl из App.tsx юнит-тестами проекта не покрыт — как и раньше; проверяется сборкой.)
