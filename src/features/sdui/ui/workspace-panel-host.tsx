import { PanelStateProvider } from '../lib/panel-state-provider'
import { usePanelStore } from '../lib/stores/panel-store'
import { NodeRenderer } from './node-renderer'

// Рендерит контент SDUI-панели в области workspace-вкладки (вместо Dialog).
// panelId приходит из активной вкладки pageType 'sdui-panel' (layout.tsx).
export const WorkspacePanelHost = ({ panelId }: { panelId: string }) => {
  const panel = usePanelStore((s) =>
    s.panels.find((p) => p.panelId === panelId),
  )
  if (!panel) return null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <PanelStateProvider panel={panel}>
        <NodeRenderer node={panel.node} />
      </PanelStateProvider>
    </div>
  )
}
