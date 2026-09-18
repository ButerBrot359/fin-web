import { describe, expect, it } from 'vitest'

import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'
import { mergePatchLayers } from './merge-patch-layers'

const entry = (
  nodeId: string,
  props: Record<string, unknown>
): ViewSettingsPatchEntry => ({ nodeId, props })

describe('mergePatchLayers: слияние ролевого слоя поверх «для всех»', () => {
  it('пустой слой уступает другому целиком', () => {
    const base = [entry('a', { visible: false })]
    const override = [entry('b', { width: 200 })]

    expect(mergePatchLayers([], override)).toEqual(override)
    expect(mergePatchLayers(base, [])).toEqual(base)
    expect(mergePatchLayers([], [])).toEqual([])
  })

  it('пропы одной ноды объединяются, а не заменяются целиком', () => {
    const merged = mergePatchLayers(
      [entry('a', { visible: false, width: 160 })],
      [entry('a', { width: 320 })]
    )

    // visible из базы выжил, width перекрыт ролевым слоем.
    expect(merged).toEqual([entry('a', { visible: false, width: 320 })])
  })

  it('override приоритетен при конфликте, уникальные ноды обоих слоёв сохраняются', () => {
    const merged = mergePatchLayers(
      [entry('a', { order: 1 }), entry('onlyBase', { visible: false })],
      [entry('a', { order: 5 }), entry('onlyOverride', { colSpan: 12 })]
    )
    const byId = new Map(merged.map((e) => [e.nodeId, e.props]))

    expect(byId.get('a')).toEqual({ order: 5 })
    expect(byId.get('onlyBase')).toEqual({ visible: false })
    expect(byId.get('onlyOverride')).toEqual({ colSpan: 12 })
    expect(merged).toHaveLength(3)
  })

  it('порядок: сначала ноды базы (на своих местах), потом новые из override', () => {
    const merged = mergePatchLayers(
      [entry('a', { order: 1 }), entry('b', { order: 2 })],
      [entry('c', { order: 3 }), entry('b', { order: 9 })]
    )

    expect(merged.map((e) => e.nodeId)).toEqual(['a', 'b', 'c'])
  })

  it('результат не разделяет объекты props с входами (мутации безопасны)', () => {
    const base = [entry('a', { visible: false })]
    const override = [entry('a', { width: 100 }), entry('b', { order: 0 })]

    const merged = mergePatchLayers(base, override)
    for (const e of merged) e.props.touched = true

    expect(base[0].props.touched).toBeUndefined()
    expect(override[0].props.touched).toBeUndefined()
    expect(override[1].props.touched).toBeUndefined()
  })
})
