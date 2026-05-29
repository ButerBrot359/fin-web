import { useEffect, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { useTreeStore } from '../lib/stores/tree-store'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'

export const SduiScreen: FC = () => {
  const location = useLocation()
  const tree = useTreeStore((s) => s.root)
  const reset = useTreeStore((s) => s.reset)
  const dispatch = useSduiDispatch()

  useEffect(() => {
    void dispatch({ type: 'OPEN' })

    return () => {
      void dispatch({ type: 'CLOSE' })
      reset()
    }
  }, [location.pathname])

  useEffect(() => {
    const handler = () => {
      const sid = useTreeStore.getState().formSessionId
      if (sid) viewTransport.closeBeacon(sid)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!tree) return <PageSkeleton />

  return <NodeRenderer node={tree} />
}
