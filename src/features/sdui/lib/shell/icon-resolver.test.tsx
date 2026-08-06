import { describe, it, expect, vi } from 'vitest'

vi.mock('@/shared/assets/navigation/main.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/navigation/bank.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/navigation/warehouse.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/actives.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/salary.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/report.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/regulated-fin-report.svg', () => ({
  default: () => null,
}))

import { resolveShellIcon } from './icon-resolver'
import MainIcon from '@/shared/assets/navigation/main.svg'
import BankIcon from '@/shared/assets/navigation/bank.svg'

describe('resolveShellIcon', () => {
  it('известное имя → соответствующий ассет', () => {
    expect(resolveShellIcon('bank')).toBe(BankIcon)
  })

  it('home → main.svg', () => {
    expect(resolveShellIcon('home')).toBe(MainIcon)
  })

  it('неизвестное имя → fallback (main.svg)', () => {
    expect(resolveShellIcon('does-not-exist')).toBe(MainIcon)
  })

  it('undefined → fallback (main.svg)', () => {
    expect(resolveShellIcon(undefined)).toBe(MainIcon)
  })
})
