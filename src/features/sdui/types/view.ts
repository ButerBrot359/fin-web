import type { AsyncTask } from '@/entities/async-task'

import type { ActionType, EffectType, NodeType, PatchOp } from './node-types'

export interface ViewNode {
  id: string
  type: NodeType
  props?: Record<string, unknown>
  binding?: string
  value?: unknown
  children?: ViewNode[]
  actions?: ViewNodeAction[]
}

// Метаданные поведения действия (SCRUM-283): бэк описывает, что делать
// вокруг команды, чтобы фронт не анализировал её имя.
export interface ActionBehavior {
  // Перед отправкой команды слить несохранённые строки редактируемых ТЧ в state
  flushPendingTables?: boolean
  // После успешного ответа снять признак «есть изменения»
  resetsDirty?: boolean
  // После успеха закрыть вкладку/панель (навигация — только через effect navigate)
  closeAfter?: boolean
}

// SCRUM-288: готовый запрос действия. url — БЕЗ плейсхолдеров (гарантия сервера,
// бэк-тест ActionRequestUrlIsReadyTest). SCRUM-362 B-7: method обязателен и
// приходит явной строкой (правило «пусто ⇒ GET» из контракта убрано насовсем);
// неизвестное значение — warn + отказ исполнять, не тихий GET.
export interface ActionRequest {
  method: 'GET' | 'POST'
  url: string
  body?: Record<string, unknown> | null
}

export interface ViewNodeAction {
  trigger: string
  actionId: string
  command?: string
  behavior?: ActionBehavior | null
  requiresSelectedRow?: boolean | null // SCRUM-284 Δ4
  selectionField?: string | null // SCRUM-284 Δ4
  // SCRUM-288 §2.1: если задан — фронт НЕ диспатчит command, а исполняет ЭТОТ запрос.
  request?: ActionRequest | null
}

// SCRUM-302: дескриптор доменной кнопки командной панели ТЧ (props.tableCommands
// TABLE-узла). command — непрозрачная строка, фронт её не разбирает; behavior —
// единственный источник поведения (никаких списков мутирующих команд).
// Условная заливка строки таблицы (props.rowAppearance TABLE-узла) — перенос
// `УсловноеОформление` формы из 1С. Правило: «в колонке `binding` значение
// `equals` ⇒ фон строки `backgroundColor`». Разбор и применение —
// lib/utils/row-appearance.ts.
export interface RowAppearanceRule {
  /** Код колонки, по значению которой идёт отбор. Колонка может быть скрытой. */
  binding: string
  /** Искомое значение. Отсутствует в контракте ⇒ `true` (булев признак). */
  equals?: unknown
  /** CSS-цвет фона строки, как его прислал бэк («rgb(200, 255, 210)»). */
  backgroundColor: string
}

export interface TableCommandDescriptor {
  command: string
  label: string
  labelKz?: string | null
  enabled: boolean
  disabledReason?: string | null
  behavior: ActionBehavior
  column?: string | null // служебное поле бэка, фронт не использует
  inMoreMenu?: boolean // true ⇒ продублировать пункт в меню «Ещё»
}

export interface ViewAction {
  type: ActionType
  sourceNodeId?: string
  trigger?: string
  command?: string
  value?: unknown
  layoutCode?: string
  // Маркер полноты снимка строк ТЧ на table-level EVENT (спека reference-cell §2.2):
  // true = полный массив, бэк может делать full-replace (включая пустой [] = удалить все)
  fullSnapshot?: boolean
  // SCRUM-384 §3.3: id deferred-нод для догрузки. Читается бэком только на
  // HYDRATE; рекомендованная стратегия — один nodeId на запрос, параллельно.
  nodeIds?: string[]
  // SCRUM-276 (черновики форм): на CLOSE true = пользователь ответил
  // «Не сохранять» — сервер снимает черновик. CLOSE без флага (навигация,
  // размонтирование экрана) черновик сохраняет.
  discardDraft?: boolean
}

export interface ViewRequest {
  formSessionId?: string | null
  revision?: number | null
  layoutCode?: string | null
  route?: string
  action: ViewAction
  state?: Record<string, unknown>
  // Язык интерфейса формы; сервер читает только на OPEN (SCRUM-268)
  language?: string
}

// Метаданные вкладки — приходят ТОЛЬКО на OPEN, могут быть null
// (оболочка `/` и все EVENT/COMMAND). §4.4/§5.6 бэк-спеки SCRUM-290.
export interface ViewTabMeta {
  kind: string
  // Локализованный серверный заголовок рабочей вкладки (SCRUM-181):
  // фронт не переводит и не выводит его сам — только применяет.
  title?: string
  icon?: string
  closable?: boolean
}

