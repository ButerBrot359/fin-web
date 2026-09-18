export type CalcErrorCode = 'syntax' | 'divZero' | 'overflow'

export interface CalcResult {
  value: number | null
  error?: CalcErrorCode
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' }
  | { kind: 'paren'; value: '(' | ')' }
  | { kind: 'percent' }

/**
 * Операнд с признаком «это проценты»: `%` меняет смысл в зависимости от
 * операции слева (см. `parseAdditive`/`parseMultiplicative`) — привычная
 * бухгалтерская семантика, а не деление на 100 на месте.
 */
interface Operand {
  value: number
  percent: boolean
}

const NUMBER_RE = /^\d*(?:[.,]\d*)?/

const tokenize = (input: string): Token[] | null => {
  const src = input.replace(/[\s\u00a0]/g, '')
  const tokens: Token[] = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }
    if (ch === 'x' || ch === '×' || ch === '·') {
      tokens.push({ kind: 'op', value: '*' })
      i += 1
      continue
    }
    if (ch === ':' || ch === '÷') {
      tokens.push({ kind: 'op', value: '/' })
      i += 1
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', value: ch })
      i += 1
      continue
    }
    if (ch === '%') {
      tokens.push({ kind: 'percent' })
      i += 1
      continue
    }

    const num = NUMBER_RE.exec(src.slice(i))?.[0]
    if (!num || num === '' || num === '.' || num === ',') return null

    tokens.push({ kind: 'num', value: Number(num.replace(',', '.')) })
    i += num.length
  }

  return tokens
}

class Parser {
  private pos = 0
  private failed = false
  private divByZero = false

  constructor(private readonly tokens: Token[]) {}

  parse(): CalcResult {
    const operand = this.parseAdditive()
    if (this.failed || this.pos !== this.tokens.length) {
      return { value: null, error: 'syntax' }
    }
    if (this.divByZero) return { value: null, error: 'divZero' }

    const value = operand.percent ? operand.value / 100 : operand.value
    if (!Number.isFinite(value)) return { value: null, error: 'overflow' }
    return { value }
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private parseAdditive(): Operand {
    let left = this.parseMultiplicative()

    for (;;) {
      const token = this.peek()
      if (
        token?.kind !== 'op' ||
        (token.value !== '+' && token.value !== '-')
      ) {
        return left
      }
      this.pos += 1
      const right = this.parseMultiplicative()
      if (this.failed) return left

      // «1000 + 12%» = 1000 + 12% от 1000 — то, чего ждёт бухгалтер от наценки,
      // скидки и начисления налога.
      const delta = right.percent
        ? (left.value * right.value) / 100
        : right.value
      left = {
        value: token.value === '+' ? left.value + delta : left.value - delta,
        percent: false,
      }
    }
  }

  private parseMultiplicative(): Operand {
    let left = this.parseUnary()

    for (;;) {
      const token = this.peek()
      if (
        token?.kind !== 'op' ||
        (token.value !== '*' && token.value !== '/')
      ) {
        return left
      }
      this.pos += 1
      const right = this.parseUnary()
      if (this.failed) return left

      const operand = right.percent ? right.value / 100 : right.value
      if (token.value === '/' && operand === 0) {
        this.divByZero = true
        return { value: 0, percent: false }
      }
      left = {
        value:
          token.value === '*' ? left.value * operand : left.value / operand,
        percent: false,
      }
    }
  }

  private parseUnary(): Operand {
    const token = this.peek()
    if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
      this.pos += 1
      const operand = this.parseUnary()
      return {
        value: token.value === '-' ? -operand.value : operand.value,
        percent: operand.percent,
      }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): Operand {
    const operand = this.parsePrimary()
    let percent = operand.percent

    while (this.peek()?.kind === 'percent') {
      this.pos += 1
      percent = true
    }
    return { value: operand.value, percent }
  }

  private parsePrimary(): Operand {
    const token = this.peek()

    if (token?.kind === 'num') {
      this.pos += 1
      return { value: token.value, percent: false }
    }
    if (token?.kind === 'paren' && token.value === '(') {
      this.pos += 1
      const inner = this.parseAdditive()
      const closing = this.peek()
      if (closing?.kind !== 'paren' || closing.value !== ')') {
        this.failed = true
        return { value: 0, percent: false }
      }
      this.pos += 1
      return inner
    }

    this.failed = true
    return { value: 0, percent: false }
  }
}

/**
 * Разбор и вычисление выражения калькулятора: `1200*12+300`, `84000-12%`,
 * `(1000+200)/3`. Разделитель дробной части — запятая или точка, пробелы
 * (в том числе разделители разрядов) игнорируются.
 *
 * Пустая строка — не ошибка, а «ещё ничего не введено»: `{ value: null }`.
 */
export const evaluateExpression = (expression: string): CalcResult => {
  if (expression.replace(/[\s\u00a0]/g, '') === '') return { value: null }

  const tokens = tokenize(expression)
  if (!tokens) return { value: null, error: 'syntax' }

  return new Parser(tokens).parse()
}

/** Округление до разрядности хранилища/поля без плавающего «...9999». */
export const roundTo = (value: number, decimals: number): number => {
  if (!Number.isFinite(value)) return value

  const factor = 10 ** decimals
  const scaled = Math.abs(value) * factor
  // Половина округляется «от нуля» (как в 1С), а не к большему: -2,5 -> -3.
  const rounded = Math.round(scaled + Number.EPSILON * scaled) / factor
  return value < 0 ? -rounded : rounded
}
