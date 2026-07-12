import { describe, expect, it } from 'vitest'

import type { DocumentAttribute } from '@/entities/document-type'

import { resolveInventoryRecalc, computeInventory } from './inventory-recalc'

const col = (code: string): DocumentAttribute =>
  ({ code, code1C: '', dataType: 'STRING' }) as DocumentAttribute

describe('resolveInventoryRecalc', () => {
  it('находит все шесть колонок инвентаризации', () => {
    const cfg = resolveInventoryRecalc([
      col('NalichiePoDannymUcheta'),
      col('NalichiePoFakticheskimDannym'),
      col('StoimostPoDannymUcheta'),
      col('StoimostPoFakticheskimDannym'),
      col('IzlishkiNedostachaKolichestvo'),
      col('IzlishkiNedostachiStoimost'),
    ])
    expect(cfg).toEqual({
      uchetCol: 'NalichiePoDannymUcheta',
      faktCol: 'NalichiePoFakticheskimDannym',
      stoimUchetCol: 'StoimostPoDannymUcheta',
      stoimFaktCol: 'StoimostPoFakticheskimDannym',
      kolCol: 'IzlishkiNedostachaKolichestvo',
      stoimResultCol: 'IzlishkiNedostachiStoimost',
    })
  })

  it('нет одной из колонок → null', () => {
    expect(
      resolveInventoryRecalc([
        col('NalichiePoDannymUcheta'),
        col('NalichiePoFakticheskimDannym'),
      ])
    ).toBeNull()
  })
})

describe('computeInventory', () => {
  it('учёт ✓, факт ☐ → недостача −1, стоимость по учёту', () => {
    expect(computeInventory(true, false, 1000, 0)).toEqual({ kol: -1, stoim: 1000 })
  })

  it('учёт ☐, факт ✓ → излишки +1, стоимость по факту (учёт=0)', () => {
    expect(computeInventory(false, true, 0, 800)).toEqual({ kol: 1, stoim: 800 })
  })

  it('наличие совпадает → 0, стоимость 0', () => {
    expect(computeInventory(true, true, 1000, 900)).toEqual({ kol: 0, stoim: 0 })
    expect(computeInventory(false, false, 0, 0)).toEqual({ kol: 0, stoim: 0 })
  })

  it('при недостаче: учёт=0 → берём стоимость по факту', () => {
    expect(computeInventory(true, false, 0, 500)).toEqual({ kol: -1, stoim: 500 })
  })

  it('пустые/нечисловые стоимости → 0', () => {
    expect(computeInventory(false, true, '', null)).toEqual({ kol: 1, stoim: 0 })
  })
})
