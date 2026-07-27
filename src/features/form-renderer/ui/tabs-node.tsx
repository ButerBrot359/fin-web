import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import type { TabsNode as TabsNodeType } from '@/entities/form-config'
import { cn } from '@/shared/lib/utils/cn'
import { useActiveTabStore } from '@/shared/lib/form-tabs/active-tab-store'

import { NodeRenderer } from './node-renderer'

interface TabsNodeProps {
  node: TabsNodeType
}

export const TabsNode = ({ node }: TabsNodeProps) => {
  const { pathname } = useLocation()
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

  // ЛЕНИВОЕ МОНТИРОВАНИЕ. Раньше монтировались ВСЕ панели, а неактивные просто
  // прятались классом `hidden`: в документе с тремя табличными частями (ОС, НМА,
  // БиблиотечныйФонд) все три жили в DOM со своими подписками, хотя пользователь
  // обычно работает только с одной. Теперь панель попадает в дерево при первой
  // активации и дальше остаётся смонтированной (скрытой) — так не теряется её
  // собственное состояние (прокрутка, выделение, открытые пикеры).
  //
  // Значения полей от этого не зависят: они живут в react-hook-form, а
  // `shouldUnregister` в проекте не включён — значения переживают размонтирование
  // поля и попадают в payload сохранения независимо от того, открывал ли
  // пользователь вкладку.
  const [openedKeys, setOpenedKeys] = useState<ReadonlySet<string>>(
    () => new Set([activeKey])
  )

  // Активная панель рендерится ВСЕГДА: если вкладка стала активной не по клику
  // (восстановление из стора, смена конфига), она всё равно окажется в дереве.
  const isMounted = (key: string) => key === activeKey || openedKeys.has(key)

  return (
    <div>
      <div className="flex gap-1 border-b border-ui-03">
        {node.panes.map((pane) => (
          <button
            key={pane.key}
            type="button"
            onClick={() => {
              setActive(storeKey, pane.key)
              setOpenedKeys((prev) =>
                prev.has(pane.key) ? prev : new Set(prev).add(pane.key)
              )
            }}
            className={cn(
              'rounded-t-md px-4 py-2 text-[14px] font-medium transition-colors',
              activeKey === pane.key
                ? 'bg-ui-06 text-ui-01'
                : 'bg-ui-01 text-ui-05 hover:bg-ui-07'
            )}
          >
            {pane.label}
          </button>
        ))}
      </div>

      {node.panes.map((pane) =>
        isMounted(pane.key) ? (
          <div
            key={pane.key}
            className={cn('pt-4', activeKey !== pane.key && 'hidden')}
          >
            {pane.children.map((child, index) => (
              <NodeRenderer key={index} node={child} />
            ))}
          </div>
        ) : null
      )}
    </div>
  )
}
