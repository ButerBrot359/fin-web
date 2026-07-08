# Frontend handoff (2026-07-07): `validatePatches` молча отбрасывает `insertNode`/`replaceNode` с null-полями

- **Адресат:** фронт-разработчик `fin-web`
- **Тип:** баг-фикс (1 файл, ~6 строк). Собрать, проверить типы, принять.
- **Файл:** `src/features/sdui/lib/validation.ts`
- **Симптом:** статус исполнения заявки «Заявка исполнена на X из Y» не появляется на форме ЗаявкаНаРегистрациюГПСделки, хотя бэк корректно присылает патч на его вставку. Шире — **любая динамическая вставка/замена узла** (`insertNode`/`replaceNode`) молча не применяется.

---

## 1. Симптом и как воспроизвести

Открыть проведённый документ ЗаявкаНаРегистрациюГПСделки с заполненной «Сумма 1-й год» (>0). В OPEN-ответе бэка (`POST /api/view`, action=OPEN) в массиве `patches` присутствуют:

```jsonc
{ "op": "removeNode", "nodeId": "label.ispolneno", ... },
{ "op": "insertNode", "parentId": "body", "index": 2,
  "node": {
    "id": "label.ispolneno", "type": "LABEL",
    "props": { "variant": "heading", "text": "Заявка исполнена на 1000.00 из 1000.00" },
    "binding": null, "value": null, "children": null, "actions": null   // ← ЯВНЫЕ null
  } }
```

Ожидалось: над блоком вкладок появляется жирная надпись «Заявка исполнена на …».
Фактически: надписи нет. В консоли — `[sdui] malformed patch` с этим `insertNode`.

---

## 2. Первопричина

`src/features/sdui/lib/validation.ts` → `validatePatches()` прогоняет каждый патч через zod-схему `viewPatchSchema`. Для `insertNode` (и `replaceNode`) вложенное поле `node` валидируется схемой **`viewNodeSchema`**, где `binding`/`value`/`props`/`actions`/`children` объявлены через **`.optional()`**.

`.optional()` в zod принимает `string | undefined` — но **НЕ `null`**. А бэкенд (Jackson) сериализует узлы с **явными `null`** в отсутствующих полях (`binding: null`, `children: null`, `actions: null`, …), а не опускает их. Поэтому:

- `viewNodeSchema.safeParse(node)` **падает** (на `binding: null`, `children: null`, `actions: null`);
- значит весь `insertNode`-патч не проходит `viewPatchSchema` → `validatePatches` его **отбрасывает** (`console.warn('[sdui] malformed patch', …)`);
- `label.ispolneno` никогда не вставляется.

**Почему базовый `tree` при этом рендерится нормально** (в нём те же `null`): дерево из OPEN-ответа кладётся через `setRoot(res.tree)` **БЕЗ** прохождения через `validatePatches`. Валидируются только **патчи**. Поэтому баг проявляется исключительно на динамически вставляемых/заменяемых узлах (`insertNode`/`replaceNode`), а статичные узлы дерева не затронуты.

Затрагивает: **все** `insertNode`/`replaceNode`-патчи, чей `node` содержит null-поля (т.е. практически любой серверный узел) — не только статус заявки.

---

## 3. Исправление

Файл `src/features/sdui/lib/validation.ts`, схема `viewNodeSchema`: заменить `.optional()` → `.nullish()` для полей, которые бэк может слать как `null` (`.nullish()` = `null | undefined`). Заодно `action.command`.

**Было:**
```ts
const viewNodeSchema: z.ZodType<ViewNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    binding: z.string().optional(),
    value: z.unknown().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    actions: z
      .array(
        z.object({
          trigger: z.string(),
          actionId: z.string(),
          command: z.string().optional(),
        }),
      )
      .optional(),
    children: z.array(viewNodeSchema).optional(),
  }),
) as z.ZodType<ViewNode>
```

**Стало:**
```ts
const viewNodeSchema: z.ZodType<ViewNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    // Бэк (Jackson) сериализует узлы с ЯВНЫМИ null (binding:null, children:null,
    // actions:null, ...), а не с отсутствующими полями. Базовый tree идёт через setRoot
    // без валидации, но узлы внутри insertNode/replaceNode-патчей валидируются здесь —
    // поэтому optional-поля должны принимать И null (.nullish), иначе весь патч молча
    // отбрасывается как malformed (напр. insertNode label.ispolneno не вставлялся).
    binding: z.string().nullish(),
    value: z.unknown().nullish(),
    props: z.record(z.string(), z.unknown()).nullish(),
    actions: z
      .array(
        z.object({
          trigger: z.string(),
          actionId: z.string(),
          command: z.string().nullish(),
        }),
      )
      .nullish(),
    children: z.array(viewNodeSchema).nullish(),
  }),
) as z.ZodType<ViewNode>
```

Только это одно изменение. Схемы самих патчей (`viewPatchSchema`) и `patch-applier.ts` трогать не нужно — там `insertNode` уже применяется корректно, проблема была строго на этапе валидации.

### Заметки по TypeScript
- `viewNodeSchema` уже приведён `as z.ZodType<ViewNode>` — приведение сохраняется, `.nullish()` его не ломает (расширение, а не сужение).
- Если `ViewNode`-тип объявляет эти поля как `field?: T` (optional, без `null`), это ок: применение патчей всё равно проходит через `as ViewPatch`; при желании можно расширить тип до `field?: T | null` для строгости, но для фикса это не обязательно.

---

## 4. Приёмка

```bash
# в корне fin-web
npm run build     # tsc + vite build — зелёный typecheck
```

Проверка поведения (после деплоя бэка с фиксом остатка — см. ниже):
1. Открыть проведённую ЗаявкуГП с «Сумма 1-й год» > 0 → над блоком вкладок видна жирная надпись «Заявка исполнена на X из Y». В консоли больше нет `[sdui] malformed patch` для этого патча.
2. Регресс: обычные формы, где узлы приходят в базовом `tree`, рендерятся как раньше (изменение затрагивает только валидацию патчей, не рендер).
3. Юнит-тест (опционально, есть `validation.test.ts` / `patch-applier.test.ts`): `validatePatches` пропускает `insertNode`/`replaceNode`, чей `node` содержит `binding:null`, `children:null`, `actions:null` (раньше отбрасывался).

---

## 5. Зависимость от бэка (контекст, не действие фронта)

Статус заявки станет виден только при обоих условиях:
- **этот фронт-фикс** (иначе патч отбрасывается на валидации);
- **бэк** уже отдаёт `insertNode` статуса (починены: чтение остатка РН `ВзаиморасчетыПоЗаявкам` — был untyped-параметр `:filter`; fallback-статус при недоступном остатке). Бэк-часть готова и задеплоена отдельно.

Фронт-фикс самодостаточен и полезен независимо: он разблокирует **все** `insertNode`/`replaceNode`-патчи (динамические LABEL-статусы, вставки строк/узлов и т.п.), которые молча не применялись.
