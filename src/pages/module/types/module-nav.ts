import type { ModuleElement, ModuleItems } from '@/entities/module'

export interface NavItemProps {
  item: ModuleElement
  pageCode: string
}

export interface ModuleNavListProps {
  items: ModuleItems
  pageCode: string
}
