import { useState, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { cn } from '@/shared/lib/utils/cn'

import type { FormConfig } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'
import { FormRenderer } from '@/features/form-renderer'
import type { FormRendererHandle } from '@/features/form-renderer'

import { ConsolidatedGrid } from './consolidated-grid'
import { useConsolidatedData } from '../lib/hooks/use-consolidated-data'

interface TarifikatsiyaFormLayoutProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  typeCode: string
  handleRef?: React.RefObject<FormRendererHandle | null>
}

const TABLE_TABS = [
  { key: 'DannyeRabotnikov', label: 'Данные работников' },
  { key: 'NachisleniyaRabotnikov', label: 'Начисления работников' },
  { key: 'RaspredeleniePoNagruzkam', label: 'Распределение по нагрузкам' },
  { key: 'RazdeleniyaPoShablonam', label: 'Разделения по шаблонам' },
  { key: 'DopolnitelnyeNachisleniya', label: 'Дополнительные начисления' },
] as const

export const TarifikatsiyaFormLayout = ({
  config,
  attributes,
  form,
  typeCode,
  handleRef,
}: TarifikatsiyaFormLayoutProps) => {
  const consolidatedData = useConsolidatedData(form)
  const [activeTab, setActiveTab] = useState<string>(TABLE_TABS[0].key)

  // CRITICAL: All FormRenderer instances must share the same tableReplacersRef.
  // When triggerEvent fires from the header FormRenderer, echo response
  // updates table data via replacers registered by the tab FormRenderers.
  const sharedTableReplacersRef = useRef(
    new Map<string, (rows: Record<string, unknown>[]) => void>()
  )

  // Split config: header fields via FormRenderer, TABLE fields in tabs
  const headerConfig: FormConfig = {
    ...config,
    layout: {
      type: 'VStack',
      gap: 4,
      children: 'children' in config.layout
        ? config.layout.children.filter((node) => {
            if (node.type !== 'Field') return true
            const attr = attributes.find((a) => a.code === node.code)
            return attr?.dataType !== 'TABLE'
          })
        : [config.layout],
    },
  }

  const tableAttributes = attributes.filter((a) => a.dataType === 'TABLE')

  return (
    <div className="flex flex-col gap-4">
      <FormRenderer
        config={headerConfig}
        attributes={attributes}
        form={form}
        typeCode={typeCode}
        handleRef={handleRef}
        sharedTableReplacersRef={sharedTableReplacersRef}
      />

      <ConsolidatedGrid data={consolidatedData} />

      <div className="flex flex-col">
        <div className="flex gap-1 border-b border-ui-03">
          {TABLE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 text-body2 transition-colors',
                activeTab === tab.key
                  ? 'border-b-2 border-accent-01 text-accent-01'
                  : 'text-ui-05 hover:text-ui-06'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tableAttributes.map((attr) => (
            <div
              key={attr.code}
              className={cn(attr.code !== activeTab && 'hidden')}
            >
              <FormRenderer
                config={{
                  name: attr.code,
                  title: '',
                  layout: { type: 'Field' as const, code: attr.code },
                }}
                attributes={attributes}
                form={form}
                typeCode={typeCode}
                sharedTableReplacersRef={sharedTableReplacersRef}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
