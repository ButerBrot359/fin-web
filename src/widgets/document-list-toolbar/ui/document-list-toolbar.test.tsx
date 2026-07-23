import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DocumentListToolbar } from './document-list-toolbar'

// interactiveCreationForbidden управляется из теста через мок useDocumentType
const docType = { interactiveCreationForbidden: false as boolean | undefined }

vi.mock('@/entities/document-type', () => ({
  useDocumentType: () => docType,
}))
vi.mock('@/entities/document-entry', () => ({
  useDocumentEntryPrint: () => ({
    printCommands: [],
    handlePrint: vi.fn(),
    isPrintLoading: false,
  }),
  unpostDocumentEntry: vi.fn(),
}))
vi.mock('@/features/sdui', () => ({ openMovementsForEntry: vi.fn() }))
vi.mock('@/shared/lib/query/invalidate-entities', () => ({
  invalidateDocumentQueries: vi.fn(),
}))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
vi.mock('@/shared/api/api', () => ({ apiService: { get: vi.fn() } }))
vi.mock('@/widgets/document-form-toolbar', () => ({
  PrintDropdownButton: () => null,
}))
vi.mock('./select-operation-dialog', () => ({ SelectOperationDialog: () => null }))
// В vitest svg-импорты резолвятся как data-URI строки (svgr не применяется).
// Мокаем shared-UI, через которые тулбар тянет svg (Button/Dropdown/SearchInput),
// и сами svg тулбара — иначе <Icon/> получает невалидное имя тега.
vi.mock('@/shared/ui/buttons', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children?: ReactNode
    onClick?: () => void
    disabled?: boolean
    'aria-label'?: string
  }) => (
    <button onClick={onClick} disabled={disabled} aria-label={rest['aria-label']}>
      {children}
    </button>
  ),
  DropdownButton: () => null,
}))
vi.mock('@/shared/ui/inputs', () => ({ SearchInput: () => null }))
vi.mock('@/shared/assets/icons/copy-doc.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/debet-kredit.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/layers.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ pageCode: 'P', moduleCode: 'PriemNaRabotuSpiskom' }),
}))
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({}),
}))

describe('DocumentListToolbar: interactiveCreationForbidden (SCRUM-265 FE-4)', () => {
  afterEach(cleanup)

  it('флаг true → нет «Создать» и «Скопировать»', () => {
    docType.interactiveCreationForbidden = true
    render(<DocumentListToolbar selectedRowId={null} />)
    expect(screen.queryByText('actions.create')).toBeNull()
    expect(screen.queryByLabelText('actions.copy')).toBeNull()
  })

  it('флаг false → кнопки на месте (регресс)', () => {
    docType.interactiveCreationForbidden = false
    render(<DocumentListToolbar selectedRowId={null} />)
    expect(screen.getByText('actions.create')).toBeTruthy()
    expect(screen.getByLabelText('actions.copy')).toBeTruthy()
  })

  it('undefined (старый бэк) → кнопки видимы, регресса нет', () => {
    docType.interactiveCreationForbidden = undefined
    render(<DocumentListToolbar selectedRowId={null} />)
    expect(screen.getByText('actions.create')).toBeTruthy()
  })
})
