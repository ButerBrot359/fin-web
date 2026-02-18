import type { FC, SVGProps } from 'react'

export interface NavigationItem {
  id: string
  labelKey: string
  icon: FC<SVGProps<SVGSVGElement>>
  path?: string
  disabled?: boolean
}
