import { describe, expect, it } from 'vitest'

import type { NodeDecision } from './collect-customizable-nodes'
import { zoneDecisions, type GridZone } from './grid-zones'

const item = (nodeId: string, homeZoneId: string, span = 12) => ({
  nodeId,
  label: nodeId,
  span,
  hidden: false,
  homeZoneId,
})

describe('zoneDecisions: перенос между зонами (словарь v3)', () => {
  it('элемент в чужой зоне получает moveTo на неё, в родной — не получает', () => {
    const zones: GridZone[] = [
      {
        zoneId: 'grid.header',
        title: '',
        rows: [[item('a', 'grid.header')]],
      },
      {
        zoneId: 'group.podval',
        title: '',
        rows: [[item('b', 'grid.header'), item('c', 'group.podval')]],
      },
    ]
    const decisions = new Map<string, NodeDecision>()

    zoneDecisions(zones, decisions)

    expect(decisions.get('a')?.moveTo).toBeUndefined()
    expect(decisions.get('b')?.moveTo).toBe('group.podval')
    expect(decisions.get('c')?.moveTo).toBeUndefined()
  })
})
