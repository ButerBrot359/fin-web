export type NodeType =
  // Shell (4)
  | 'APP_SHELL'
  | 'TOP_BAR'
  | 'SIDEBAR'
  | 'WORKSPACE'
  // Layout (10)
  | 'PAGE'
  | 'VSTACK'
  | 'HSTACK'
  | 'GRID'
  | 'GROUP'
  | 'TABS'
  | 'TAB'
  | 'TOOLBAR'
  | 'SEPARATOR'
  | 'SPACER'
  // Display (4)
  | 'LABEL'
  | 'TEXT'
  | 'BADGE'
  | 'ICON'
  // Fields (8)
  | 'TEXT_FIELD'
  | 'TEXT_AREA'
  | 'NUMBER_FIELD'
  | 'DATE_FIELD'
  | 'DATETIME_FIELD'
  | 'CHECKBOX_FIELD'
  | 'ENUM_FIELD'
  | 'REFERENCE_FIELD'
  // Composite (8)
  | 'TABLE'
  | 'TABLE_COLUMN'
  | 'COLUMN_GROUP'
  | 'OBJECT_FIELD'
  | 'LIST'
  | 'CALENDAR'
  | 'PRODUCTION_CALENDAR_CLASSIFIER_PICKER'
  | 'REPORT_RESULT'
  // Action (3)
  | 'BUTTON'
  | 'MENU_ITEM'
  | 'LINK'

export type PatchOp =
  | 'setProp'
  | 'setValue'
  | 'replaceNode'
  | 'insertNode'
  | 'removeNode'
  | 'moveNode'
  | 'setOptions'

export type EffectType =
  | 'navigate'
  | 'openDialog'
  | 'closeDialog'
  | 'notify'
  | 'download'
  | 'refresh'
  | 'confirm'
  | 'replaceUrl'

// HYDRATE — догрузка данных deferred-нод (SCRUM-384): ответ приходит в
// существующем формате statePatch+patches, tree/state не возвращаются.
export type ActionType = 'OPEN' | 'EVENT' | 'COMMAND' | 'CLOSE' | 'HYDRATE'
