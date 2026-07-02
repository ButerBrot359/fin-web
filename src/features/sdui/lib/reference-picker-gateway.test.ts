import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  openReferencePicker,
  setReferencePickerGateway,
  type ReferencePickerRequest,
} from './reference-picker-gateway'

describe('reference-picker-gateway', () => {
  afterEach(() => setReferencePickerGateway(null))

  it('передаёт запрос зарегистрированному gateway', () => {
    const g = vi.fn()
    setReferencePickerGateway(g)
    const req: ReferencePickerRequest = {
      mode: 'list',
      domain: 'DICTIONARY',
      typeCode: 'X',
      onSelect: () => {},
    }
    openReferencePicker(req)
    expect(g).toHaveBeenCalledWith(req)
  })

  it('молча игнорирует вызов без gateway (не бросает)', () => {
    expect(() =>
      openReferencePicker({ mode: 'list', domain: 'D', typeCode: 'X', onSelect: () => {} }),
    ).not.toThrow()
  })
})
