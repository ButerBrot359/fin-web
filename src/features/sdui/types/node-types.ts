export type NodeType =
  // Shell (4)
  | 'APP_SHELL' | 'TOP_BAR' | 'SIDEBAR' | 'WORKSPACE'
  // Layout (10)
  | 'PAGE' | 'VSTACK' | 'HSTACK' | 'GRID' | 'GROUP'
  | 'TABS' | 'TAB' | 'TOOLBAR' | 'SEPARATOR' | 'SPACER'
  // Display (4)
  | 'LABEL' | 'TEXT' | 'BADGE' | 'ICON'
  // Fields (8)
  | 'TEXT_FIELD' | 'TEXT_AREA' | 'NUMBER_FIELD' | 'DATE_FIELD'
  | 'DATETIME_FIELD' | 'CHECKBOX_FIELD' | 'ENUM_FIELD' | 'REFERENCE_FIELD'
  // Composite (3)
  | 'TABLE' | 'TABLE_COLUMN' | 'OBJECT_FIELD'
  // Action (3)
  | 'BUTTON' | 'MENU_ITEM' | 'LINK'

export type PatchOp =
  | 'setProp' | 'setValue'
  | 'replaceNode' | 'insertNode' | 'removeNode' | 'moveNode'
  | 'setOptions'

export type EffectType = 'navigate' | 'openDialog' | 'closeDialog' | 'notify' | 'download'

export type ActionType = 'OPEN' | 'EVENT' | 'COMMAND' | 'CLOSE'
