import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  postDocumentEntry: vi.fn(),
  unpostDocumentEntry: vi.fn(),
}))
vi.mock('@/features/sdui', () => ({ openMovementsForEntry: vi.fn() }))
vi.mock('@/shared/lib/query/invalidate-entities', () => ({
  invalidateDocumentQueries: vi.fn(),
  invalidateDocumentListQueries: vi.fn(),
}))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
vi.mock('@/shared/api/api', () => ({ apiService: { get: vi.fn() } }))
vi.mock('@/widgets/document-form-toolbar', () => ({
  PrintDropdownButton: () => null,
}))
vi.mock('./select-operation-dialog', () => ({
  SelectOperationDialog: () => null,
}))
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
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={rest['aria-label']}
    >
      {children}
    </button>
  ),
  DropdownButton: ({
    label,
    onClick,
  }: {
    label: string
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  }) => <button onClick={onClick}>{label}</button>,
}))
vi.mock('@/shared/ui/inputs', () => ({
  SearchInput: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  }) => <input aria-label="search" value={value} onChange={onChange} />,
}))
vi.mock('@/shared/assets/icons/copy-doc.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/debet-kredit.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/icons/layers.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ pageCode: 'P', moduleCode: 'PriemNaRabotuSpiskom' }),
}))
vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn: (id: number) => unknown }) => ({
    mutate: (id: number) => {
      void mutationFn(id)
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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

  it('keeps unpost disabled for a selected unposted document', () => {
    render(
      <DocumentListToolbar selectedRowId={42} selectedRowIsPosted={false} />
    )

    expect(
      screen.getByText('documentListToolbar.unpost').hasAttribute('disabled')
    ).toBe(true)
  })

  it('enables unpost for a selected posted document', () => {
    render(<DocumentListToolbar selectedRowId={42} selectedRowIsPosted />)

    expect(
      screen.getByText('documentListToolbar.unpost').hasAttribute('disabled')
    ).toBe(false)
  })

  it('enables post only for a selected unposted document', () => {
    const { rerender } = render(
      <DocumentListToolbar selectedRowId={42} selectedRowIsPosted={false} />
    )
    expect(
      screen.getByText('documentFormToolbar.post').hasAttribute('disabled')
    ).toBe(false)

    rerender(<DocumentListToolbar selectedRowId={42} selectedRowIsPosted />)
    expect(
      screen.getByText('documentFormToolbar.post').hasAttribute('disabled')
    ).toBe(true)
  })

  it('opens 1C-equivalent refresh and list-settings actions from More', async () => {
    const { invalidateDocumentListQueries } =
      await import('@/shared/lib/query/invalidate-entities')
    const onOpenListSettings = vi.fn()
    render(<DocumentListToolbar onOpenListSettings={onOpenListSettings} />)

    fireEvent.click(screen.getByText('documentListToolbar.more'))
    fireEvent.click(screen.getByText('documentListToolbar.refresh'))
    expect(invalidateDocumentListQueries).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('documentListToolbar.more'))
    fireEvent.click(screen.getByText('documentListToolbar.configureList'))
    expect(onOpenListSettings).toHaveBeenCalledTimes(1)
  })

  it('opens the 1C-style list-output dialog from More', () => {
    const onOpenListOutput = vi.fn()
    render(<DocumentListToolbar onOpenListOutput={onOpenListOutput} />)

    fireEvent.click(screen.getByText('documentListToolbar.more'))
    fireEvent.click(screen.getByText('documentListToolbar.outputList'))

    expect(onOpenListOutput).toHaveBeenCalledTimes(1)
  })

  it('shows Edit selected only for the list that explicitly provides the receiver', () => {
    const onEditSelected = vi.fn()
    render(<DocumentListToolbar onEditSelected={onEditSelected} />)

    fireEvent.click(screen.getByText('documentListToolbar.more'))
    fireEvent.click(screen.getByText('documentListToolbar.editSelected'))

    expect(onEditSelected).toHaveBeenCalledTimes(1)
  })

  it('shows the period command only for a list that explicitly supports it', () => {
    const onOpenPeriod = vi.fn()
    const { rerender } = render(<DocumentListToolbar />)

    fireEvent.click(screen.getByText('documentListToolbar.more'))
    expect(screen.queryByText('documentListToolbar.setPeriod')).toBeNull()

    rerender(<DocumentListToolbar onOpenPeriod={onOpenPeriod} />)
    fireEvent.click(screen.getByText('documentListToolbar.more'))
    fireEvent.click(screen.getByText('documentListToolbar.setPeriod'))
    expect(onOpenPeriod).toHaveBeenCalledTimes(1)
  })

  it('forwards quick search text and lets More cancel it', () => {
    const onSearchChange = vi.fn()
    const onClearSearch = vi.fn()
    render(
      <DocumentListToolbar
        searchValue="табель"
        onSearchChange={onSearchChange}
        onClearSearch={onClearSearch}
      />
    )

    fireEvent.change(screen.getByLabelText('search'), {
      target: { value: 'август' },
    })
    expect(onSearchChange).toHaveBeenCalledWith('август')

    fireEvent.click(screen.getByText('documentListToolbar.more'))
    fireEvent.click(screen.getByText('documentListToolbar.cancelSearch'))
    expect(onClearSearch).toHaveBeenCalledTimes(1)
  })

  it('opens the selected-document movements report from Reports', async () => {
    const { openMovementsForEntry } = await import('@/features/sdui')
    render(<DocumentListToolbar selectedRowId={42} />)

    fireEvent.click(screen.getByText('documentListToolbar.reports'))
    fireEvent.click(screen.getByText('documentListToolbar.movementsReport'))

    expect(openMovementsForEntry).toHaveBeenCalledWith('42')
  })
})
