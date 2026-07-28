# SCRUM-286 — Убрать знания фронта об API: дизайн фронт-реализации

**Дата:** 2026-07-28
**Зона:** SDUI (`src/features/sdui/`). Легаси не трогаем.
**Контракт:** согласован — см. `specs-local/scrum-286-api-knowledge/SCRUM-286-spec-v1-2026-07-24-front.md` (front v1) и `SCRUM-286-back-response.md` (бэк: Δ1/Δ2/Δ3 закрыты в `sdui-1.5`).
**Решение брейншторма:** `fromBinding` резолвим **только в шапочном поле** (reference-field-node); ячейки ТЧ — YAGNI.

---

## Инвариант

Фронт никогда не строит URL загрузки данных и не мапит `domain` → путь. Каждая reference-нода несёт готовый `optionsSource { url, params }`. Новый тип справочника/endpoint не требует правок фронта.

## Важный нюанс объёма

Δ1 убирает **построение URL**, но `domain`/`targetTypeCode` **остаются** как непрозрачная идентичность для легаси-пикера (`openReferencePicker`, §4/§6 контракта). Удаляем только: `DOMAIN_PATH_MAP` (обе копии), ветку `/api/${domainPath}/${typeCode}/entries`, чтение `domain` *ради URL* и бизнес-хардкод `Vladelets`.

---

## Компоненты

### 1. `lib/utils/resolve-options-params.ts` — чистая функция
```ts
type ParamValue = string | { fromBinding: string }
resolveOptionsParams(
  params: Record<string, ParamValue> | undefined,
  getValue: (binding: string) => unknown,
): Record<string, string>
```
Правила:
- строка → как есть;
- `{ fromBinding }` → `getValue(binding)`; если значение — объект с `id`, берём `String(id)`, иначе примитив `String(value)`; если пусто/`null` — **параметр опускается** (нет фильтра = показать всё);
- прочие типы значений игнорируются (не улетают как `[object Object]`).

Полностью unit-тестируется. Главная цель TDD.

### 2. `lib/hooks/use-resolved-options-params.ts` — реактивный хук
Обёртка над чистой функцией. Тонкость: `useBindingValue` — хук, в цикле по N биндингам звать нельзя. Источник значений — zustand-селектор со `shallow`-равенством, чтобы нода ре-рендерилась **только когда изменились резолвнутые params** (не ломаем оптимизацию M1 «подписка только на своё значение»):
```ts
export function useResolvedOptionsParams(params) {
  const session = useSduiSession()
  const rootResolved = useViewStateStore(
    (s) => resolveOptionsParams(params, (b) => s.state[b]),
    shallow,
  )
  if (session.kind === 'root') return rootResolved
  return resolveOptionsParams(params, session.getValue) // panel-ветка, как в useBindingValue
}
```

### 3. `ui/nodes/fields/reference-field-node.tsx`
- удалить `DOMAIN_PATH_MAP` (15-19), фолбэк URL (61-68), блок `Kontragent→Vladelets→DogovoryKontragentov` (47-59, 70-72, а также вставку `Vladelets` в `filterSearchParams` 100-110);
- `url = optionsSource?.url ?? null`;
- `const params = useResolvedOptionsParams(optionsSource?.params)`;
- `resetKey = JSON.stringify(params)` — реактивность дропдауна;
- легаси-пикер: `filterSearchParams` теперь только из `node.props.filter` (бэк кладёт туда конкретный `{Vladelets:123}` — гарантия back-spec §Δ2);
- `domain`/`targetTypeCode` продолжают читаться и передаваться в `openReferencePicker` (не удаляем).

### 4. `ui/nodes/composite/reference-cell-editor.tsx`
- удалить `DOMAIN_PATH_MAP` (13-17) + фолбэк URL (74-79);
- `url = optionsSource?.url ?? null` (пустой → уже есть нейтральный `<span>`, оставляем);
- `params = resolveOptionsParams(optionsSource?.params, () => undefined)` — защитно, чтобы случайный `{fromBinding}` не улетел строкой; session-context в ячейку не тащим.

---

## Тесты (TDD)
1. `lib/utils/resolve-options-params.test.ts` — passthrough строк; `{fromBinding}` → id объекта; примитивное значение; пустое/`null` → опущен; несколько params; не-объектное значение игнорируется.
2. (Опц.) хук — по образцу существующих `lib/*.test.ts`.

## Проверка после реализации
Дев + документ с `DogovoryKontragentov` (напр. «Заявка на регистрацию ГП-сделки»): дропдаун договоров фильтруется по Контрагенту и реактивно меняется при смене контрагента; «Показать все» работает; обычный словарный reference грузится (регресс).

## Порядок
1. TDD: тест чистой функции → функция.
2. Хук.
3. reference-field-node (Δ1+Δ2, легаси-пикер на `filter`).
4. reference-cell-editor (Δ1 + защитный резолв).
5. Прогон линта/тестов, верификация в браузере.
6. Коммит, коммент в Jira, передать таску (бэк-часть закрыта → в «Готово» после проверки).
