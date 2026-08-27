import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { DocumentAttribute } from '@/entities/document-type'
import { useDocumentColumns } from './use-document-columns'
import { TABEL_COLUMN_ORDER } from '../consts/tabel-list'

vi.mock(import('react-i18next'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'ru' },
    }),
  } as unknown as typeof actual
})

const attr = (code: string, tableSortOrder: number): DocumentAttribute =>
  ({
    code,
    nameRu: code,
    nameKz: code,
    showInList: true,
    tableSortOrder,
  }) as unknown as DocumentAttribute

describe('useDocumentColumns: Tabel-порядок 1С (SCRUM-276 §3.2)', () => {
  // metadata отдаёт колонки не в 1С-порядке
  const attributes = [
    attr('Kommentariy', 1),
    attr('Nomer', 2),
    attr('Data', 3),
    attr('NeizvestnyyAtribut', 4),
    attr('Organizatsiya', 5),
  ]

  it('без опций — порядок metadata (tableSortOrder) и статус-колонка', () => {
    const { result } = renderHook(() => useDocumentColumns(attributes))
    expect(result.current.map((c) => c.id)).toEqual([
      'status',
      'Kommentariy',
      'Nomer',
      'Data',
      'NeizvestnyyAtribut',
      'Organizatsiya',
      'nameRu',
    ])
  })

  it('columnOrder переставляет известные коды, неизвестные — после, «Ссылка» замыкает', () => {
    const { result } = renderHook(() =>
      useDocumentColumns(attributes, {
        columnOrder: TABEL_COLUMN_ORDER,
        hideStatus: true,
      })
    )
    expect(result.current.map((c) => c.id)).toEqual([
      'Data',
      'Nomer',
      'Organizatsiya',
      'Kommentariy',
      'NeizvestnyyAtribut',
      'nameRu',
    ])
  })

  it('hideStatus убирает колонку «Проведён» только по явной опции', () => {
    const { result } = renderHook(() =>
      useDocumentColumns(attributes, { hideStatus: true })
    )
    expect(result.current.some((c) => c.id === 'status')).toBe(false)
  })
})
