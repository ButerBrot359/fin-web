import type { FC, SVGProps } from 'react'

export interface ToolbarAction {
  id: string
  icon: FC<SVGProps<SVGSVGElement>>
  label: string
}
