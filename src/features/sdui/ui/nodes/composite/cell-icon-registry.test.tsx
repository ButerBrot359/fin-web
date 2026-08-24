import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/assets/icons/folder-icon.svg', () => ({
  default: () => <span data-testid="icon-folder" />,
}))
vi.mock('@/shared/assets/icons/list-element-icon.svg', () => ({
  default: () => <span data-testid="icon-list-element" />,
}))
vi.mock('@/shared/assets/icons/doc-posted.svg', () => ({
  default: () => <span data-testid="icon-doc-posted" />,
}))
vi.mock('@/shared/assets/icons/doc-draft.svg', () => ({
  default: () => <span data-testid="icon-doc-draft" />,
}))
vi.mock('@/shared/assets/icons/doc-deleted.svg', () => ({
  default: () => <span data-testid="icon-doc-deleted" />,
}))

import { getCellIcon } from './cell-icon-registry'

// SCRUM-291 3b (§17.2): реестр имён иконок для cellKind="ICON" — сегодня
// обслуживает глиф группы/элемента иерархического справочника, спроектирован
// на переиспользование под будущую иконку статуса документа (ADR-0035 2e).
describe('getCellIcon', () => {
  it('folder → компонент иконки', () => {
    expect(getCellIcon('folder')).toBeTruthy()
  })

  it('listElement → компонент иконки', () => {
    expect(getCellIcon('listElement')).toBeTruthy()
  })

  // SCRUM-45 §4-бис.2: иконки состояния документа для колонки статуса
  it.each(['docPosted', 'docDraft', 'docDeleted'])(
    '%s → компонент иконки',
    (name) => {
      expect(getCellIcon(name)).toBeTruthy()
    }
  )

  it('неизвестное имя → null (не исключение)', () => {
    expect(getCellIcon('unknownIconName')).toBeNull()
  })

  it('undefined → null', () => {
    expect(getCellIcon(undefined)).toBeNull()
  })
})
