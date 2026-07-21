import { describe, expect, it } from 'vitest'

import { isRetryableAfterReopen } from './reopen-retry-policy'

describe('isRetryableAfterReopen', () => {
  it('EVENT ретраится — клик/ввод не теряется', () => {
    expect(isRetryableAfterReopen({ type: 'EVENT', value: 'x' }, null)).toBe(true)
  })

  it('навигационная команда (behavior null) ретраится', () => {
    expect(isRetryableAfterReopen({ type: 'COMMAND', command: 'nav.open:X:Y:Z' }, null)).toBe(true)
  })

  it('команда записи (resetsDirty) НЕ ретраится — scratch умер вместе с сессией', () => {
    expect(
      isRetryableAfterReopen({ type: 'COMMAND', command: 'dict.save' }, { resetsDirty: true }),
    ).toBe(false)
  })

  it('команда записи-закрытия (closeAfter) НЕ ретраится', () => {
    expect(
      isRetryableAfterReopen({ type: 'COMMAND', command: 'dict.saveAndClose' }, { closeAfter: true }),
    ).toBe(false)
  })

  it('OPEN и CLOSE не ретраятся', () => {
    expect(isRetryableAfterReopen({ type: 'OPEN' }, null)).toBe(false)
    expect(isRetryableAfterReopen({ type: 'CLOSE' }, null)).toBe(false)
  })
})
