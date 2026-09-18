import type { SelectOption } from '@/shared/types/select-option'
import { renderCellValue } from './cell-value'

/**
 * Нормализаторы ссылочного значения `{id, presentation}` ⇄ `SelectOption`.
 *
 * <p>Единая точка для всех потребителей (поле шапки `reference-field-node.tsx`,
 * редактор ячейки `reference-cell-editor.tsx`, панель отбора
 * `selection-list-table.tsx`): контракт значения один — «полный ссылочный
 * объект, не bare id», и его сборка/разбор не должны расходиться по копиям.
 *
 * <p>НЕ сведено сюда намеренно (семантика другая, не дубль):
 * `object-cell-editor.tsx` / `object-field-logic.ts` — составной тип несёт ещё
 * `type`/`targetTypeCode` и собирается `buildObjectValue`.
 */

/** Нормализованное ссылочное значение — то, что уходит в state/на сервер. */
export interface ReferenceValue {
  id: number
  presentation: string
}

/**
 * Минимальная форма ссылочного значения на проводе: id обязателен,
 * presentation может отсутствовать или быть не строкой.
 */
export interface ReferenceLikeValue {
  id: number | string
  presentation?: unknown
}

/** Значение «похоже на ссылку»: объект с полем id. */
export function isReferenceValue(value: unknown): value is ReferenceLikeValue {
  return value !== null && typeof value === 'object' && 'id' in value
}

/**
 * Строгий вариант: вход уже нормализован (`ReferenceValue`), label —
 * presentation как есть. Используется полем шапки, где значение проходит
 * через `toReferenceValue`/серверный контракт.
 */
export function toSelectOption(ref: ReferenceValue): SelectOption {
  return { id: ref.id, code: String(ref.id), label: ref.presentation }
}

/**
 * Толерантный вариант для сырого значения ЯЧЕЙКИ: не-ссылка → null, label —
 * через `renderCellValue` (переживает отсутствующую/нестроковую presentation).
 * НЕ слит со строгим `toSelectOption`: у того label = presentation без
 * фолбэков, и на кривом входе они дают разный результат.
 */
export function referenceToSelectOption(value: unknown): SelectOption | null {
  if (!isReferenceValue(value)) return null
  return {
    id: Number(value.id),
    code: String(value.id),
    label: renderCellValue(value),
  }
}

/** Обратный путь: выбранная опция автокомплита/пикера → значение для state. */
export function fromSelectOption(opt: SelectOption): ReferenceValue {
  return { id: Number(opt.id), presentation: opt.label }
}

// SCRUM-291 §19.3: props.multiple — значение узла в состоянии формы должно
// нормализоваться в массив ReferenceValue независимо от того, в какой форме
// оно там оказалось: сам массив, одиночный объект {id, presentation} (сервер
// когда-то прислал/сохранил его как одиночное значение) или голый скаляр
// number/string (id без presentation). Presentation для голого скаляра
// неизвестна — используем String(id) как заглушку.
export function toReferenceValue(raw: unknown): ReferenceValue | null {
  if (raw == null) return null
  if (typeof raw === 'number' || typeof raw === 'string') {
    return { id: Number(raw), presentation: String(raw) }
  }
  if (typeof raw === 'object' && 'id' in raw) {
    const obj = raw as { id: unknown; presentation?: unknown }
    const presentation =
      typeof obj.presentation === 'string' ||
      typeof obj.presentation === 'number'
        ? String(obj.presentation)
        : String(obj.id)
    return { id: Number(obj.id), presentation }
  }
  return null
}

// Поле над табличной частью ждёт ссылки, но строку ТЧ ({rowId, <колонка>: {id, presentation}})
// сюда приносит любой источник, который не привёл значение к контракту: команда таблицы,
// доменный обработчик, восстановленный черновик. Без разбора по колонке (binding) поле
// рисует пустоту при заполненной табличной части — выбор пользователя выглядит исчезнувшим.
export function toReferenceValueOrRow(
  raw: unknown,
  binding?: string
): ReferenceValue | null {
  const direct = toReferenceValue(raw)
  if (direct || !binding) return direct
  if (raw && typeof raw === 'object' && binding in raw) {
    return toReferenceValue((raw as Record<string, unknown>)[binding])
  }
  return null
}

export function toReferenceArray(
  raw: unknown,
  binding?: string
): ReferenceValue[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => toReferenceValueOrRow(item, binding))
      .filter((v): v is ReferenceValue => v !== null)
  }
  const single = toReferenceValueOrRow(raw, binding)
  return single ? [single] : []
}
