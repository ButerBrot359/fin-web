import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InformationRegisterListToolbar } from './information-register-list-toolbar'

// В vitest svg-импорты резолвятся как data-URI строки (svgr не применяется) —
// мокаем shared-UI и сам svg, иначе <Icon/> получает невалидное имя тега.
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
    onClick?: () => void
  }) => <button onClick={onClick}>{label}</button>,
}))
vi.mock('@/shared/assets/icons/copy-doc.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('@/shared/ui/inputs', () => ({ SearchInput: () => null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const commands = () => ({
  onCreate: vi.fn(),
  onCopy: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRefresh: vi.fn(),
  searchValue: '',
  onSearchChange: vi.fn(),
})

describe('InformationRegisterListToolbar: команды формы списка регистра', () => {
  afterEach(cleanup)

  it('без выделенной строки команды над записью недоступны', () => {
    render(
      <InformationRegisterListToolbar
        {...commands()}
        hasSelection={false}
        isDeleting={false}
      />
    )

    // «Создать» доступна всегда — создать можно без выделения, как в 1С.
    expect(screen.getByText('actions.create')).not.toHaveProperty(
      'disabled',
      true
    )
    expect(screen.getByLabelText('actions.copy')).toHaveProperty(
      'disabled',
      true
    )
    expect(screen.getByText('actions.change')).toHaveProperty('disabled', true)
    expect(screen.getByText('actions.delete')).toHaveProperty('disabled', true)
  })

  it('с выделенной строкой команды зовут свои обработчики', () => {
    const cmd = commands()
    render(
      <InformationRegisterListToolbar
        {...cmd}
        hasSelection
        isDeleting={false}
      />
    )

    fireEvent.click(screen.getByLabelText('actions.copy'))
    fireEvent.click(screen.getByText('actions.change'))
    fireEvent.click(screen.getByText('actions.delete'))

    expect(cmd.onCopy).toHaveBeenCalledOnce()
    expect(cmd.onEdit).toHaveBeenCalledOnce()
    expect(cmd.onDelete).toHaveBeenCalledOnce()
  })

  /** Пока удаление в полёте, повторное нажатие удалило бы запись второй раз. */
  it('во время удаления кнопка «Удалить» заблокирована', () => {
    render(
      <InformationRegisterListToolbar {...commands()} hasSelection isDeleting />
    )

    expect(screen.getByText('actions.delete')).toHaveProperty('disabled', true)
  })

  it('«Ещё» открывает то же меню команд плюс «Обновить»', () => {
    const cmd = commands()
    render(
      <InformationRegisterListToolbar
        {...cmd}
        hasSelection
        isDeleting={false}
      />
    )

    fireEvent.click(screen.getByText('documentListToolbar.more'))

    fireEvent.click(screen.getByText('documentListToolbar.refresh'))
    expect(cmd.onRefresh).toHaveBeenCalledOnce()
  })
})
