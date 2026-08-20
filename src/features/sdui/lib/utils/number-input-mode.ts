/**
 * Разрешена ли дробная часть у числового поля — одно правило и для поля формы
 * (`NUMBER_FIELD`), и для ячейки ТЧ.
 *
 * Порядок источников — от явного к умолчанию:
 *   1. `props.precision` — прямое указание бэка: `0` значит «только целое»,
 *      больше нуля — сколько знаков после запятой;
 *   2. `dataType: "INTEGER"` — тоже явное заявление, что дробей быть не может;
 *   3. иначе — разрешаем. Точность неизвестна, а молча запрещать ввод хуже:
 *      именно так «Тарифный коэффициент» глотал запятую (1,02 → 102), хотя в
 *      эталоне 1С поле дробное. Лишнее нормализует сервер.
 *
 * Эталон 1С по этой форме («Начисления работника»): дробные не только
 * коэффициенты (1,02 / 1,30), но и «Ставка» 1,500, «Размер оклада» 85 123,000,
 * колонки ТЧ «Размер» и «Ставка» — то есть правило нужно общее, а не точечное.
 */
export function allowsDecimalInput(
  props: Record<string, unknown> | undefined,
  dataType?: string
): boolean {
  const precision = numberPrecision(props)
  if (precision !== undefined) return precision > 0
  return dataType !== 'INTEGER'
}

/**
 * Разрядность из `props.precision`, если бэк её прислал. У большинства DECIMAL
 * ключа пока нет — разрядность не заполнена в метаданных, и это штатно: тогда
 * поле показывает значение как есть, без дополнения нулями.
 */
export function numberPrecision(
  props: Record<string, unknown> | undefined
): number | undefined {
  const precision = props?.precision
  return typeof precision === 'number' && precision >= 0 ? precision : undefined
}
