import { describe, expect, it } from 'vitest'

import type { MenuStructure } from '../../api/menu-settings-api'

import {
  buildPatch,
  moveItem,
  seedDraft,
  toggleHidden,
} from './menu-editor-state'

const structure: MenuStructure = {
  patch: {},
  modules: [
    {
      key: 'module:A',
      code: 'A',
      nameRu: 'А',
      nameKz: null,
      iconCode: null,
      effectiveHidden: false,
      sections: [
        {
          key: 'section:A/s1',
          nameRu: 'С1',
          nameKz: null,
          effectiveHidden: false,
          elements: [
            {
              key: 'element:A/s1/e1',
              nameRu: 'Э1',
              nameKz: null,
              effectiveHidden: false,
            },
            {
              key: 'element:A/s1/e2',
              nameRu: 'Э2',
              nameKz: null,
              effectiveHidden: false,
            },
          ],
        },
      ],
    },
    {
      key: 'module:B',
      code: 'B',
      nameRu: 'Б',
      nameKz: null,
      iconCode: null,
      effectiveHidden: false,
      sections: [],
    },
  ],
}

describe('menu-editor-state', () => {
  it('без изменений buildPatch пуст', () => {
    expect(buildPatch(structure, seedDraft(structure))).toEqual({})
  })

  it('скрытие пишет hidden:true, повторный тумблер убирает запись', () => {
    let draft = toggleHidden(seedDraft(structure), 'module:B', false)
    expect(buildPatch(structure, draft)).toEqual({
      'module:B': { hidden: true },
    })
    draft = toggleHidden(draft, 'module:B', false)
    expect(buildPatch(structure, draft)).toEqual({})
  })

  it('показ пункта, скрытого нижним слоем, пишет hidden:false', () => {
    const draft = toggleHidden(seedDraft(structure), 'module:B', true)
    expect(buildPatch(structure, draft)).toEqual({
      'module:B': { hidden: false },
    })
  })

  it('перестановка пишет order всем детям родителя', () => {
    const draft = moveItem(seedDraft(structure), '', 'module:B', -1)
    expect(buildPatch(structure, draft)).toEqual({
      'module:B': { order: 0 },
      'module:A': { order: 1 },
    })
  })

  it('перестановка элементов внутри секции не трогает соседние уровни', () => {
    const draft = moveItem(
      seedDraft(structure),
      'section:A/s1',
      'element:A/s1/e2',
      -1
    )
    expect(buildPatch(structure, draft)).toEqual({
      'element:A/s1/e2': { order: 0 },
      'element:A/s1/e1': { order: 1 },
    })
  })

  it('движение за край списка ничего не меняет', () => {
    const draft = moveItem(seedDraft(structure), '', 'module:A', -1)
    expect(buildPatch(structure, draft)).toEqual({})
  })

  it('seedDraft восстанавливает существующий патч слоя (hidden и order)', () => {
    const withPatch: MenuStructure = {
      ...structure,
      patch: { 'module:B': { hidden: true }, 'module:A': { order: 1 } },
    }
    const draft = seedDraft(withPatch)
    expect(buildPatch(withPatch, draft)).toEqual({
      'module:B': { hidden: true },
      'module:A': { order: 1 },
    })
  })
})
