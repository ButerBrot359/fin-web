import type { Components, Theme } from '@mui/material/styles'
import type {} from '@mui/x-date-pickers/themeAugmentation'

import {
  cssVar,
  fontFamily,
  palette,
  semantic,
  shadows,
} from '@/shared/design/tokens'
import { POPUP_Z } from '@/shared/lib/utils/overlay-z-index'

export const pickersComponents: Components<Omit<Theme, 'components'>> = {
  MuiPickersTextField: {
    defaultProps: {
      variant: 'filled',
      fullWidth: true,
    },
  },
  MuiPickersFilledInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        backgroundColor: cssVar(palette.ui01),
        border: `1px solid ${cssVar(semantic.divider)}`,
        minHeight: 38,
        // У пикеров свои имена size-классов (MuiPickersInputBase-*), общий
        // MuiInputBase-sizeSmall на них не вешается.
        // height прибит: число (FilledInput) и дата (Pickers) в одной
        // строке обязаны быть ровно одной высоты (36px), а не 36/37.
        '&.MuiInputBase-sizeSmall, &.MuiPickersInputBase-sizeSmall, &.MuiPickersInputBase-inputSizeSmall':
          {
            minHeight: 32,
            height: 36,
          },
        '&:hover': { backgroundColor: cssVar(palette.ui01) },
        '&.Mui-focused': {
          backgroundColor: cssVar(palette.ui01),
          borderColor: cssVar(semantic.primary),
        },
        '&.Mui-error': {
          borderColor: cssVar(semantic.error),
        },
        '&.Mui-disabled': {
          backgroundColor: cssVar(palette.ui02),
          cursor: 'not-allowed',
          '&:hover': { backgroundColor: cssVar(palette.ui02) },
        },
        '&::before, &::after': { display: 'none' },
      },
      input: {
        paddingTop: 18,
        paddingBottom: 4,
        paddingLeft: 20,
        paddingRight: 20,
        fontSize: 14,
        fontWeight: 500,
        color: cssVar(semantic.textPrimary),
        '&.Mui-disabled': { cursor: 'not-allowed' },
        '&.MuiInputBase-inputSizeSmall': {
          paddingTop: 6,
          paddingBottom: 6,
        },
      },
      sectionsContainer: {
        paddingTop: 18,
        paddingBottom: 4,
        paddingLeft: 20,
        paddingRight: 8,
        fontSize: 14,
        fontWeight: 500,
        color: cssVar(semantic.textPrimary),
        '.MuiInputBase-sizeSmall &, .MuiPickersInputBase-sizeSmall &, .MuiPickersInputBase-inputSizeSmall &':
          {
            paddingTop: 6,
            paddingBottom: 6,
          },
      },
    },
  },
  MuiPickerPopper: {
    styleOverrides: {
      root: {
        zIndex: POPUP_Z,
      },
      paper: {
        borderRadius: 8,
        boxShadow: cssVar(shadows.popup),
      },
    },
  },
  MuiDateCalendar: {
    styleOverrides: {
      root: {
        fontFamily,
      },
    },
  },
  MuiPickersDay: {
    styleOverrides: {
      root: {
        width: 32,
        height: 32,
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 500,
        fontFamily,
        color: cssVar(semantic.textPrimary),
        '&.Mui-selected': {
          backgroundColor: cssVar(semantic.primary),
          color: cssVar(palette.ui01),
          '&:hover': {
            backgroundColor: cssVar(semantic.primary),
          },
          '&:focus': {
            backgroundColor: cssVar(semantic.primary),
          },
        },
        '&.MuiPickersDay-today:not(.Mui-selected)': {
          backgroundColor: cssVar(palette.ui07),
          borderColor: 'transparent',
          color: cssVar(semantic.primary),
        },
        '&:not(.Mui-selected):not(.MuiPickersDay-today).MuiPickersDay-dayOutsideMonth':
          {
            color: cssVar(semantic.textSecondary),
          },
      },
    },
  },
  MuiDayCalendar: {
    styleOverrides: {
      weekDayLabel: {
        width: 32,
        height: 32,
        fontSize: 14,
        fontWeight: 500,
        color: cssVar(semantic.textPrimary),
        fontFamily,
        '&:nth-of-type(6), &:nth-of-type(7)': {
          color: cssVar(semantic.primary),
        },
      },
    },
  },
  MuiPickersCalendarHeader: {
    styleOverrides: {
      label: {
        fontSize: 16,
        fontWeight: 500,
        color: cssVar(semantic.textPrimary),
        fontFamily,
      },
    },
  },
  MuiMonthCalendar: {
    styleOverrides: {
      root: {
        fontFamily,
      },
    },
  },
  MuiYearCalendar: {
    styleOverrides: {
      root: {
        fontFamily,
      },
    },
  },
}
