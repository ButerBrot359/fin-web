import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearFormSession,
  readFormSession,
  saveFormSession,
} from './form-session-storage'

describe('form-session-storage (SCRUM-330 Работа 2)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('roundtrip: save → read по тому же роуту', () => {
    saveFormSession('/documents/X/1', 'fs-1')
    expect(readFormSession('/documents/X/1')).toBe('fs-1')
  })

  it('ключи независимы по роуту (включая query)', () => {
    saveFormSession('/documents/X/new?basisId=1', 'fs-a')
    saveFormSession('/documents/X/new?basisId=2', 'fs-b')
    expect(readFormSession('/documents/X/new?basisId=1')).toBe('fs-a')
    expect(readFormSession('/documents/X/new?basisId=2')).toBe('fs-b')
  })

  it('clear удаляет только свой роут; чужого ключа нет — null', () => {
    saveFormSession('/a', 'fs-1')
    saveFormSession('/b', 'fs-2')
    clearFormSession('/a')
    expect(readFormSession('/a')).toBeNull()
    expect(readFormSession('/b')).toBe('fs-2')
  })
})
