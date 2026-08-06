import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'

// Инициализация реального i18n-инстанса (side-effect import) — драйвер
// настроек использует реальные ключи `reportalt.settings.*` (кнопка
// «Применить» и т.д.), см. паттерн treasury-export-page.test.tsx.
import '@/app/config/i18n'

import { ReportSettingsPanel } from './report-settings-panel'

vi.mock('@/pages/reportalt/lib/hooks/use-reportalt-meta', () => ({
  useReportAltMeta: () => ({
    meta: {
      definition: { schemaVersion: 3, layout: 'LEDGER' },
      availableFields: [{ code: 'sum', availableAsColumn: true }],
      filters: [],
      availableGroupings: [],
      parameters: [],
    },
    isLoading: false,
  }),
}))

describe('ReportSettingsPanel', () => {
  afterEach(cleanup)

  it('applies a DTO built from the draft and closes', () => {
    const onApply = vi.fn()
    const onClose = vi.fn()
    render(
      <ReportSettingsPanel
        reportCode="R1"
        appliedUserSettings={undefined}
        onApply={onApply}
        onReset={vi.fn()}
        open
        onClose={onClose}
      />
    )
    // Without touching a field the draft stays null (isEmptySettings gate,
    // same convention as use-reportalt-user-settings.ts) — clicking Apply
    // "as is" legitimately yields undefined (no overlay). Toggle the one
    // available field first so the draft becomes a real, non-empty delta,
    // then drive Apply for real through the drawer's own button.
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByText(/Применить/))
    expect(onApply).toHaveBeenCalledTimes(1)
    // schemaVersionRef is always present in a non-empty DTO
    expect(onApply.mock.calls[0][0]).toMatchObject({ schemaVersionRef: 3 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies undefined when the draft is left untouched (empty delta)', () => {
    const onApply = vi.fn()
    render(
      <ReportSettingsPanel
        reportCode="R1"
        appliedUserSettings={undefined}
        onApply={onApply}
        onReset={vi.fn()}
        open
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Применить/))
    expect(onApply).toHaveBeenCalledWith(undefined)
  })

  it('closing without Apply then reopening discards the earlier draft edit', () => {
    const onApply = vi.fn()
    const { rerender } = render(
      <ReportSettingsPanel
        reportCode="R1"
        appliedUserSettings={undefined}
        onApply={onApply}
        onReset={vi.fn()}
        open
        onClose={vi.fn()}
      />
    )
    // Touch the one available field — a real, non-empty draft edit — but
    // close (Drawer only unmounts visually, component stays mounted) without
    // clicking Apply.
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    rerender(
      <ReportSettingsPanel
        reportCode="R1"
        appliedUserSettings={undefined}
        onApply={onApply}
        onReset={vi.fn()}
        open={false}
        onClose={vi.fn()}
      />
    )
    // Reopen — with the fix, the open transition resets draft to null, so
    // the earlier unsaved edit must not survive: Apply "as is" yields
    // undefined again, same as a fresh open (isEmptySettings gate).
    rerender(
      <ReportSettingsPanel
        reportCode="R1"
        appliedUserSettings={undefined}
        onApply={onApply}
        onReset={vi.fn()}
        open
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Применить/))
    expect(onApply).toHaveBeenCalledWith(undefined)
  })
})
