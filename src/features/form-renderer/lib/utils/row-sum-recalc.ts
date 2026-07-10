import type { DocumentAttribute } from '@/entities/document-type'

/**
 * Колонки ТЧ для пересчёта «Сумма = Цена × Количество» (канонические токены
 * Suma/Tsena/Kolichestvo). Значения — коды колонок этой ТЧ.
 */
export interface SumRecalcConfig {
  qty: string
  price: string
  sum: string
}

// Канонический токен колонки определяем по 1С-имени (`code1C`, стабильно) с
// фолбэком на суффикс транслит-кода (Kolichestvo/Tsena/Summa|Suma).
const matchQty = (c: DocumentAttribute) =>
  c.code1C === 'Количество' || /kolichestvo$/i.test(c.code)
const matchPrice = (c: DocumentAttribute) =>
  c.code1C === 'Цена' || /(?:tsena|cena)$/i.test(c.code)
const matchSum = (c: DocumentAttribute) =>
  c.code1C === 'Сумма' || /sum+a$/i.test(c.code)

/**
 * Находит колонки Количество/Цена/Сумма ТЧ. Возвращает null, если нет хотя бы
 * одной из трёх (тогда пересчёт не применяется — ТЧ без цены/суммы).
 */
export const resolveSumRecalc = (
  columns: DocumentAttribute[]
): SumRecalcConfig | null => {
  const qty = columns.find(matchQty)?.code
  const price = columns.find(matchPrice)?.code
  const sum = columns.find(matchSum)?.code
  return qty && price && sum ? { qty, price, sum } : null
}

/** Сумма = Цена × Количество, округление до копеек. Пустые/нечисловые → 0. */
export const computeRowSum = (qty: unknown, price: unknown): number => {
  const q = Number(qty) || 0
  const p = Number(price) || 0
  return Math.round(q * p * 100) / 100
}
