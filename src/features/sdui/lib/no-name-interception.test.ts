/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.cwd(), 'src/features/sdui')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('SCRUM-288 §6.1 — нет перехвата команд по именам', () => {
  it('ACTION_BY_COMMAND / isRelatedCommand / handleRelatedCommand отсутствуют', () => {
    const hits = walk(ROOT)
      .filter(
        (f) =>
          /\.(ts|tsx)$/.test(f) && !f.endsWith('no-name-interception.test.ts')
      )
      .filter((f) =>
        /ACTION_BY_COMMAND|isRelatedCommand|handleRelatedCommand/.test(
          readFileSync(f, 'utf8')
        )
      )
    expect(hits).toEqual([])
  })
})
