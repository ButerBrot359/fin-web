# Fix: Polytable fields not updating from form event handler

## Problem

When a field with `formEvent` changes, the backend returns updated attribute values via `handle-event` endpoint. `useFormEvents` applies them with `form.setValue(key, value)`. This works for scalar fields, but TABLE (Polytable) attributes use `useFieldArray`, which maintains its own internal state. `form.setValue` does not synchronize `useFieldArray`'s `fields` array, so the UI does not reflect the updated table data.

## Approach

Provide `useFormEvents` with direct access to each table's `replace()` function from `useFieldArray`. When the event response contains a table attribute, call `replace(rows)` instead of `form.setValue`.

## Design

### 1. Registration mechanism via FormRendererContext

`FormRenderer` creates a `useRef<Map<string, (rows: Record<string, unknown>[]) => void>>` — a map from attribute code to `replace` function. Two helpers are passed through context:

- `registerTableReplacer(code, replaceFn)` — adds entry to the map
- `unregisterTableReplacer(code)` — removes entry from the map

Using a ref (not state) avoids re-renders on registration.

### 2. useFormEvents uses replacers

`useFormEvents` receives `tableReplacersRef` as a parameter. In `onSuccess`:

```
for each (key, value) in response attributes:
  if tableReplacersRef has key AND value is array:
    call replacer(value)
  else:
    form.setValue(key, value)
```

### 3. TableField registers on mount

`TableField` calls `registerTableReplacer(attribute.code, replace)` on mount and `unregisterTableReplacer(attribute.code)` on unmount via `useEffect`.

### 4. Existing sync logic unchanged

The `hasSynced` + `form.watch` mechanism in `TableField` remains — it handles initial data load on `form.reset`. The new mechanism handles event-driven updates.

## Files changed

1. `src/features/form-renderer/types/renderer-context.ts` — add register/unregister to context type
2. `src/features/form-renderer/ui/form-renderer.tsx` — create ref, pass to context and useFormEvents
3. `src/features/form-renderer/lib/hooks/use-form-events.ts` — accept ref, use replacer in onSuccess
4. `src/features/form-renderer/ui/table-field.tsx` — register/unregister replace on mount/unmount
