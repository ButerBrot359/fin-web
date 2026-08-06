# SCRUM-291 (добить) — печать через props.printSource Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переключить печать SDUI-отчёта на чтение `props.printSource.url` от бэка вместо конструирования `/api/reportalt/{code}/print` на app-слое.

**Architecture:** Бэк теперь отдаёт `printSource: {url, method}` на узле `REPORT_RESULT` (§2 ответов бэка). Нода читает url и передаёт в gateway; app-слой POST-ит url и открывает blob. URL больше не строится на фронте (A4-паттерн). Поведение не меняется (адрес побайтово тот же).

**Tech Stack:** React 19, TypeScript, MUI, TanStack Query, Vitest + RTL, axios (apiService).

## Global Constraints

- Design-док: `docs/superpowers/specs/2026-08-06-scrum-291-print-source-design.md`.
- Только SDUI (`src/features/sdui/`) + app-gateway (`src/app/App.tsx`); легаси-рендерер отчёта не трогать.
- **Матчеры — только нативные vitest** (`.toHaveBeenCalledWith/.toBeNull/.toBeTruthy`); НЕ jest-dom, НЕ трогать config/package.json.
- Язык печати уже в `printSource.url` — фронт язык НЕ добавляет.
- НЕ запускать `tsc`/`lint` пошагово. Тест: `npx vitest run <path>`. **App.tsx юнит-тестами не покрыт → в этой задаче ОБЯЗАТЕЛЬНО `npm run build` до exit 0** (ловит типы App.tsx/gateway).
- Формат коммита (хук): `feat|fix|add|refactor: описание`.
- `report-result-node.test.tsx` уже 315 строк (пред-существующее превышение, не наш вклад) — правки in-place, файл НЕ растить.

## File Structure

- Modify: `src/features/sdui/ui/nodes/composite/report-result-node.tsx` — читать `printSource`, гейт кнопки, вызов `print(url, body)`.
- Modify: `src/features/sdui/lib/report-result-gateway.ts` — сигнатура `print`.
- Modify: `src/app/App.tsx` — generic POST-blob по url, убрать `printReportAlt`/`RunReportAltBody`/язык.
- Modify: `src/features/sdui/ui/nodes/composite/report-result-node.test.tsx` — тест печати на `printSource`.

---

### Task 1: Печать отчёта через `props.printSource`

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/report-result-node.tsx`
- Modify: `src/features/sdui/lib/report-result-gateway.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`

**Interfaces:**

- Изменяется: `ReportResultGatewayImpl.print?: (url: string, body: unknown) => Promise<void>` (было `(code, body, language)`).

- [ ] **Step 1: Обновить тест ноды (падающий)**

В `report-result-node.test.tsx`:

(1) В интерфейсе `GatewayImplStub` заменить сигнатуру print:

```ts
  print?: (url: string, body: unknown) => Promise<void>
```

(2) Заменить существующий тест `it('printEnabled → кнопка печати зовёт gateway.print(reportCode, source.body, language)', …)` (целиком) на два теста:

```tsx
it('printSource → кнопка печати зовёт gateway.print(printSource.url, effectiveBody)', () => {
  const printMock = vi.fn().mockResolvedValue(undefined)
  getReportResultGateway.mockReturnValue({
    Renderer: (() => null) as unknown as FC<{ result: unknown }>,
    print: printMock,
  })
  render(
    <ReportResultNode
      node={nodeWithSource({
        printSource: {
          url: '/api/reportalt/OSV/print?language=Kz',
          method: 'POST',
        },
      })}
    />
  )
  fireEvent.click(screen.getByTestId('report-result-print'))
  expect(printMock).toHaveBeenCalledWith(
    '/api/reportalt/OSV/print?language=Kz',
    { a: 1 }
  )
})

