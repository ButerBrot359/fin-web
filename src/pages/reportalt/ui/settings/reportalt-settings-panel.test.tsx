import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type {
  ReportAltMetaDto,
  ReportAltParameterDto,
} from '../../types/reportalt'
import { GRUPPA_BYUDZHETY } from '../../lib/utils/params'
import { ReportAltSettingsPanel } from './reportalt-settings-panel'

const detalnoPoProgrammam: ReportAltParameterDto = {
  code: 'DetalnoPoProgrammam',
  titleRu: 'Детализация по программам',
  dataType: 'BOOLEAN',
  required: false,
  group: GRUPPA_BYUDZHETY,
}

const meta: ReportAltMetaDto = {
  definition: {
    code: 'UprShtatnoeRaspisaniePoVsemuPersonalu',
    nameRu: 'Штатное расписание по всему персоналу',
  } as ReportAltMetaDto['definition'],
  parameters: [detalnoPoProgrammam],
  filters: [{ field: 'Fio', titleRu: 'ФИО', valueType: 'STRING' }],
  availableFields: [
    {
      code: 'Oklad',
      titleRu: 'Оклад',
      availableAsColumn: false,
      availableAsOrder: true,
    },
  ],
  appearanceFlags: [{ code: 'NEGATIVE_RED', titleRu: 'Отрицательные красным' }],
}

const renderPanel = (onParamChange = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReportAltSettingsPanel
        meta={meta}
        draft={null}
        onDraftChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        byudzhetyParams={[detalnoPoProgrammam]}
        paramValues={{}}
        onParamChange={onParamChange}
      />
    </QueryClientProvider>
  )

describe('Панель настроек отчёта под командной панелью', () => {
  it('вкладки идут как в 1С: распределение по бюджетам, отбор, сортировка, оформление', () => {
    renderPanel()

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Распределение по бюджетам',
      'Отбор',
      'Сортировка',
      'Оформление',
    ])
  })

  it('флажок «Детализация по программам» на первой вкладке меняет параметр отчёта', () => {
    const onParamChange = vi.fn()
    renderPanel(onParamChange)

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Детализация по программам' })
    )

    expect(onParamChange).toHaveBeenCalledWith('DetalnoPoProgrammam', true)
  })
})
