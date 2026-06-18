import { useSyncExternalStore, useState, useMemo } from 'react'
import { Dialog, DialogTitle, DialogContent, Drawer, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import {
  getPanelStack,
  subscribePanels,
  popPanel,
  updatePanelSession,
  type PanelEntry,
} from '../lib/dispatch'
import {
  SduiSessionProvider,
  type SduiSessionValue,
} from '../lib/sdui-session-context'
import { applyPatches, clearErrors } from '../lib/patch-applier'
import type { ViewNode, ViewPatch } from '../types/view'
import { NodeRenderer } from './node-renderer'

const PanelFormProvider = ({
  panel,
  children,
}: {
  panel: PanelEntry
  children: React.ReactNode
}) => {
  const [tree, setTree] = useState<ViewNode>(panel.node)
  const [viewState, setViewState] = useState<Record<string, unknown>>(
    panel.viewState,
  )
  const [dirty, setDirty] = useState(false)

  const sessionValue = useMemo<SduiSessionValue>(
    () => ({
      formSessionId: panel.session?.formSessionId ?? null,
      revision: panel.session?.revision ?? null,
      getValue: (binding) => (binding ? viewState[binding] : undefined),
      setValue: (binding, value) => {
        setViewState((s) => ({ ...s, [binding]: value }))
        setDirty(true)
      },
      setFromServer: (binding, value) => {
        setViewState((s) => ({ ...s, [binding]: value }))
      },
      getAll: () => viewState,
      replaceAll: (s) => {
        setViewState(s)
        setDirty(false)
      },
      merge: (patch) => setViewState((s) => ({ ...s, ...patch })),
      isDirty: dirty,
      resetDirty: () => setDirty(false),
      tree,
      setRoot: setTree,
      setSession: (_id, rev) => {
        updatePanelSession(panel.panelId, rev)
      },
      bumpRevision: (rev) => {
        updatePanelSession(panel.panelId, rev)
      },
      applyTreePatches: (patches: ViewPatch[]) => {
        setTree((t) => applyPatches(t, patches))
      },
      clearAllErrors: () => {
        setTree((t) => clearErrors(t))
      },
    }),
    [panel.session, panel.panelId, tree, viewState, dirty],
  )

  return (
    <SduiSessionProvider value={sessionValue}>{children}</SduiSessionProvider>
  )
}

export const DialogHost = () => {
  const stack = useSyncExternalStore(subscribePanels, getPanelStack)

  return (
    <>
      {stack.map((panel) => {
        if (!panel.node) return null

        const content = panel.session ? (
          <PanelFormProvider panel={panel}>
            <NodeRenderer node={panel.node} />
          </PanelFormProvider>
        ) : (
          <NodeRenderer node={panel.node} />
        )

        if (panel.presentation === 'drawer') {
          const width =
            (panel.node.props?.width as number | undefined) ?? 900

          return (
            <Drawer
              key={panel.panelId}
              anchor="right"
              open
              onClose={popPanel}
              slotProps={{
                paper: {
                  sx: {
                    width,
                    borderTopLeftRadius: 40,
                    borderBottomLeftRadius: 40,
                    backgroundColor: '#F2F6FD',
                    overflow: 'hidden',
                  },
                },
                backdrop: {
                  sx: { backgroundColor: 'rgba(34, 33, 36, 0.6)' },
                },
              }}
            >
              <div className="flex h-full flex-col p-7">
                <div className="flex items-center justify-end">
                  <IconButton onClick={popPanel}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </div>
                {content}
              </div>
            </Drawer>
          )
        }

        return (
          <Dialog
            key={panel.panelId}
            open
            onClose={popPanel}
            maxWidth="md"
            fullWidth
          >
            {panel.node.props?.title != null && (
              <DialogTitle>{String(panel.node.props.title)}</DialogTitle>
            )}
            <DialogContent>{content}</DialogContent>
          </Dialog>
        )
      })}
    </>
  )
}
