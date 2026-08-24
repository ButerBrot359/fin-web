import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && 'label' in o ? `${k}:${String(o.label)}` : k,
  }),
}))

import { KalendariScheduleEditor } from './kalendari-schedule-editor'

const wire = (hhmm: string) => `2000-01-01T${hhmm}:00`

const monday = {
  rowId: '10',
  NomerDnya: 1,
  VremyaNachala: wire('09:00'),
  VremyaOkonchaniya: wire('18:00'),
}
const tuesday = {
  rowId: '20',
  NomerDnya: 2,
  VremyaNachala: wire('08:00'),
  VremyaOkonchaniya: wire('17:00'),
}
const preHoliday = {
  rowId: '30',
  NomerDnya: 0,
  VremyaNachala: wire('09:00'),
  VremyaOkonchaniya: wire('15:00'),
}

const startInputs = () =>
  screen.getAllByLabelText<HTMLInputElement>('sdui.kalendari.start')
const endInputs = () =>
  screen.getAllByLabelText<HTMLInputElement>('sdui.kalendari.end')

afterEach(cleanup)

describe('KalendariScheduleEditor', () => {
  it('показывает интервалы своего дня в HH:mm, чужие дни не показывает', () => {
    render(
      <KalendariScheduleEditor
        day={1}
        dayLabel="Пн"
        rows={[monday, tuesday, preHoliday]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(startInputs()).toHaveLength(1)
    expect(startInputs()[0].value).toBe('09:00')
    expect(endInputs()[0].value).toBe('18:00')
  })

  it('Отмена зовёт onClose и не трогает onApply', () => {
    const onApply = vi.fn()
    const onClose = vi.fn()
    render(
      <KalendariScheduleEditor
        day={1}
        dayLabel="Пн"
        rows={[monday]}
        onApply={onApply}
        onClose={onClose}
      />
    )
    fireEvent.change(startInputs()[0], { target: { value: '10:00' } })
    fireEvent.click(screen.getByText('sdui.kalendari.cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('Apply: добавленный интервал уезжает tmp-* строкой, чужие дни и день 0 сохранены', () => {
    const onApply = vi.fn()
    render(
      <KalendariScheduleEditor
        day={1}
        dayLabel="Пн"
        rows={[tuesday, preHoliday]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('sdui.kalendari.addInterval'))
    fireEvent.change(startInputs()[0], { target: { value: '09:00' } })
    fireEvent.change(endInputs()[0], { target: { value: '18:00' } })
    fireEvent.click(screen.getByText('sdui.kalendari.apply'))

    expect(onApply).toHaveBeenCalledTimes(1)
    const sent = onApply.mock.calls[0][0] as {
      rowId: string
      NomerDnya: number
      VremyaNachala: unknown
      VremyaOkonchaniya: unknown
    }[]
    expect(sent).toHaveLength(3)
    // Чужой день и день 0 — нетронуты
    expect(sent[0]).toEqual(tuesday)
    expect(sent[1]).toEqual(preHoliday)
    // Новая строка — tmp-id, провод-формат, свой день
    expect(sent[2].rowId.startsWith('tmp-')).toBe(true)
    expect(sent[2].NomerDnya).toBe(1)
    expect(sent[2].VremyaNachala).toBe(wire('09:00'))
    expect(sent[2].VremyaOkonchaniya).toBe(wire('18:00'))
  })

  it('Apply: правка существующего интервала сохраняет его rowId', () => {
    const onApply = vi.fn()
    render(
      <KalendariScheduleEditor
        day={1}
        dayLabel="Пн"
        rows={[monday]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    )
    fireEvent.change(endInputs()[0], { target: { value: '17:00' } })
    fireEvent.click(screen.getByText('sdui.kalendari.apply'))
    const sent = onApply.mock.calls[0][0] as {
      rowId: string
      VremyaOkonchaniya: unknown
    }[]
    expect(sent).toHaveLength(1)
    expect(sent[0].rowId).toBe('10')
    expect(sent[0].VremyaOkonchaniya).toBe(wire('17:00'))
  })

  it('пересекающиеся интервалы: Apply отклонён локально, ошибка показана', () => {
    const onApply = vi.fn()
    render(
      <KalendariScheduleEditor
        day={1}
        dayLabel="Пн"
        rows={[monday]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('sdui.kalendari.addInterval'))
    fireEvent.change(startInputs()[1], { target: { value: '10:00' } })
    fireEvent.change(endInputs()[1], { target: { value: '11:00' } })
    fireEvent.click(screen.getByText('sdui.kalendari.apply'))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByText('sdui.kalendari.errOverlap')).toBeTruthy()
  })

  it('удаление строки: Apply уходит без неё', () => {
    const onApply = vi.fn()
    render(
      <KalendariScheduleEditor
        day={1}
        dayLabel="Пн"
        rows={[monday]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText('sdui.kalendari.deleteInterval'))
    fireEvent.click(screen.getByText('sdui.kalendari.apply'))
    const sent = onApply.mock.calls[0][0] as unknown[]
    expect(sent).toHaveLength(0)
  })
})
