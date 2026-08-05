# SCRUM-291 · K2 — нода REPORT_RESULT через gateway (дизайн)

Дата: 2026-08-06. Родитель: [roadmap](2026-08-05-scrum-291-frontend-migration-roadmap-design.md) п.6, спека §19.
Gateway согласован пользователем (CLAUDE.md требует явного согласия — получено).

## Проблема и решение

REPORT_FORM: форма параметров переезжает в SDUI обычными field-нодами (готово: K1 `props.multiple`);
результат отчёта рисует существующий легаси-рендерер `features/report-result-view` (`ReportResultView`,
чистый: принимает `{result}`, сам переключает LEDGER/TREE/FORM). Прямой импорт SDUI→легаси запрещён →
мост через **новый gateway** (impl-object, образец `workspace-tab-gateway.ts`), реализация подключается
в `App.tsx`.

## Gateway (SDUI-сторона, `src/features/sdui/lib/report-result-gateway.ts`)

```ts
export interface ReportResultGatewayImpl {
  // Рисует результат отчёта. result — структурно совместим с ReportResultDto/ReportAltResultDto
  // (reportalt уже передаёт свой DTO в ReportResultView без каста). SDUI держит result как unknown/минимальный тип.
  Renderer: FC<{ result: unknown }>
  // Печать (опц.): бэк-эндпоинт .../print. code+body+language. Возвращает промис (blob открывает impl).
  print?: (code: string, body: unknown, language: string) => Promise<void>
  // Экспорт в XLSX (опц.): клиентский, из result.
  exportXlsx?: (result: unknown, reportName: string) => void
}
let impl: ReportResultGatewayImpl | null = null
export function setReportResultGateway(
  g: ReportResultGatewayImpl | null
): void {
  impl = g
}
export function getReportResultGateway(): ReportResultGatewayImpl | null {
  return impl
}
```

Экспорт из `src/features/sdui/index.ts` (`setReportResultGateway`, тип). Незарегистрирован → нода
рисует плашку «рендерер результата недоступен» (не падает).

## App-wiring (`src/app/App.tsx`, как reference-picker-gateway)

`useEffect`: `setReportResultGateway({ Renderer: ReportResultView, print: printReportAlt-обёртка,
exportXlsx: buildReportAltExport+exportTableToXlsx })`; cleanup `setReportResultGateway(null)`.
Импорты легаси (`@/features/report-result-view`, `reportalt-api`, `@/shared/lib/table-export`) живут
**в app/**, не в SDUI. Печать: обёртка над `printReportAlt(code, body, language)` (POST .../print).

## Нода REPORT_RESULT (`src/features/sdui/ui/nodes/composite/report-result-node.tsx`)

Регистрация: `REPORT_RESULT` в `types/node-types.ts` (NodeType union) + `component-registry.ts`.

Пропсы (`node.props`, §19.1): `reportCode`, `contour`("REPORT_ALT"), `reportLayout`(LEDGER/TREE/FORM),
`pageSize`(200 для LEDGER), `settingsEnabled`, `printEnabled`, `exportEnabled`,
`source`({url,method:"POST",body}|null), `placeholder`.

Поведение:

- `source == null` (на открытии) → показать `placeholder`; **НЕ фетчить на монтировании, НЕ сбрасывать
  source при смене параметра** (§19.1 — точное соответствие 1С, «Сформировать» — явная команда).
- `source != null` → фетч через `useInfiniteQuery` по образцу `use-run-reportalt`:
  - `queryKey: ['sdui-report-result', source.url, source.body]`, `enabled: !!source`.
  - `queryFn`: `apiService.post({ url: source.url, params: {page,pageSize}, data: source.body, signal })`
    (тот же POST-транспорт, что `fetchListPage`; тело — целиком `source.body`, НЕ собирать руками, §19.6).
  - LEDGER: `getNextPageParam` по `result.hasMore`/`result.page`; страницы мержатся
    (`base=firstPage`, `rows=pages.flatMap(p=>p.rows)`); кнопка «Показать ещё» при `hasNextPage`.
    Не-LEDGER: одна страница.
  - Результат → `<gateway.Renderer result={merged}/>`.
- Кнопки печати/экспорта — рисует нода по `printEnabled`/`exportEnabled` (не в TOOLBAR, §19.1):
  печать → `gateway.print?.(reportCode, source.body, language)`; экспорт → `gateway.exportXlsx?.(result, name)`.
  `reportCode` — из props (§19.6: из session/props, не из литерала). language — из i18n.
- `unknown-node` деградация безопасна: до регистрации ноды экран покажет параметры+тулбар, результат — плашку.

## Тулбар «Сформировать»/«Сбросить» — НЕ часть K2

Кнопки тулбара (`report.run`/`report.reset` без суффикса, §19.1) — обычные BUTTON-ноды, диспатчат
`action.command` существующим механизмом. Никакой спец-дельты; сервер по `report.run` вернёт патч
`setProp(result, "source", {…})` → нода зафетчит. `report.reset` → `replaceNode` группы параметров.
Проверить, что BUTTON диспатчит голую команду без суффикса — уже работает (generic).

## Границы K2 (Phase-1)

- **В скоупе:** gateway, регистрация ноды, source-фетч, LEDGER-пагинация, рендер результата,
  печать/экспорт через gateway, placeholder.
- **Отложено (follow-up), явно:** встроенная панель настроек (поля/отборы/сортировка/группировка/
  оформление) и наложение клиентских `userSettings` поверх `source.body` (§19.1). Без неё отчёт
  запускается и показывается с серверными дефолтами — Phase-1 полноценна как «отчёт виден/печатается»,
  смена настроек с SDUI-экрана — следующий срез. Зафиксировать в леджере и сообщить пользователю.
- **Вне пакета:** 2 отчёта из 63 (§19.4), панель настроек как таковая (легаси, не переезжает целиком).

## Декомпозиция (writing-plans / subagent)

1. **K2a — gateway + app-wiring + нода-скелет:** gateway-файл, экспорт, App.tsx-регистрация (Renderer),
   регистрация NodeType, тело ноды: placeholder при source=null, source-фетч (одна страница),
   рендер через gateway.Renderer. Тесты: placeholder при null; фетч+рендер при source; gateway
   незарегистрирован → плашка.
2. **K2b — LEDGER-пагинация + печать/экспорт:** useInfiniteQuery-мерж страниц + «Показать ещё»;
   кнопки print/export по флагам через gateway. Тесты: пагинация мержит rows; кнопки видны/зовут gateway.

## Открытый вопрос (в план)

Печать: в пропсах §19.1 нет URL печати — обёртка `print` строит `/api/reportalt/{code}/print` в app-слое
(легаси-сторона знает контур). Нода даёт gateway только `reportCode`+`source.body`+language. Если бэк
позже даст явный print-source — переключить на него. Экспорт — чисто клиентский из result.
