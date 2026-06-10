# Bugfix: EVENT для NUMBER/TEXT/TEXT_AREA полей не отправляется

**Статус:** исправлено в трёх файлах (§3).

## 1. Симптом

Изменение поля «Сумма» в форме (или любого `NUMBER_FIELD` / `TEXT_FIELD` / `TEXT_AREA` с триггером) → `Tab` или клик в другое место → **в Network ничего не отправляется**, сервер не реагирует.

При этом изменение `CHECKBOX_FIELD`, `DATE_FIELD`, `DATETIME_FIELD`, `ENUM_FIELD`, `REFERENCE_FIELD` — работает.

## 2. Причина

Бэк присылает у триггерного поля:

```jsonc
"actions": [{ "trigger": "change", "actionId": "fieldEvent" }]
```

Имя триггера — `"change"`.

В `fireServerEvent` проверка идёт по строгому равенству:

```ts
if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
  void dispatch(...)
}
```

В трёх компонентах (number/text/textarea) в `onBlur` передавалось `'blur'`:

```ts
onBlur={() => {
  fireServerEvent('blur', value)   // ← 'blur' ≠ 'change' → EVENT не уходит
}}
```

Сравнение `'blur' === 'change'` ложно — `dispatch` не вызывается.

## 3. Фикс

В `onBlur` передаётся `'change'` вместо `'blur'`. UX не меняется (запрос всё равно идёт только на потерю фокуса), меняется только строка-идентификатор.

Изменены три файла, в каждом — одна строка:

`src/features/sdui/ui/nodes/fields/number-field-node.tsx`

```diff
       onBlur={() => {
-        fireServerEvent('blur', rawValue)
+        fireServerEvent('change', rawValue)
       }}
```

`src/features/sdui/ui/nodes/fields/text-field-node.tsx`

```diff
       onBlur={() => {
-        fireServerEvent('blur', value)
+        fireServerEvent('change', value)
       }}
```

`src/features/sdui/ui/nodes/fields/text-area-node.tsx`

```diff
       onBlur={() => {
-        fireServerEvent('blur', value)
+        fireServerEvent('change', value)
       }}
```

## 4. Как проверить

После пересборки фронта:

1. Открыть документ в браузере, DevTools → Network → фильтр `view`.
2. Изменить «Сумму» → Tab.
3. В Network появляется `POST /api/view` с `action.type: "EVENT"`, `sourceNodeId: "field.summaGod1"`, `trigger: "change"`.
4. В ответе — `setValue("SummaDokumenta", <пересчитанная сумма>)`, поле на форме обновляется.
