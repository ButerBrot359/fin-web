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
  // Диалог «Сохранить изменения?» с тремя ответами — тот же, что у карточки
  // документа. Эксклюзивен, как confirm.
  | 'unsavedChanges'
  // Фоновая операция запущена командой (SCRUM-330 §3.3): в эффекте — полный
  // объект задачи (effect.task). Фронт поллит GET /api/tasks/{id} и по
  // терминальному статусу шлёт COMMAND task.finished:<id> в ту же сессию.
  | 'taskStarted'
  // SCRUM-317: единый отчёт о проверке (панель «Ошибки» + тултип-навигатор).
  // Пустой отчёт обязателен к обработке — им гасится панель прошлой попытки.
  | 'validationReport'
  // SCRUM-317 §4.2: модальное предупреждение (1С «ПоказатьПредупреждение»).
  // Эксклюзивен, как confirm: обход массива эффектов обрывается на нём.
  | 'alert'

// HYDRATE — догрузка данных deferred-нод (SCRUM-384): ответ приходит в
// существующем формате statePatch+patches, tree/state не возвращаются.
export type ActionType = 'OPEN' | 'EVENT' | 'COMMAND' | 'CLOSE' | 'HYDRATE'
