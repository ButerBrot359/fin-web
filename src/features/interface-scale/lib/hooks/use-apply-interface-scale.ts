import { useEffect } from 'react'

import { syncUiScale } from '@/shared/design/apply-server-theme'

import { useInterfaceScaleStore } from '../../model/interface-scale-store'

export const useApplyInterfaceScale = () => {
  const scale = useInterfaceScaleStore((s) => s.scale)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('zoom', String(scale))
    syncUiScale()

    return () => {
      root.style.removeProperty('zoom')
      syncUiScale()
    }
  }, [scale])
}
