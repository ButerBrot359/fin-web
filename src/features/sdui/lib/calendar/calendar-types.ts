// SCRUM-362 B-2: generic-контракт узла CALENDAR (wave-1 §7). Год отдаётся
// целиком (PUSH-модель), узел ничего не дозапрашивает. Легаси-транслит
// (god/godMin/godMax/redaktiruemyy/dni/godZapolnen/vidyDney) бэк шлёт двойной
// отдачей до нашего сигнала о выкатке — фронт читает ТОЛЬКО новые ключи.

export type CalendarMode = 'inclusion' | 'dayKind'

/** Вид дня производственного календаря (только mode=dayKind). */
export interface CalendarDayKind {
  code: string
  title: string
}

/** День режима inclusion (график работы, read-only с SCRUM-278). */
export interface CalendarInclusionDay {
  date: string // 'YYYY-MM-DD'
  active: boolean // рабочий день
  manual: boolean // изменён вручную
}

/**
 * День режима dayKind (производственный календарь). kind: null — на дату нет
 * записи регистра (год не заполнен), состояние отличимое от любого вида.
 */
export interface CalendarDayKindDay {
  date: string // 'YYYY-MM-DD'
  kind: string | null
  kindTitle?: string | null
  transferDate?: string | null // 'YYYY-MM-DD' — куда перенесён день
}

// props узла CALENDAR (контракт wave-1 §7)
export interface CalendarNodeProps {
  mode?: CalendarMode
  year?: number
  minYear?: number | null
  maxYear?: number | null // null ⇒ без верхней границы
  editable?: boolean
  // только mode=dayKind:
  yearFilled?: boolean
  dayKinds?: CalendarDayKind[]
  days?: CalendarInclusionDay[] | CalendarDayKindDay[]
}

// Ячейка недельной сетки: номер дня месяца (1..31) или null для добивки
export type WeekCell = number | null
