import { useSyncExternalStore } from 'react'
import { Dialog, DialogTitle, DialogContent } from '@mui/material'

import { getDialogStack, subscribeDialogs, popDialog } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'

export const DialogHost = () => {
  const stack = useSyncExternalStore(subscribeDialogs, getDialogStack)

  return (
    <>
      {stack.map((eff, i) =>
        eff.node ? (
          <Dialog
            key={eff.node.id ?? i}
            open
            onClose={popDialog}
            maxWidth="md"
            fullWidth
          >
            {eff.node.props?.title && (
              <DialogTitle>{String(eff.node.props.title)}</DialogTitle>
            )}
            <DialogContent>
              <NodeRenderer node={eff.node} />
            </DialogContent>
          </Dialog>
        ) : null,
      )}
    </>
  )
}
