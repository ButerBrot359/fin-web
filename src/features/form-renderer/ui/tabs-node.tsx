import { useLocation } from 'react-router-dom'
import { useWatch } from 'react-hook-form'

import type { FormNode, TabsNode as TabsNodeType } from '@/entities/form-config'
import { cn } from '@/shared/lib/utils/cn'
import { useActiveTabStore } from '@/shared/lib/form-tabs/active-tab-store'

import { NodeRenderer } from './node-renderer'
import { useFormRendererContext } from '../lib/hooks/use-form-renderer-context'

interface TabsNodeProps {
  node: TabsNodeType
}

const NO_FIELD = '__no_tab_field__'

/** Код первого ссылочного/табличного поля пейна — источник счётчика строк «(N)». */
const firstFieldCode = (nodes: FormNode[]): string | null => {
  for (const n of nodes) {
    if (n.type === 'Field') return n.code
    const kids = (n as { children?: FormNode[] }).children
    if (kids && kids.length > 0) {
      const found = firstFieldCode(kids)
      if (found) return found
    }
  }
  return null
}

export const TabsNode = ({ node }: TabsNodeProps) => {
  const { pathname } = useLocation()
  const { form } = useFormRendererContext()
  const defaultKey = node.panes[0]?.key ?? ''

  // Ключ памяти = маршрут документа (несёт id) + сигнатура набора вкладок
  // (различает несколько групп вкладок в одной форме). При возврате к документу
  // восстанавливаем последнюю активную вкладку, а не первую.
  const groupKey = node.panes.map((pane) => pane.key).join('|')
  const storeKey = `${pathname}::${groupKey}`

  const stored = useActiveTabStore((s) => s.activeByKey[storeKey])
  const setActive = useActiveTabStore((s) => s.setActive)

  // Сохранённая вкладка может отсутствовать в текущем наборе (конфиг изменился) —
  // тогда откатываемся на первую.
  const activeKey =
    stored && node.panes.some((pane) => pane.key === stored)
      ? stored
      : defaultKey

  // Счётчик строк табличной части у каждой вкладки (как в 1С: «ТМЗ (1)»).
  // Реактивно следим за значениями ТЧ-полей вкладок.
  const paneFieldCodes = node.panes.map((pane) => firstFieldCode(pane.children))
  const watched = useWatch({
    control: form.control,
    name: paneFieldCodes.map((code) => code ?? NO_FIELD),
  }) as unknown[]

  return (
    <div>
      <div className="flex items-end border-b border-ui-03">
        {node.panes.map((pane, index) => {
          const value = watched?.[index]
          const count = Array.isArray(value) ? value.length : null
          const isActive = activeKey === pane.key
          return (
            <button
              key={pane.key}
              type="button"
              onClick={() => {
                setActive(storeKey, pane.key)
              }}
              className={cn(
                'relative -mb-px cursor-pointer select-none whitespace-nowrap rounded-t border border-b-0 px-4 py-1.5 text-[13px] transition-colors',
                isActive
                  ? "z-10 border-ui-03 bg-ui-01 font-medium text-ui-06 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ui-01 after:content-['']"
                  : 'border-ui-03 bg-ui-02 text-ui-05 hover:bg-ui-04 hover:text-ui-06'
              )}
            >
              {pane.label}
              {count != null && count > 0 && (
                <span className="ml-1 text-ui-05">{`(${String(count)})`}</span>
              )}
            </button>
          )
        })}
      </div>

      {node.panes.map((pane) => (
        <div
          key={pane.key}
          className={cn('pt-4', activeKey !== pane.key && 'hidden')}
        >
          {pane.children.map((child, index) => (
            <NodeRenderer key={index} node={child} />
          ))}
        </div>
      ))}
    </div>
  )
}
