import { lazy, Suspense, useState, useEffect } from 'react'
import type { FC } from 'react'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

import type { NodeProps } from '../../../types/view'

const iconCache = new Map<string, FC>()

const FallbackIcon: FC = () => <HelpOutlineIcon />

function getIconComponent(name: string): FC {
  if (iconCache.has(name)) {
    return iconCache.get(name)!
  }

  const LazyIcon = lazy(() =>
    import(`@mui/icons-material/${name}.js`).then((mod) => ({
      default: mod.default as FC,
    })).catch(() => ({
      default: FallbackIcon,
    }))
  )

  iconCache.set(name, LazyIcon as unknown as FC)
  return LazyIcon as unknown as FC
}

export const IconNode: FC<NodeProps> = ({ node }) => {
  const name = (node.props?.name as string | undefined) ?? ''
  const [Icon, setIcon] = useState<FC>(() => FallbackIcon)

  useEffect(() => {
    if (!name) return
    setIcon(() => getIconComponent(name))
  }, [name])

  return (
    <Suspense fallback={<HelpOutlineIcon />}>
      <Icon />
    </Suspense>
  )
}
