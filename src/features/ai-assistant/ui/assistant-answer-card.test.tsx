import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import '@/app/config/i18n'

import type { AiAssistantAnswer } from '@/entities/ai-assistant'

import { AssistantAnswerCard } from './assistant-answer-card'

const answer = (patch: Partial<AiAssistantAnswer>): AiAssistantAnswer => ({
  conversationId: 1,
  conclusion: 'Итог рассчитан верно',
  breakdown: [],
  sources: [],
  actions: [],
  created: [],
  latencyMs: 1200,
  ...patch,
})

/**
 * Карточка ответа.
 *
 * Тесты написаны после живого скриншота: неудача создания приезжала подписью кнопки и
 * рисовалась ярко-зелёной кнопкой действия — предложением нажать на текст ошибки, да ещё
 * и растягивавшим узкую панель по горизонтали.
 */
describe('AssistantAnswerCard', () => {
  afterEach(cleanup)

  it('неудача показывается сообщением, а не кнопкой', () => {
    render(
      <AssistantAnswerCard
        answer={answer({
          actions: [
            {
              kind: 'CREATE_DOCUMENT',
              label: 'Создать документ',
              typeCode: 'OperatsiyaBukh',
              error: 'У выбранной организации не заполнен префикс',
            },
          ],
        })}
        onAction={vi.fn()}
        onOpenDocument={vi.fn()}
      />
    )

    expect(
      screen.getByText('У выбранной организации не заполнен префикс')
    ).toBeTruthy()
    // Ни одной кнопки: нажимать не на что, действие не удалось.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('доступное действие остаётся кнопкой', () => {
    render(
      <AssistantAnswerCard
        answer={answer({
          actions: [
            {
              kind: 'SHOW_ROWS',
              label: 'Показать строки',
              tableCode: 'Nachisleniya',
            },
          ],
        })}
        onAction={vi.fn()}
        onOpenDocument={vi.fn()}
      />
    )

    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('удачное и неудачное действие рядом: одна кнопка и одно сообщение', () => {
    render(
      <AssistantAnswerCard
        answer={answer({
          actions: [
            {
              kind: 'OPEN_DOCUMENT',
              label: 'Открыть',
              typeCode: 'X',
              entryId: 1,
            },
            { kind: 'CREATE_DOCUMENT', label: 'Создать', error: 'Нет прав' },
          ],
        })}
        onAction={vi.fn()}
        onOpenDocument={vi.fn()}
      />
    )

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Нет прав')).toBeTruthy()
  })

  it('созданный документ помечен как не проведённый', () => {
    render(
      <AssistantAnswerCard
        answer={answer({
          created: [
            {
              entryId: 42,
              typeCode: 'OperatsiyaBukh',
              presentation: 'Операция (бухгалтерская) №15',
              posted: false,
              warnings: [],
            },
          ],
        })}
        onAction={vi.fn()}
        onOpenDocument={vi.fn()}
      />
    )

    expect(
      screen.getByText(/Операция \(бухгалтерская\) №15 — не проведён/)
    ).toBeTruthy()
  })

  it('созданный документ открывается нажатием: панель уводит на первый, остальные — отсюда', () => {
    const onOpenDocument = vi.fn()
    render(
      <AssistantAnswerCard
        answer={answer({
          created: [
            {
              entryId: 42,
              typeCode: 'OperatsiyaBukh',
              presentation: 'Операция (бухгалтерская) №15',
              posted: false,
              warnings: [],
            },
          ],
        })}
        onAction={vi.fn()}
        onOpenDocument={onOpenDocument}
      />
    )

    fireEvent.click(
      screen.getByRole('button', { name: /Операция \(бухгалтерская\) №15/ })
    )

    expect(onOpenDocument).toHaveBeenCalledWith('OperatsiyaBukh', 42)
  })
})
