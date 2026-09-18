import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/app/config/i18n'
import { AuditHistoryCell, type AuditHistoryRow } from './audit-history-cell'

const aiRow: AuditHistoryRow = {
  origin: 'AI',
  originLabel: 'ИИ',
  userName: 'Татьяна Мельникова',
  occurredAt: '11.09.2026 10:16:47',
  action: 'Изменение',
  outcome: 'Выполнено',
  outcomeCode: 'SUCCESS',
  changesDetails: [
    {
      field: 'Otvetstvennyy',
      label: 'Ответственный',
      before: null,
      after: 'Татьяна Мельникова',
    },
  ],
  ai: {
    tool: 'UPDATE_DOCUMENT',
    toolLabel: 'Изменение реквизитов',
    attribution: 'EVENT',
    initiatedBy: { userId: 7, name: 'Татьяна Мельникова', login: 'accountant' },
    executionId: 'execution-id',
    stepId: 'update',
  },
}
function cell(row: AuditHistoryRow, binding: string) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <AuditHistoryCell row={row} binding={binding} />
      </I18nextProvider>
    </MemoryRouter>
  )
}
afterEach(() => {
  cleanup()
  void i18n.changeLanguage('ru')
})

describe('document history provenance', () => {
  it('identifies AI and initiator without replacing the name with an AI account', () => {
    cell(aiRow, 'originLabel')
    expect(screen.getByText('С помощью ИИ')).toBeTruthy()
    cleanup()
    cell(aiRow, 'userName')
    expect(screen.getByText('Татьяна Мельникова')).toBeTruthy()
    expect(screen.getByText('accountant')).toBeTruthy()
    expect(screen.getByText('Запустил помощника')).toBeTruthy()
  })
  it('keeps seconds and displays localized before/after values', () => {
    cell(aiRow, 'occurredAt')
    expect(screen.getByText('11.09.2026')).toBeTruthy()
    expect(screen.getByText('10:16:47')).toBeTruthy()
    cleanup()
    cell(aiRow, 'changes')
    expect(screen.getByText('Ответственный')).toBeTruthy()
    expect(screen.queryByText('Otvetstvennyy')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText(/→ Татьяна/)).toBeTruthy()
  })
  it('shows execution trace without exposing a conversation link', () => {
    cell(aiRow, 'message')
    expect(screen.getByText('execution-id')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('does not fabricate conversation links for another reader or legacy creation', () => {
    cell(
      {
        ...aiRow,
        ai: {
          initiatedBy: aiRow.ai?.initiatedBy,
          attribution: 'CREATION_FLAG',
        },
      },
      'message'
    )
    expect(screen.queryByText('Открыть переписку ↗')).toBeNull()
    expect(
      screen.getByText(/Подробности старого вызова отсутствуют/)
    ).toBeTruthy()
  })
  it('manual events cannot inherit AI details from a document-level flag', () => {
    cell(
      { ...aiRow, origin: 'USER', originLabel: 'Пользователь' },
      'originLabel'
    )
    expect(screen.queryByText('С помощью ИИ')).toBeNull()
    cleanup()
    cell({ ...aiRow, origin: 'USER', message: 'Ручное изменение' }, 'message')
    expect(screen.getByText('Ручное изменение')).toBeTruthy()
    expect(screen.queryByText('Подробнее')).toBeNull()
  })
  it('preserves old rows and unknown sources as supplied by the server', () => {
    cell({ changes: 'Сумма: 100 → 200' }, 'changes')
    expect(screen.getByText('Сумма: 100 → 200')).toBeTruthy()
    cleanup()
    cell({ origin: 'UNKNOWN', originLabel: 'Не зафиксирован' }, 'originLabel')
    expect(screen.getByText('Не зафиксирован')).toBeTruthy()
  })
  it('supports Kazakh labels and does not label failed operations successful', async () => {
    await i18n.changeLanguage('kz')
    cell(aiRow, 'originLabel')
    expect(screen.getByText('ЖИ көмегімен')).toBeTruthy()
    cleanup()
    cell({ outcome: 'Ошибка', outcomeCode: 'FAILED' }, 'outcome')
    expect(screen.getByText('Ошибка')).toBeTruthy()
    expect(screen.queryByText('Выполнено')).toBeNull()
  })
})
