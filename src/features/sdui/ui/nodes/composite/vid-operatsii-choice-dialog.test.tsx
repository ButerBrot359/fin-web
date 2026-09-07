import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { VidOperatsiiChoiceDialog } from './vid-operatsii-choice-dialog'

const dispatch = vi.fn()

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const TYPE = 'NachislenieZarplatySotrudnikam'

const node = (props: Record<string, unknown>): ViewNode =>
  ({ id: `dialog.vidOperatsii.${TYPE}`, type: 'PAGE', props }) as ViewNode

const withOptions = (extra: Record<string, unknown> = {}) =>
  node({
    kind: 'VID_OPERATSII_CHOICE_DIALOG',
    selfChrome: true,
    title: 'Выберите операцию',
    vidOperatsiiOptions: [
      {
        code: 'NachislenieZarplaty',
        name: 'Начисление зарплаты',
        command: `list.createVidOperatsii:${TYPE}:NachislenieZarplaty`,
      },
      {
        code: 'PromezhutochnyeVyplaty',
        name: 'Промежуточные выплаты',
        command: `list.createVidOperatsii:${TYPE}:PromezhutochnyeVyplaty`,
      },
    ],
    vidOperatsiiCancelCommand: `list.cancelVidOperatsii:${TYPE}`,
    ...extra,
  })

/**
 * Окно «Выберите операцию» на SDUI-форме списка — то же, что на легаси-форме
 * (`SelectOperationDialog`): переключатели и «Далее», а не список кнопок.
 */
describe('VidOperatsiiChoiceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('рисует переключатели видов операции и кнопку «Далее»', () => {
    render(<VidOperatsiiChoiceDialog node={withOptions()} />)

    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByText('Начисление зарплаты')).not.toBeNull()
    expect(screen.getByText('Промежуточные выплаты')).not.toBeNull()
    // Пока вид не выбран, «Далее» неактивна — как на легаси-форме списка.
    expect(
      screen
        .getByRole('button', { name: 'selectOperationDialog.next' })
        .hasAttribute('disabled')
    ).toBe(true)
  })

  it('выбранный вид уходит своей командой по «Далее»', () => {
    render(<VidOperatsiiChoiceDialog node={withOptions()} />)

    fireEvent.click(
      screen.getByRole('radio', { name: 'Промежуточные выплаты' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'selectOperationDialog.next' })
    )

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: `list.createVidOperatsii:${TYPE}:PromezhutochnyeVyplaty`,
    })
  })

  it('«Отмена» шлёт команду отмены — окно гасит сервер', () => {
    render(<VidOperatsiiChoiceDialog node={withOptions()} />)

    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: `list.cancelVidOperatsii:${TYPE}`,
    })
  })

  it('вид без команды в список не попадает (битый проп бэка)', () => {
    render(
      <VidOperatsiiChoiceDialog
        node={withOptions({
          vidOperatsiiOptions: [
            { code: 'A', name: 'A' },
            {
              code: 'B',
              name: 'B',
              command: `list.createVidOperatsii:${TYPE}:B`,
            },
          ],
        })}
      />
    )

    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(screen.getByText('B')).not.toBeNull()
  })
})
