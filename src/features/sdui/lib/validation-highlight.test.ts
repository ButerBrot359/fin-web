import { describe, expect, it } from 'vitest'

import type { ValidationErrorDetail, ViewNode } from '../types/view'
import {
  buildValidationErrorPatches,
  findNodeIdByBinding,
} from './validation-highlight'

const tree: ViewNode = {
  id: 'form',
  type: 'FORM',
  children: [
    {
      id: 'form.f.istochnik',
      type: 'REFERENCE_FIELD',
      binding: 'IstochnikFinansirovaniya',
    },
    { id: 'form.f.mol', type: 'REFERENCE_FIELD', binding: 'MOL' },
    {
      id: 'form.t.tmz',
      type: 'TABLE',
      binding: 'TMZ',
      children: [
        { id: 'form.t.tmz.col.mol', type: 'TABLE_COLUMN', binding: 'MOL' },
        {
          id: 'form.t.tmz.col.spetsifika',
          type: 'TABLE_COLUMN',
          binding: 'Spetsifika',
        },
      ],
    },
  ],
} as unknown as ViewNode

const err = (
  attributeCode: string | null,
  message: string
): ValidationErrorDetail => ({ attributeCode, message })

describe('findNodeIdByBinding', () => {
  it('находит поле шапки', () => {
    expect(findNodeIdByBinding(tree, 'IstochnikFinansirovaniya')).toBe(
      'form.f.istochnik'
    )
  })

  it('находит табличную часть по её коду', () => {
    expect(findNodeIdByBinding(tree, 'TMZ')).toBe('form.t.tmz')
  })

  it('колонки ТЧ не резолвятся: attributeCode колонкой не бывает', () => {
    expect(findNodeIdByBinding(tree, 'Spetsifika')).toBeNull()
  })

  it('MOL строки не уводит на одноимённую колонку — берётся поле шапки', () => {
    expect(findNodeIdByBinding(tree, 'MOL')).toBe('form.f.mol')
  })

  it('регистр значим', () => {
    expect(findNodeIdByBinding(tree, 'istochnikfinansirovaniya')).toBeNull()
  })
})

describe('buildValidationErrorPatches', () => {
  it('поле шапки и ТЧ помечаются текстом message', () => {
    expect(
      buildValidationErrorPatches(tree, [
        err('IstochnikFinansirovaniya', 'Не заполнен реквизит шапки'),
        err('TMZ', 'Не заполнено движение ТМЗ (строка 1).'),
      ])
    ).toEqual([
      {
        op: 'setProp',
        nodeId: 'form.f.istochnik',
        key: 'error',
        value: 'Не заполнен реквизит шапки',
      },
      {
        op: 'setProp',
        nodeId: 'form.t.tmz',
        key: 'error',
        value: 'Не заполнено движение ТМЗ (строка 1).',
      },
    ])
  })

  it('attributeCode=null — сообщение про документ целиком, патчей нет', () => {
    expect(
      buildValidationErrorPatches(tree, [
        err(null, 'По документу есть подчинённые документы'),
      ])
    ).toEqual([])
  })

  it('неизвестный код пропускается, остальные применяются', () => {
    const patches = buildValidationErrorPatches(tree, [
      err('NetTakogo', 'нет узла'),
      err('MOL', 'Не заполнен МОЛ'),
    ])
    expect(patches).toEqual([
      {
        op: 'setProp',
        nodeId: 'form.f.mol',
        key: 'error',
        value: 'Не заполнен МОЛ',
      },
    ])
  })

  it('два сообщения на один узел: побеждает первое', () => {
    const patches = buildValidationErrorPatches(tree, [
      err('TMZ', 'строка 1'),
      err('TMZ', 'строка 2'),
    ])
    expect(patches).toHaveLength(1)
    expect(patches[0].value).toBe('строка 1')
  })

  it('пустой массив и отсутствие дерева — пусто', () => {
    expect(buildValidationErrorPatches(tree, [])).toEqual([])
    expect(buildValidationErrorPatches(null, [err('MOL', 'x')])).toEqual([])
  })
})