it('без printSource → кнопки печати нет', () => {
  getReportResultGateway.mockReturnValue({
    Renderer: (() => null) as unknown as FC<{ result: unknown }>,
    print: vi.fn(),
  })
  render(<ReportResultNode node={nodeWithSource({ printEnabled: true })} />)
  expect(screen.queryByTestId('report-result-print')).toBeNull()
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`
Expected: FAIL (нода ещё гейтит по `printEnabled` и зовёт `print` с `(code, body, language)`).

- [ ] **Step 3: Изменить `report-result-node.tsx`**

(1) Рядом с чтением пропов (после `const printEnabled = ...`) добавить:

```ts
const printSource = node.props?.printSource as
  | { url: string; method?: string }
  | undefined
```

(2) В условии видимости панели-тулбара заменить `printEnabled ||` на `printSource ||`:

```tsx
      {(printSource ||
        exportEnabled ||
        (settingsEnabled && SettingsPanel)) && (
```

(3) Кнопку печати гейтить и вызывать по `printSource`:

```tsx
{
  printSource && (
    <Button
      data-testid="report-result-print"
      onClick={() => {
        void gateway?.print?.(printSource.url, effectiveBody)
      }}
    >
      {t('sdui.reportResult.print')}
    </Button>
  )
}
```

(4) `printEnabled` больше не нужен для печати — удалить строку `const printEnabled = node.props?.printEnabled === true` (иначе повиснет unused и упадёт lint на коммите). `i18n` остаётся (используется `i18n.language` в другом месте? — если после правки `i18n` не используется, оставить только `t` в деструктуризации `useTranslation`; проверить: печать больше не читает `i18n.language`).

- [ ] **Step 4: Изменить сигнатуру в `report-result-gateway.ts`**

```ts
  // Печать (опц.): POST по url от бэка (props.printSource.url; язык уже в url),
  // blob открывает impl.
  print?: (url: string, body: unknown) => Promise<void>
```

- [ ] **Step 5: Изменить реализацию gateway в `App.tsx`**

(1) Заменить блок `print:` на:

```tsx
      print: (url, body) =>
        apiService
          .postFileBlob({ url, data: body })
          .then((res) => {
            window.open(URL.createObjectURL(res.data))
          }),
```

(2) Импорты: добавить `import { apiService } from '@/shared/api/api'` (если ещё не импортирован в App.tsx). Удалить импорт `printReportAlt` (`@/pages/reportalt/api/reportalt-api`) и удалить `RunReportAltBody` из импорта типов `@/pages/reportalt/types/reportalt` (оставить `ReportAltResultDto` — он ещё нужен в Renderer/exportXlsx). Убедиться, что ничего из удаляемого больше не используется в App.tsx (grep).

- [ ] **Step 6: Тест ноды зелёный + папка + BUILD**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`
Expected: PASS.
Run: `npx vitest run src/features/sdui/ui/nodes/composite/`
Expected: PASS.
Run: `npm run build`
Expected: exit 0 (типы App.tsx/gateway/ноды сходятся; App.tsx юнит-тестами не покрыт — build обязателен).

- [ ] **Step 7: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/report-result-node.tsx \
  src/features/sdui/lib/report-result-gateway.ts \
  src/app/App.tsx \
  src/features/sdui/ui/nodes/composite/report-result-node.test.tsx
git commit -m "feat: report print reads props.printSource (drop app-layer URL build) (SCRUM-291)"
```

---

## Self-Review

**Spec coverage:**

- §3.1 нода читает printSource + гейт кнопки + вызов print(url, body) → Step 3. ✓
- §3.2 сигнатура gateway → Step 4. ✓
- §3.3 App.tsx generic POST-blob + чистка импортов → Step 5. ✓
- Тесты (кнопка при printSource, нет без него, url от бэка) → Step 1. ✓
- Build обязателен (App.tsx) → Step 6. ✓

**Placeholder scan:** плейсхолдеров нет; код приведён.

**Type consistency:** `print?: (url: string, body: unknown) => Promise<void>` — согласовано между gateway-типом (Step 4), вызовом в ноде (Step 3), impl в App.tsx (Step 5) и моком в тесте (Step 1).

## Границы

- Печать = generic POST по url от бэка; поведение не меняется (адрес тот же).
- `exportXlsx`/`Renderer`/`SettingsPanel` — не трогаем.
- Вживую не проверить (отчёты не SDUI-включены на dev) — контракт Alisher + юнит-тесты + build.
