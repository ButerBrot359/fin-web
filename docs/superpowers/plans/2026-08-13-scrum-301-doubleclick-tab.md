# SCRUM-301: даблклик из «Связанных документов» во вкладку документа — план имплементации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Даблклик по строке дерева «Связанные документы» активирует обычную workspace-вкладку документа (через `armNewTab()` gateway) вместо смены URL под активной вкладкой панели.

**Architecture:** Один вызов `armNewTab()` из существующего gateway `workspace-tab-gateway.ts` перед `navigate(route)` в `handleDoubleClick` компонента `SubordinationTree`. App-уровневый биндинг gateway уже маппит `armNewTab()` на workspace-стор — новых мостов и контрактов нет.

**Tech Stack:** React 19, TypeScript, vitest + @testing-library/react.

**Спека:** `docs/superpowers/specs/2026-08-13-scrum-301-doubleclick-tab-design.md` (принята; первоисточник — `specs-local/scrum-301-svyazannye-dokumenty/SCRUM-301-spec-v2-2026-08-12-front.md`).

## Global Constraints

- Ветка: `feature/SCRUM-301-doubleclick-tab` (уже создана от `dev`, дизайн-док закоммичен).
- SDUI-таска: легаси-код не трогать; изменения только в `src/features/sdui/`.
- Запрещён прямой импорт `useWorkspaceTabsStore` (и вообще `features/workspace-tabs`) в SDUI — только gateway `src/features/sdui/lib/workspace-tab-gateway.ts`.
- Контракт с бэком, SDUI-ноды, API — не меняются ни одним полем.
- Новых пользовательских текстов нет → i18n не затрагивается.
- Тесты: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx` (скрипт `npm test` = `vitest run` по всему репо — не использовать, слишком широко).
- Формат коммита (husky commit-msg): `feat|fix|add|refactor: описание`.
- `npm run build` — один раз в финальной проверке перед пушем (не после каждого шага).

---

### Task 1: armNewTab() в handleDoubleClick + регресс-тест

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/subordination-tree.tsx:80-87` (функция `handleDoubleClick`)
- Test: `src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`

**Interfaces:**

- Consumes: `armNewTab(): boolean` из `src/features/sdui/lib/workspace-tab-gateway.ts` (уже существует; при незабинженном gateway возвращает `false` с console.warn — мягкая деградация, обработка не нужна).
- Produces: ничего нового — поведенческий фикс, публичных API не добавляет.

- [ ] **Step 1: Написать падающие тесты**

В `subordination-tree.test.tsx`:

1. Рядом с `navigateMock` (после строки 20) добавить мок gateway-модуля. Обёртка-стрелка обязательна — фабрика `vi.mock` выполняется при импорте модуля, раньше инициализации `const` (тот же приём, что у `useNavigate: () => navigateMock` в этом файле):

```tsx
const armNewTabMock = vi.fn()
vi.mock('../../../lib/workspace-tab-gateway', () => ({
  armNewTab: () => armNewTabMock(),
}))
```

2. Новый тест в `describe('SubordinationTree', ...)`:

```tsx
it('двойной клик армит новую workspace-вкладку через gateway (спека v2)', () => {
  state['related.tree'] = [
    row({ rowId: 'r1', _route: '/documents/SchetKOplate/1002' }),
  ]
  render(<TableNode node={treeNodeNoActions} />)
  fireEvent.doubleClick(screen.getByText('Документ'))
  expect(armNewTabMock).toHaveBeenCalledTimes(1)
  expect(navigateMock).toHaveBeenCalledWith('/documents/SchetKOplate/1002')
})
```

3. В существующий тест `'двойной клик навигирует по _route; фолбэк — entityRef'` добавить последней строкой (fallback-маршрут получает то же поведение вкладки — таблица спеки):

```tsx
expect(armNewTabMock).toHaveBeenCalledTimes(2)
```

4. В существующий тест `'_isTruncated: без иконки, клик не выделяет, dblclick не навигирует'` добавить рядом с проверкой `navigateMock`:

```tsx
expect(armNewTabMock).not.toHaveBeenCalled()
```

`vi.clearAllMocks()` в `beforeEach` уже сбрасывает `armNewTabMock` — отдельный сброс не нужен.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
Expected: FAIL — 2 падения по `armNewTabMock` (`expected ... to be called 1 times, but got 0` в новом тесте; `2 times, but got 0` в fallback-тесте); truncation-тест зелёный (проверка `not.toHaveBeenCalled()` проходит и до фикса — это гард от регресса). Остальные тесты зелёные.

- [ ] **Step 3: Минимальная имплементация**

В `subordination-tree.tsx`:

1. К импортам из `../../../lib/` (после строки 19) добавить:

```tsx
import { armNewTab } from '../../../lib/workspace-tab-gateway'
```

2. Заменить `handleDoubleClick` (строки 80–87) на:

```tsx
const handleDoubleClick = (row: RelatedTreeRow) => {
  if (row._isTruncated === true) return
  const ref = row._type?.entityRef
  const route =
    row._route ??
    (ref ? `/documents/${ref.typeCode}/${String(ref.id)}` : undefined)
  if (!route) return
  // Активная вкладка — sdui-panel, и пока она активна, layout рендерит хост
  // панели вместо route-children: без активации обычной вкладки документа
  // navigate поменяет только URL (спека v2 SCRUM-301).
  armNewTab()
  void navigate(route)
}
```

- [ ] **Step 4: Убедиться, что тесты зелёные**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
Expected: PASS — все 10 тестов (9 существующих + 1 новый).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/subordination-tree.tsx src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx
git commit -m "fix: даблклик из связанных документов активирует вкладку документа через gateway (SCRUM-301)"
```

---

### Task 2: Финальная верификация перед пушем

**Files:** ничего не меняет (только проверки).

**Interfaces:** нет.

- [ ] **Step 1: Прогнать тесты файла ещё раз начисто**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
Expected: PASS, 10 тестов.

- [ ] **Step 2: Сборка (обязательна перед пушем, tsc -b строже tsc --noEmit)**

Run: `npm run build`
Expected: успешное завершение. Допустимы предсуществующие предупреждения Rollup о циклических зависимостях и размере чанков (зафиксированы в спеке v2) — новых ошибок быть не должно.

- [ ] **Step 3: Ручная приёмка на стенде (по чеклисту спеки v2)**

1. Поднять fin-web (`npm run dev`), открыть
   `http://127.0.0.1:5173/modules/BankiIKassy/document/ZayavkaNaRegistratsiyuGPSdelki/27855613?skipDependsOn=true`
2. Открыть «Связанные документы», даблклик по `LT00-00002` → активна карточка `LT00-00002`, а не перекоренённая панель.
3. Вкладка «Связанные документы» жива и выбирается снова.
4. Одиночный клик по `LT00-00002` → «Вывести для текущего» → панель перестраивается от него (как раньше).

Если локальный стенд с БД недоступен — зафиксировать это явно и согласовать проверку на дев-стенде; пункт не помечать выполненным молча.

- [ ] **Step 4: Пуш ветки**

```bash
git push -u origin feature/SCRUM-301-doubleclick-tab
```

После пуша (вне плана, по workflow): короткий коммент в SCRUM-301 с меншоном Talgat + перенос в «Готово к тестированию».
