import { useSyncExternalStore } from 'react'
import { Dialog, DialogTitle, DialogContent, Drawer, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { getDialogStack, subscribeDialogs, popDialog } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'

export const DialogHost = () => {
  const stack = useSyncExternalStore(subscribeDialogs, getDialogStack)

  return (
    <>
      {stack.map((eff, i) => {
        if (!eff.node) return null

        const presentation =
          (eff.node.props?.presentation as string | undefined) ?? 'modal'

        if (presentation === 'drawer') {
          const width = (eff.node.props?.width as number | undefined) ?? 900

          return (
            <Drawer
              key={eff.node.id ?? i}
              anchor="right"
              open
              onClose={popDialog}
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
                  <IconButton onClick={popDialog}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </div>
                <NodeRenderer node={eff.node} />
              </div>
            </Drawer>
          )
        }

        return (
          <Dialog
            key={eff.node.id ?? i}
            open
            onClose={popDialog}
            maxWidth="md"
            fullWidth
          >
            {eff.node.props?.title != null && (
              <DialogTitle>{String(eff.node.props.title)}</DialogTitle>
            )}
            <DialogContent>
              <NodeRenderer node={eff.node} />
            </DialogContent>
          </Dialog>
        )
      })}
    </>
  )
}
