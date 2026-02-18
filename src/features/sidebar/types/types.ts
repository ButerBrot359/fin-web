import type { FC, SVGProps } from 'react'

export interface NavigationItem {
  id: string
  label: string
  icon: FC<SVGProps<SVGSVGElement>>
}
