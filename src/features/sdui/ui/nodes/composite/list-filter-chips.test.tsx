import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { ListFilterChips } from './list-filter-chips'

// SCRUM-291 2c-b: панель чипов — чистый презентационный компонент. `label`
// приходит с сервера ГОТОВЫМ (заголовок колонки + оператор + презентация
// значения) — компонент обязан рендерить его как есть, не парсить/не
// пересобирать (design §2c, spec §7 «Чипы»).
describe('ListFilterChips', () => {
  afterEach(() => {
    cleanup()
  })

  it('filterChips пуст/отсутствует → ничего не рендерит', () => {
    const { container: emptyArr } = render(
      <ListFilterChips chips={[]} onRemove={vi.fn()} onClearAll={vi.fn()} />
    )
    expect(emptyArr.firstChild).toBeNull()
  })

  it('рендерит label чипа дословно, как пришёл с сервера', () => {
    render(
      <ListFilterChips
        chips={[
          { field: 'Kontragent', label: 'Контрагент равно: ТОО «Ромашка»' },
        ]}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )
    expect(screen.getByText('Контрагент равно: ТОО «Ромашка»')).toBeTruthy()
  })

  it('клик на крестик чипа → onRemove(field) этого чипа', () => {
    const onRemove = vi.fn()
    render(
      <ListFilterChips
        chips={[
          { field: 'Kontragent', label: 'Контрагент равно: ТОО «Ромашка»' },
          { field: 'Status', label: 'Статус равно: Активен' },
        ]}
        onRemove={onRemove}
        onClearAll={vi.fn()}
      />
    )
    const removeButtons = screen.getAllByLabelText('table.filterRemoveChip')
    fireEvent.click(removeButtons[1])

    expect(onRemove).toHaveBeenCalledWith('Status')
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('≥1 чип → «Сбросить все» показана и вызывает onClearAll без аргументов', () => {
    const onClearAll = vi.fn()
    render(
      <ListFilterChips
        chips={[{ field: 'Kontragent', label: 'Контрагент равно: X' }]}
        onRemove={vi.fn()}
        onClearAll={onClearAll}
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'table.filterClearAll' })
    )

    expect(onClearAll).toHaveBeenCalledWith()
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('0 чипов → «Сбросить все» не рендерится', () => {
    render(
      <ListFilterChips chips={[]} onRemove={vi.fn()} onClearAll={vi.fn()} />
    )
    expect(
      screen.queryByRole('button', { name: 'table.filterClearAll' })
    ).toBeNull()
  })
})