export interface ViewResponse {
  formSessionId: string
  revision: number
  tree?: ViewNode
  state?: Record<string, unknown>
  patches?: ViewPatch[]
  statePatch?: Record<string, unknown>
  effects?: ViewEffect[]
  // Дескриптор «закрыть грязную вкладку» — приходит только на OPEN (SCRUM-283)
  onDirtyClose?: ViewNodeAction | null
  tab?: ViewTabMeta | null
  // SCRUM-288 §2.5: авторитетный признак несохранённого. true/false перекрывают
  // клиентский флаг; null/отсутствие — «решай сам». На OPEN не приходит.
  dirty?: boolean | null
  // SCRUM-277 §3.1: true ⇒ команда завершилась неуспехом на 200-ответе —
  // closeAfter применять нельзя (карточка остаётся открытой).
  commandFailed?: boolean | null
  // SCRUM-276 (черновики форм): серверный «scratch отличается от снимка OPEN».
  // Приходит на OPEN/EVENT/COMMAND; true поднимает клиентский dirty (латч),
  // false его НЕ сбрасывает — вопрос «Сохранить изменения?» задаётся при
  // клиентском dirty ИЛИ серверном formDirty. null — сессии больше нет.
  formDirty?: boolean | null
}

export interface ViewPatch {
  op: PatchOp
  nodeId?: string
  binding?: string
  key?: string
  value?: unknown
  parentId?: string
  index?: number
  node?: ViewNode
  options?: unknown
}

export interface ViewEffect {
  type: EffectType
  route?: string
  // navigate: открыть маршрут ОТДЕЛЬНОЙ рабочей вкладкой, не трогая текущую
  // («Создать на основании» в эталоне 1С открывает новое окно). Решение принимает
  // бэк: фронт не разбирает состав маршрута и не знает список команд.
  openInNewTab?: boolean
  node?: ViewNode
  id?: string
  level?: string
  message?: string
  url?: string
  // Команда, которую фронт шлёт по «Да» в диалоге confirm (SCRUM-244 v3 §1.1).
  // Непрозрачная строка: не парсить, не собирать — сервер валидирует её сам.
  confirmCommand?: string
  // SCRUM-288 §3.1: download с телом — ровно одно из url/request заполнено.
  request?: ActionRequest | null
  // SCRUM-288 §2.3: session-less подтверждение (панель) — исполнить запрос по «Да».
  // Ровно одно из confirmCommand/confirmRequest заполнено на эффекте confirm.
  confirmRequest?: ActionRequest | null
  // SCRUM-288 §2.4: behavior подтверждённой команды (resetsDirty и пр.).
  confirmBehavior?: ActionBehavior | null
  // SCRUM-276: серверный откат по «Нет» (например, field.rollback:Nomer после
  // правки номера). Без него «Нет» — локальный no-op, и введённое значение
  // осталось бы и в поле, и в серверной сессии.
  cancelCommand?: string
  // unsavedChanges: ответы «Да, сохранить» и «Нет, не сохранять». Обе —
  // КОМАНДЫ в ту же сессию: несохранённое дочерней формы лежит на сервере, и
  // «не сохранять» одним лишь закрытием панели его не выбросить.
  saveCommand?: string
  saveBehavior?: ActionBehavior | null
  discardCommand?: string
  discardBehavior?: ActionBehavior | null
  // taskStarted (SCRUM-330 §3.3): задача целиком, а не одним id — между
  // командой и первым опросом панели уже есть что показать.
  task?: AsyncTask | null
  sessionId?: string
  childRevision?: number
  childState?: Record<string, unknown>
  applyToParentSessionId?: string
  applyToParentTargetNodeId?: string
  applyToParentCommand?: string
  applyToParentValue?: unknown
}

export interface NodeProps {
  node: ViewNode
}

export interface ConflictError {
  // Открытый тип НАМЕРЕННО: закрытый union маскировал расхождение с проводом
  // (код приходил в поле error и никогда не матчился) — SCRUM-244 §4.1
  code: string
  formSessionId?: string
  currentRevision?: number
  snapshot?: { state: Record<string, unknown> }
  reason?: string
  // Пользовательский текст из стандартного тела ошибки (SCRUM-330: тексты
  // OBJECT_LOCKED/LOCK_CONFLICT уже содержат имя объекта и владельца)
  message?: string
}
