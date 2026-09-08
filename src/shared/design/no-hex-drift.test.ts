import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Страж дрейфа (спека §1.4): literal-цвета запрещены вне канона токенов —
 * hex (3/6/8-значные), rgb()/rgba() и hsl()/hsla(). Комментарии не
 * считаются (упоминания значений с провода легальны в javadoc). Цвета,
 * приходящие данными с провода (textColor ячеек и т.п.), — runtime-строки,
 * литералами в код не попадают и стража не касаются.
 */
const SRC = 'src'
const ALLOWED_FILES = new Set(['src/shared/design/tokens.ts'])

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.(ts|tsx|css)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []
  })

const stripComments = (code: string): string =>
  code
    .split('\n')
    .filter((l) => {
      const s = l.trim()
      return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*')
    })
    .join('\n')

describe('страж дрейфа дизайн-токенов', () => {
  it('literal-цветов (hex/rgb/hsl) нет нигде, кроме tokens.ts', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (ALLOWED_FILES.has(file.replaceAll('\\', '/'))) continue
      const code = stripComments(readFileSync(file, 'utf8'))
      const hits = code.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)
      if (hits) offenders.push(`${file}: ${hits.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })
})
