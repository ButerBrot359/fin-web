import { Alert } from '@mui/material'

import { PanelStateProvider } from '../lib/panel-state-provider'
import { useExternalPanelRefresh } from '../lib/hooks/use-external-panel-refresh'
import { usePanelStore } from '../lib/stores/panel-store'
import { NodeRenderer } from './node-renderer'

// Рендерит контент SDUI-панели в области workspace-вкладки (вместо Dialog).
// panelId приходит из активной вкладки pageType 'sdui-panel' (layout.tsx).
export const WorkspacePanelHost = ({ panelId }: { panelId: string }) => {
  useExternalPanelRefresh()
  const panel = usePanelStore((s) =>
    s.panels.find((p) => p.panelId === panelId)
  )
  if (!panel) return null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {panel.refreshMessage ? (
        <Alert severity="info">{panel.refreshMessage}</Alert>
      ) : (
        <PanelStateProvider panel={panel}>
          <NodeRenderer node={panel.node} />
        </PanelStateProvider>
      )}
    </div>
  )
}
