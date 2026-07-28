// Один день года из props узла CALENDAR
export interface CalendarDay {
  data: string // 'YYYY-MM-DD'
  vklyuchen: boolean // рабочий день
  ruchnoy: boolean // изменён вручную
}

// props узла CALENDAR (см. контракт в спеке)
export interface CalendarNodeProps {
  god?: number
  godMin?: number | null
  godMax?: number | null
  redaktiruemyy?: boolean
  dni?: CalendarDay[]
}

// Ячейка недельной сетки: номер дня месяца (1..31) или null для добивки
export type WeekCell = number | null
