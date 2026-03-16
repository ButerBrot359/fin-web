import { createTheme } from '@mui/material/styles'
import type {} from '@mui/x-date-pickers/themeAugmentation'

export const theme = createTheme({
  palette: {
    primary: { main: '#2a75f4' },
    error: { main: '#f4482a' },
    text: {
      primary: '#222124',
      secondary: '#9fa9ba',
    },
  },
  components: {
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
        fullWidth: true,
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#ffffff',
          border: '1px solid #c3cee0',
          minHeight: 50,
          '&:hover': { backgroundColor: '#ffffff' },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
            borderColor: '#2a75f4',
          },
          '&.Mui-error': {
            borderColor: '#f4482a',
          },
          '&::before, &::after': { display: 'none' },
        },
        input: {
          paddingLeft: 20,
          paddingRight: 20,
          fontSize: 16,
          fontWeight: 500,
          color: '#222124',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#9fa9ba',
          fontWeight: 500,
          left: 8,
          '&.MuiInputLabel-shrink': {
            color: '#2a75f4',
          },
          '&.Mui-error': {
            color: '#f4482a',
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          position: 'absolute',
          bottom: -18,
          left: 0,
          marginLeft: 0,
          fontSize: 12,
          '&.Mui-error': {
            color: '#f4482a',
          },
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          position: 'relative',
          marginBottom: 4,
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        inputRoot: {
          paddingTop: '0 !important',
          paddingBottom: '0 !important',
          paddingRight: '4px !important',
          paddingLeft: '20px !important',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: '4px',
        },
        input: {
          paddingTop: '25px !important',
          paddingBottom: '8px !important',
          paddingLeft: '0 !important',
        },
        endAdornment: {
          position: 'static',
          transform: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        },
        popupIndicator: {
          padding: '4px',
          borderRadius: '6px',
          marginRight: 0,
          '& .MuiSvgIcon-root': { fontSize: 20 },
        },
        clearIndicator: {
          padding: '4px',
          borderRadius: '6px',
          marginRight: 0,
          '& .MuiSvgIcon-root': { fontSize: 20 },
        },
        paper: {
          borderRadius: 8,
          boxShadow: '0px 3px 24px rgba(42, 117, 244, 0.4)',
        },
        option: {
          '&[aria-selected="true"]': {
            backgroundColor: '#dbe7fd !important',
            color: '#2a75f4',
          },
        },
      },
    },
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
          backgroundColor: '#ffffff',
          border: '1px solid #c3cee0',
          minHeight: 50,
          '&:hover': { backgroundColor: '#ffffff' },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
            borderColor: '#2a75f4',
          },
          '&.Mui-error': {
            borderColor: '#f4482a',
          },
          '&::before, &::after': { display: 'none' },
        },
        input: {
          paddingLeft: 20,
          paddingRight: 20,
          fontSize: 16,
          fontWeight: 500,
          color: '#222124',
        },
        sectionsContainer: {
          paddingLeft: 20,
          paddingRight: 8,
          fontSize: 16,
          fontWeight: 500,
          color: '#222124',
        },
      },
    },
    MuiPickerPopper: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: '0px 3px 24px rgba(42, 117, 244, 0.4)',
        },
      },
    },
    MuiDateCalendar: {
      styleOverrides: {
        root: {
          fontFamily: '"Google Sans", system-ui, sans-serif',
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
          fontFamily: '"Google Sans", system-ui, sans-serif',
          color: '#222124',
          '&.Mui-selected': {
            backgroundColor: '#2a75f4',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#2a75f4',
            },
            '&:focus': {
              backgroundColor: '#2a75f4',
            },
          },
          '&.MuiPickersDay-today:not(.Mui-selected)': {
            backgroundColor: '#e0eafc',
            borderColor: 'transparent',
            color: '#2a75f4',
          },
          '&:not(.Mui-selected):not(.MuiPickersDay-today).MuiPickersDay-dayOutsideMonth':
            {
              color: '#9fa9ba',
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
          color: '#222124',
          fontFamily: '"Google Sans", system-ui, sans-serif',
          '&:nth-of-type(6), &:nth-of-type(7)': {
            color: '#2a75f4',
          },
        },
      },
    },
    MuiPickersCalendarHeader: {
      styleOverrides: {
        label: {
          fontSize: 16,
          fontWeight: 500,
          color: '#222124',
          fontFamily: '"Google Sans", system-ui, sans-serif',
        },
      },
    },
    MuiMonthCalendar: {
      styleOverrides: {
        root: {
          fontFamily: '"Google Sans", system-ui, sans-serif',
        },
      },
    },
    MuiYearCalendar: {
      styleOverrides: {
        root: {
          fontFamily: '"Google Sans", system-ui, sans-serif',
        },
      },
    },
  },
})
