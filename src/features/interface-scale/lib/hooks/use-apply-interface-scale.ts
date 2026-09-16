import { useEffect } from 'react'

import { useInterfaceScaleStore } from '../../model/interface-scale-store'

export const useApplyInterfaceScale = () => {
  const scale = useInterfaceScaleStore((s) => s.scale)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('zoom', String(scale))

    return () => {
      root.style.removeProperty('zoom')
    }
  }, [scale])
}
