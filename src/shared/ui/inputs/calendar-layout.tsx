import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'

import { pickersLayoutClasses } from '@mui/x-date-pickers/PickersLayout'

import { format, setMonth, setYear, startOfDay } from 'date-fns'
import type { Locale } from 'date-fns'
import { ru, kk } from 'date-fns/locale'

const FONT_FAMILY = '"Google Sans", system-ui, sans-serif'

/**
 * Контекст навигации календаря. Прокидывает в кастомную боковую панель текущую
 * (отображаемую) дату и колбэк выбора, чтобы панель могла переключать
 * месяц/год так же, как это делает сам пикер.
 */
interface CalendarNav {
  referenceValue: Date | null
  onSelectDate: (value: Date | null) => void
}

const CalendarNavContext = createContext<CalendarNav | null>(null)

interface CalendarNavProviderProps {
  value: CalendarNav
  children: ReactNode
}

export const CalendarNavProvider = ({
  value,
  children,
}: CalendarNavProviderProps) => (
  <CalendarNavContext.Provider value={value}>
    {children}
  </CalendarNavContext.Provider>
)

const localeByLang: Record<string, Locale> = { ru, kz: kk }

/** Короткие названия месяцев в текущей локали: «Янв», «Фев», … */
const useMonthLabels = (): string[] => {
  const { i18n } = useTranslation()
  const locale = localeByLang[i18n.language] ?? ru

  return useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => {
        const label = format(new Date(2021, month, 1), 'LLL', { locale })
        const clean = label.replace(/\.$/, '')
        return clean.charAt(0).toUpperCase() + clean.slice(1)
      }),
    [locale],
  )
}

const YEAR_FUTURE_SPAN = 5
const YEAR_PAST_SPAN = 35

/**
 * Боковая панель выбора года и месяца. Используется как слот `shortcuts`
 * пикера, поэтому располагается слева от сетки дней (штатная раскладка MUI),
 * а сама сетка дней рендерится без изменений.
 */
export const CalendarSidebar = () => {
  const nav = useContext(CalendarNavContext)
  const { t } = useTranslation()
  const monthLabels = useMonthLabels()
  const [yearOpen, setYearOpen] = useState(false)

  if (!nav) return null

  const reference = nav.referenceValue ?? startOfDay(new Date())
  const activeYear = reference.getFullYear()
  const activeMonth = reference.getMonth()

  const currentYear = new Date().getFullYear()
  const years = Array.from(
    { length: YEAR_FUTURE_SPAN + YEAR_PAST_SPAN + 1 },
    (_, i) => currentYear + YEAR_FUTURE_SPAN - i,
  )

  const selectMonth = (month: number) => {
    setYearOpen(false)
    nav.onSelectDate(setMonth(reference, month))
  }

  const selectYear = (year: number) => {
    setYearOpen(false)
    nav.onSelectDate(setYear(reference, year))
  }

  const selectToday = () => {
    setYearOpen(false)
    nav.onSelectDate(startOfDay(new Date()))
  }

  const renderMonthColumn = (offset: number) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {Array.from({ length: 6 }, (_, i) => {
        const month = offset + i
        const selected = month === activeMonth
        return (
          <ButtonBase
            key={month}
            onClick={() => selectMonth(month)}
            sx={{
              justifyContent: 'center',
              width: 52,
              height: 32,
              borderRadius: '8px',
              fontFamily: FONT_FAMILY,
              fontSize: 15,
              fontWeight: 500,
              color: selected ? '#ffffff' : '#222124',
              backgroundColor: selected ? '#2a75f4' : 'transparent',
              transition: 'background-color 0.15s, color 0.15s',
              '&:hover': {
                backgroundColor: selected ? '#2a75f4' : '#dbe7fd',
                color: selected ? '#ffffff' : '#2a75f4',
              },
            }}
          >
            {monthLabels[month]}
          </ButtonBase>
        )
      })}
    </Box>
  )

  return (
    <Box
      className={pickersLayoutClasses.shortcuts}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        borderRight: '1px solid #eceff4',
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Выбор года */}
      <Box sx={{ position: 'relative' }}>
        <ButtonBase
          onClick={() => {
            setYearOpen((open) => !open)
          }}
          sx={{
            width: '100%',
            justifyContent: 'space-between',
            gap: '4px',
            height: 36,
            padding: '0 10px 0 14px',
            borderRadius: '8px',
            backgroundColor: '#2a75f4',
            color: '#ffffff',
            fontFamily: FONT_FAMILY,
            fontSize: 16,
            fontWeight: 600,
            '&:hover': { backgroundColor: '#1f66db' },
          }}
        >
          {activeYear}
          <KeyboardArrowDownRoundedIcon
            sx={{
              fontSize: 20,
              color: 'inherit',
              transition: 'transform 0.15s',
              transform: yearOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        </ButtonBase>

        {yearOpen && (
          <Box
            sx={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 1,
              maxHeight: 220,
              overflowY: 'auto',
              padding: '4px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0px 3px 24px rgba(42, 117, 244, 0.4)',
            }}
          >
            {years.map((year) => {
              const selected = year === activeYear
              return (
                <ButtonBase
                  key={year}
                  onClick={() => {
                    selectYear(year)
                  }}
                  sx={{
                    width: '100%',
                    height: 30,
                    borderRadius: '6px',
                    fontFamily: FONT_FAMILY,
                    fontSize: 15,
                    fontWeight: selected ? 600 : 500,
                    color: selected ? '#2a75f4' : '#222124',
                    backgroundColor: selected ? '#dbe7fd' : 'transparent',
                    '&:hover': { backgroundColor: '#dbe7fd' },
                  }}
                >
                  {year}
                </ButtonBase>
              )
            })}
          </Box>
        )}
      </Box>

      {/* Сетка месяцев: слева январь–июнь, справа июль–декабрь */}
      <Box sx={{ display: 'flex', gap: '8px' }}>
        {renderMonthColumn(0)}
        {renderMonthColumn(6)}
      </Box>

      <ButtonBase
        onClick={selectToday}
        sx={{
          alignSelf: 'flex-start',
          marginTop: 'auto',
          padding: '4px 4px',
          color: '#2a75f4',
          fontFamily: FONT_FAMILY,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {t('calendar.today')}
      </ButtonBase>
    </Box>
  )
}

