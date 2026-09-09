import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Читает фикстуру `mockApi` из tests/visual/fixtures/<name> через
 * readFileSync + JSON.parse (не `import ... assert { type: 'json' }`) —
 * json-импорт спорит с текущим tsconfig этого проекта (см. README).
 */
export function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join('tests/visual/fixtures', name), 'utf-8')
  ) as Record<string, unknown>
}
