import { roundTo } from './evaluate-expression'

const groupThousands = (intPart: string): string =>
  intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/**
 * Число в том же виде, в каком его показывает числовое поле: разряды через
 * пробел, дробная часть через запятую.
 *
 * `decimals` — разрядность поля (`props.precision`): до неё округляем и ею же
 * дополняем хвостовыми нулями. `pad: false` — для подстановки результата обратно
 * в строку выражения, где хвостовые нули только мешают читать.
 */
export const formatCalcNumber = (
  value: number,
  decimals: number,
  pad = true
): string => {
  if (!Number.isFinite(value)) return ''

  const rounded = roundTo(value, decimals)
  const fixed = rounded.toFixed(decimals)
  const [intPart, decPart = ''] = fixed.split('.')
  const negative = intPart.startsWith('-')
  const digits = negative ? intPart.slice(1) : intPart

  const tail = pad ? decPart : decPart.replace(/0+$/, '')
  const sign = negative && Number(fixed) !== 0 ? '-' : ''

  return sign + groupThousands(digits) + (tail ? ',' + tail : '')
}

/** Строка для поля-владельца: точка-разделитель, без разрядных пробелов. */
export const toFieldValue = (value: number, decimals: number): string =>
  String(roundTo(value, decimals))
