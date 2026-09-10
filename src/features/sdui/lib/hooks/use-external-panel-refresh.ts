import { useEffect } from 'react'

import { registerOpenViewsRefresh } from '@/shared/lib/refresh/open-views-refresh'

import { fetchMovementsView } from '../../api/movements-api'
import { usePanelStore } from '../stores/panel-store'

const REFRESH_TIMEOUT_MS = 30_000

/** Movement workspace tabs contain immutable snapshots, not React Query data. */
export function useExternalPanelRefresh(): void {
  useEffect(
    () =>
      registerOpenViewsRefresh(async () => {
        const result = { refreshed: 0, deferred: 0, failed: 0 }
        const panels = usePanelStore
          .getState()
          .panels.filter(
            (panel) =>
              panel.openInWorkspaceTab &&
              !panel.session &&
              /^movements:[1-9]\d*$/.test(panel.tabKey ?? '')
          )
        await Promise.all(
          panels.map(async (panel) => {
            try {
              // MovementsComposer explicitly defines tabKey as movements:{documentEntryId}.
              const response = await fetchMovementsView(
                panel.tabKey!.slice('movements:'.length),
                REFRESH_TIMEOUT_MS
              )
              const effect = response.effects?.find(
                (item) =>
                  item.type === 'openDialog' &&
                  item.node?.props?.tabKey === panel.tabKey
              )
              const notice = response.effects?.find(
                (item) => item.type === 'notify'
              )
              if (
                notice?.level === 'error' ||
                (!effect?.node && !notice?.message)
              ) {
                result.failed++
                return
              }
              if (!usePanelStore.getState().panels.includes(panel)) {
                result.deferred++
                return
              }
              // Replace in place: do not open/navigate a workspace tab or drop sibling panels.
              usePanelStore.setState((state) => ({
                panels: state.panels.map((current) =>
                  current === panel
                    ? {
                        ...panel,
                        node: effect?.node ?? panel.node,
                        viewState: effect?.childState ?? {},
                        hasChildState: true,
                        refreshMessage: effect?.node
                          ? undefined
                          : notice?.message,
                      }
                    : current
                ),
              }))
              result.refreshed++
            } catch {
              result.failed++
            }
          })
        )
        return result
      }),
    []
  )
}
