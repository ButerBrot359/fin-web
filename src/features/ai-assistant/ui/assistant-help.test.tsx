import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import i18n from '@/app/config/i18n'

import {
  DEFAULT_CAPABILITIES,
  READ_CAPABILITIES,
  WRITE_CAPABILITIES,
} from '../lib/consts/capability-catalog'
import { AssistantHelp } from './assistant-help'

// Считаем от каталога, а не числом: разрешения добавляются, и тест, знающий
// их количество наизусть, ломался бы на каждом новом — не находя дефекта.
const TOTAL = READ_CAPABILITIES.length + WRITE_CAPABILITIES.length

const example = (text: string): RegExp =>
  new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

/**
 * Справка помощника.
 *
 * Смысл экрана — честно ответить на «что он умеет»: перечислить ВСЕ действия и
 * отдельно пометить те, которые организация выключила. Спрятанное выключенное
 * оставило бы человека без понимания, чего просить у администратора.
 */
describe('AssistantHelp', () => {
  afterEach(cleanup)

  it('называет и разрешённые действия, и выключенные', () => {
    render(
      <AssistantHelp
        capabilities={['SEARCH_DATA']}
        disabled={false}
        onAsk={vi.fn()}
      />
    )

    expect(screen.getByText(i18n.t('aiAssistant.capSearch'))).toBeTruthy()
    expect(screen.getByText(i18n.t('aiAssistant.capPost'))).toBeTruthy()
    // Разрешено одно — все остальные помечены «выключено».
    expect(screen.getAllByText(i18n.t('aiAssistant.helpOff'))).toHaveLength(
      TOTAL - 1
    )
  })

  it('пример выключенного действия нажать нельзя', () => {
    render(
      <AssistantHelp
        capabilities={['SEARCH_DATA']}
        disabled={false}
        onAsk={vi.fn()}
      />
    )

    const button = screen.getByRole('button', {
      name: example(i18n.t('aiAssistant.capPostExample')),
    })

    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('пример разрешённого действия уходит помощнику как вопрос', () => {
    const onAsk = vi.fn()
    render(
      <AssistantHelp
        capabilities={['SEARCH_DATA']}
        disabled={false}
        onAsk={onAsk}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: example(i18n.t('aiAssistant.capSearchExample')),
      })
    )

    expect(onAsk).toHaveBeenCalledWith(i18n.t('aiAssistant.capSearchExample'))
  })

  it('пока настройки не приехали, показываются разрешения по умолчанию', () => {
    render(
      <AssistantHelp capabilities={null} disabled={false} onAsk={vi.fn()} />
    )

    // Чтение и сводные данные включены на сервере по умолчанию — метки «выключено»
    // на них быть не должно, иначе справка пугает несуществующим запретом.
    expect(screen.getAllByText(i18n.t('aiAssistant.helpOff'))).toHaveLength(
      TOTAL - DEFAULT_CAPABILITIES.length
    )
  })
})
