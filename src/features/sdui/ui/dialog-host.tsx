import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Drawer,
  IconButton,
  Typography,
} from '@mui/material'
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
import {
  registerPanelPatchSink,
  unregisterPanelPatchSink,
} from '../lib/panel-patch-registry'
import { ConfirmDialogHost } from './confirm-dialog-host'
import { UnsavedChangesHost } from './unsaved-changes-host'
import { PanelCloseCommand } from './panel-close-command'
import { requestPanelClose } from '../lib/panel-close-registry'
import { panelZIndex } from '@/shared/lib/utils/overlay-z-index'

const PANEL_BG = '#F2F6FD'
const BACKDROP_BG = 'rgba(34, 33, 36, 0.6)'

const PanelFormProvider = ({ panel }: { panel: PanelEntry }) => {
  const [tree, setTree] = useState<ViewNode>(panel.node)
  const [viewState, setViewState] = useState<Record<string, unknown>>(
    panel.viewState
  )
  const [dirty, setDirty] = useState(false)

  const sessionValue = useMemo<SduiSessionValue>(
    () => ({
      kind: 'panel',
      // Ревизия читается из АКТУАЛЬНОГО стора — фикс M2 для панелей.
      getSession: () => ({
        formSessionId: panel.session?.formSessionId ?? null,
        revision:
          usePanelStore
            .getState()
            .panels.find((p) => p.panelId === panel.panelId)?.session
            ?.revision ??
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
      merge: (patch) => {
        setViewState((s) => ({ ...s, ...patch }))
      },
      isDirty: dirty,
      resetDirty: () => {
        setDirty(false)
      },
      setDirty: (value) => {
        setDirty(value)
      },
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
    [panel.session, panel.panelId, tree, viewState, dirty]
  )

  // Патчи, адресованные ЭТОЙ панели извне React-дерева (выбор в дочерней панели
  // ретранслируется в родительскую сессию — relay-selection). Регистрируем
  // актуальный sessionValue: он пересоздаётся на каждое изменение стейта, и
  // реестр всегда держит свежие сеттеры, а не замыкание первого рендера.
  useEffect(() => {
    registerPanelPatchSink(panel.panelId, sessionValue)
    return () => {
      unregisterPanelPatchSink(panel.panelId)
    }
  }, [panel.panelId, sessionValue])

  // Рендер из ЖИВОГО tree-стейта: патчи setProp видны сразу (фикс §3.4 SCRUM-268)
  return (
    <SduiSessionProvider value={sessionValue}>
      {/* Крестик панели — снаружи, в DialogHost; команда закрытия живёт в
          сессии панели. Мост между ними — этот компонент (ничего не рисует). */}
      <PanelCloseCommand panelId={panel.panelId} node={tree} />
      <NodeRenderer node={tree} />
    </SduiSessionProvider>
  )
}

/**
 * Закрытие панели пользователем (крестик, клик мимо, Esc).
 *
 * Панель, объявившая серверную команду закрытия (`props.closeCommand`), сама её
 * не закрывает: решение принимает сервер — он либо гасит панель эффектом
 * `closeDialog`, либо сперва спрашивает «Сохранить изменения?». Остальные
 * панели закрываются как раньше, локально.
 */
const closePanel = (panelId: string): void => {
  if (requestPanelClose(panelId)) return
  usePanelStore.getState().pop()
}

export const DialogHost = () => {
  const stack = usePanelStore((s) => s.panels)

  return (
    <>
      {stack.map((panel, index) => {
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
              onClose={() => {
                closePanel(panel.panelId)
              }}
              fullScreen
              style={{ zIndex: panelZIndex(index) }}
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
                  <IconButton
                    onClick={() => {
                      closePanel(panel.panelId)
                    }}
                  >
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
          const width = (panel.node.props?.width as number | undefined) ?? 900

          return (
            <Drawer
              key={panel.panelId}
              anchor="right"
              open
              onClose={() => {
                closePanel(panel.panelId)
              }}
              style={{ zIndex: panelZIndex(index) }}
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
                  <IconButton
                    onClick={() => {
                      closePanel(panel.panelId)
                    }}
                  >
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
            onClose={() => {
              closePanel(panel.panelId)
            }}
            maxWidth="md"
            fullWidth
            style={{ zIndex: panelZIndex(index) }}
          >
            {typeof panel.node.props?.title === 'string' && (
              <DialogTitle>{panel.node.props.title}</DialogTitle>
            )}
            <DialogContent>{content}</DialogContent>
          </Dialog>
        )
      })}
      <ConfirmDialogHost />
      <UnsavedChangesHost />
    </>
  )
}
