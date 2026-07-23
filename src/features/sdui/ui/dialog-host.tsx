import { useState, useMemo } from 'react'
import { Dialog, DialogTitle, DialogContent, Drawer, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { usePanelStore, type PanelEntry } from '../lib/stores/panel-store'
import {
  SduiSessionProvider,
  type SduiSessionValue,
} from '../lib/sdui-session-context'
import { applyPatches, clearErrors } from '../lib/patch-applier'
import type { ViewNode, ViewPatch } from '../types/view'
import { NodeRenderer } from './node-renderer'
import { PanelStateProvider } from '../lib/panel-state-provider'
import { ConfirmDialogHost } from './confirm-dialog-host'

const PANEL_BG = '#F2F6FD'
const BACKDROP_BG = 'rgba(34, 33, 36, 0.6)'

const PanelFormProvider = ({ panel }: { panel: PanelEntry }) => {
  const [tree, setTree] = useState<ViewNode>(panel.node)
  const [viewState, setViewState] = useState<Record<string, unknown>>(
    panel.viewState,
  )
  const [dirty, setDirty] = useState(false)

  const sessionValue = useMemo<SduiSessionValue>(
    () => ({
      kind: 'panel',
      // Ревизия читается из АКТУАЛЬНОГО стора — фикс M2 для панелей.
      getSession: () => ({
        formSessionId: panel.session?.formSessionId ?? null,
        revision:
          usePanelStore.getState().panels.find((p) => p.panelId === panel.panelId)?.session?.revision ??
          panel.session?.revision ??
          null,
      }),
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
      merge: (patch) => { setViewState((s) => ({ ...s, ...patch })); },
      isDirty: dirty,
      resetDirty: () => { setDirty(false); },
      tree,
      setRoot: setTree,
      setSession: (_id, rev) => {
        usePanelStore.getState().updateSession(panel.panelId, rev)
      },
      bumpRevision: (rev) => {
        usePanelStore.getState().updateSession(panel.panelId, rev)
      },
      // closeAfter=true в panel-сессии закрывает саму панель (SCRUM-283 §4.3)
      closeAfter: () => {
        usePanelStore.getState().remove(panel.panelId)
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

  // Рендер из ЖИВОГО tree-стейта: патчи setProp видны сразу (фикс §3.4 SCRUM-268)
  return (
    <SduiSessionProvider value={sessionValue}>
      <NodeRenderer node={tree} />
    </SduiSessionProvider>
  )
}

export const DialogHost = () => {
  const stack = usePanelStore((s) => s.panels)

  return (
    <>
      {stack.map((panel) => {
        // Панель, открытая в workspace-вкладке, рендерится через
        // WorkspacePanelHost — DialogHost её не показывает.
        if (panel.openInWorkspaceTab) return null

        const content = panel.session ? (
          <PanelFormProvider panel={panel} />
        ) : panel.hasChildState ? (
          // Панель без сессии, но с childState-снимком (движения, related-docs):
          // патчей не бывает, биндинги читают значения из снимка viewState —
          // без read-only сессии диалог рендерится пустым.
          <PanelStateProvider panel={panel}>
            <NodeRenderer node={panel.node} />
          </PanelStateProvider>
        ) : (
          // Панель без сессии И без childState (choice-drawer, ref.showAll):
          // её кнопки (ref.create/ref.select/ref.copy) — команды РОДИТЕЛЬСКОЙ
          // сессии, а ответные патчи (setValue поля) адресованы родительской
          // форме. Голый NodeRenderer наследует SduiSessionProvider экрана;
          // обёртка в read-only PanelStateProvider ломала бы и то и другое
          // (409 SESSION_NOT_FOUND + проглоченные патчи). SCRUM-265 v1.
          <NodeRenderer node={panel.node} />
        )

        if (panel.presentation === 'page') {
          return (
            <Dialog
              key={panel.panelId}
              open
              onClose={() => { usePanelStore.getState().pop(); }}
              fullScreen
              slotProps={{
                paper: {
                  sx: { backgroundColor: PANEL_BG },
                },
              }}
            >
              <div className="flex h-full flex-col p-7">
                <div className="flex shrink-0 items-center justify-between">
                  {typeof panel.node.props?.title === 'string' && (
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {panel.node.props.title}
                    </Typography>
                  )}
                  <IconButton onClick={() => { usePanelStore.getState().pop(); }}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-4">
                  {content}
                </div>
              </div>
            </Dialog>
          )
        }

        if (panel.presentation === 'drawer') {
          const width =
            (panel.node.props?.width as number | undefined) ?? 900

          return (
            <Drawer
              key={panel.panelId}
              anchor="right"
              open
              onClose={() => { usePanelStore.getState().pop(); }}
              slotProps={{
                paper: {
                  sx: {
                    width,
                    borderTopLeftRadius: 40,
                    borderBottomLeftRadius: 40,
                    backgroundColor: PANEL_BG,
                    overflow: 'hidden',
                  },
                },
                backdrop: {
                  sx: { backgroundColor: BACKDROP_BG },
                },
              }}
            >
              <div className="flex h-full flex-col p-7">
                <div className="flex shrink-0 items-center justify-end">
                  <IconButton onClick={() => { usePanelStore.getState().pop(); }}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {content}
                </div>
              </div>
            </Drawer>
          )
        }

        return (
          <Dialog
            key={panel.panelId}
            open
            onClose={() => { usePanelStore.getState().pop(); }}
            maxWidth="md"
            fullWidth
          >
            {typeof panel.node.props?.title === 'string' && (
              <DialogTitle>{panel.node.props.title}</DialogTitle>
            )}
            <DialogContent>{content}</DialogContent>
          </Dialog>
        )
      })}
      <ConfirmDialogHost />
    </>
  )
}
