import type { FC } from 'react'

import type { NodeProps } from '../types/view'

// Shell
import { AppShellNode } from '../ui/nodes/shell/app-shell-node'
import { TopBarNode } from '../ui/nodes/shell/top-bar-node'
import { SidebarNode } from '../ui/nodes/shell/sidebar-node'
import { WorkspaceNode } from '../ui/nodes/shell/workspace-node'
// Layout
import { PageNode } from '../ui/nodes/layout/page-node'
import { VStackNode } from '../ui/nodes/layout/vstack-node'
import { HStackNode } from '../ui/nodes/layout/hstack-node'
import { GridNode } from '../ui/nodes/layout/grid-node'
import { GroupNode } from '../ui/nodes/layout/group-node'
import { TabsNode } from '../ui/nodes/layout/tabs-node'
import { TabNode } from '../ui/nodes/layout/tab-node'
import { ToolbarNode } from '../ui/nodes/layout/toolbar-node'
import { SeparatorNode } from '../ui/nodes/layout/separator-node'
import { SpacerNode } from '../ui/nodes/layout/spacer-node'
// Display
import { LabelNode } from '../ui/nodes/display/label-node'
import { TextNode } from '../ui/nodes/display/text-node'
import { BadgeNode } from '../ui/nodes/display/badge-node'
import { IconNode } from '../ui/nodes/display/icon-node'
// Fields
import { TextFieldNode } from '../ui/nodes/fields/text-field-node'
import { TextAreaNode } from '../ui/nodes/fields/text-area-node'
import { NumberFieldNode } from '../ui/nodes/fields/number-field-node'
import { DateFieldNode } from '../ui/nodes/fields/date-field-node'
import { DatetimeFieldNode } from '../ui/nodes/fields/datetime-field-node'
import { CheckboxFieldNode } from '../ui/nodes/fields/checkbox-field-node'
import { EnumFieldNode } from '../ui/nodes/fields/enum-field-node'
import { ReferenceFieldNode } from '../ui/nodes/fields/reference-field-node'
// Composite
import { TableNode } from '../ui/nodes/composite/table-node'
import { TableColumnNode } from '../ui/nodes/composite/table-column-node'
import { ColumnGroupNode } from '../ui/nodes/composite/column-group-node'
import { ObjectFieldNode } from '../ui/nodes/composite/object-field-node'
import { ListNode } from '../ui/nodes/composite/list-node'
// Action
import { ButtonNode } from '../ui/nodes/action/button-node'
import { MenuItemNode } from '../ui/nodes/action/menu-item-node'
import { LinkNode } from '../ui/nodes/action/link-node'

const registry: Record<string, FC<NodeProps>> = {
  APP_SHELL: AppShellNode,
  TOP_BAR: TopBarNode,
  SIDEBAR: SidebarNode,
  WORKSPACE: WorkspaceNode,
  PAGE: PageNode,
  VSTACK: VStackNode,
  HSTACK: HStackNode,
  GRID: GridNode,
  GROUP: GroupNode,
  TABS: TabsNode,
  TAB: TabNode,
  TOOLBAR: ToolbarNode,
  SEPARATOR: SeparatorNode,
  SPACER: SpacerNode,
  LABEL: LabelNode,
  TEXT: TextNode,
  BADGE: BadgeNode,
  ICON: IconNode,
  TEXT_FIELD: TextFieldNode,
  TEXT_AREA: TextAreaNode,
  NUMBER_FIELD: NumberFieldNode,
  DATE_FIELD: DateFieldNode,
  DATETIME_FIELD: DatetimeFieldNode,
  CHECKBOX_FIELD: CheckboxFieldNode,
  ENUM_FIELD: EnumFieldNode,
  REFERENCE_FIELD: ReferenceFieldNode,
  TABLE: TableNode,
  TABLE_COLUMN: TableColumnNode,
  COLUMN_GROUP: ColumnGroupNode,
  OBJECT_FIELD: ObjectFieldNode,
  LIST: ListNode,
  BUTTON: ButtonNode,
  MENU_ITEM: MenuItemNode,
  LINK: LinkNode,
}

export function getComponent(type: string): FC<NodeProps> | undefined {
  return registry[type]
}
