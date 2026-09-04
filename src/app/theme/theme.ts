import { createTheme } from '@mui/material/styles'
import type {} from '@mui/x-date-pickers/themeAugmentation'

import {
  cssVar,
  fontFamily,
  palette,
  semantic,
  shadows,
} from '@/shared/design/tokens'
import { POPUP_Z } from '@/shared/lib/utils/overlay-z-index'

export const theme = createTheme({
  // ВАЖНО: palette использует .value (hex-литерал), а не cssVar().
  // Причина: MUI augmentColor/alpha (decomposeColor) не парсит var()-строки и падает при createTheme.
  // Следствие: эти четыре цвета (primary, error, text.primary, text.secondary) не runtime-темизируемы.
  // Серверная тема фазы 2 потребует пересоздания темы для изменения этих цветов (см. спеку §4.1).
  // StyleOverrides используют cssVar() для рантайм CSS-переменных.
  palette: {
    primary: { main: semantic.primary.value },
    error: { main: semantic.error.value },
    text: {
      primary: semantic.textPrimary.value,
      secondary: semantic.textSecondary.value,
    },
  },
  // Google Sans для всей MUI-типографики (K-2 аудита Ф3): без этого h6 и
  // прочие variant'ы рендерились дефолтным Roboto.
  typography: {
    fontFamily,
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
          backgroundColor: cssVar(palette.ui01),
          border: `1px solid ${cssVar(semantic.divider)}`,
          minHeight: 44,
          '&.MuiInputBase-sizeSmall': {
            minHeight: 32,
          },
          '&:hover': { backgroundColor: cssVar(palette.ui01) },
          '&.Mui-focused': {
            backgroundColor: cssVar(palette.ui01),
            borderColor: cssVar(semantic.primary),
          },
          '&.Mui-error': {
            borderColor: cssVar(semantic.error),
          },
          // Заблокированное поле: серая заливка, без ховер-реакции — иначе
          // выглядит активным (даты/числа «Графиков работы»).
          '&.Mui-disabled': {
            backgroundColor: cssVar(palette.ui02),
            cursor: 'not-allowed',
            '&:hover': { backgroundColor: cssVar(palette.ui02) },
          },
          '&::before, &::after': { display: 'none' },
        },
        input: {
          paddingTop: 22,
          paddingBottom: 6,
          paddingLeft: 20,
          paddingRight: 20,
          fontSize: 16,
          fontWeight: 500,
          color: cssVar(semantic.textPrimary),
          '&.Mui-disabled': { cursor: 'not-allowed' },
          '&.MuiInputBase-inputSizeSmall': {
            paddingTop: 6,
            paddingBottom: 6,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: cssVar(semantic.textSecondary),
          fontWeight: 500,
          left: 8,
          // Figma «Input» (53:592): Filled без фокуса — label остаётся серым
          // (UI 05); синий — только в фокусе. Порядок правил важен: focused
          // объявлен после shrink и перебивает его.
          '&.MuiInputLabel-shrink': {
            color: cssVar(semantic.textSecondary),
          },
          '&.Mui-focused': {
            color: cssVar(semantic.primary),
          },
          '&.Mui-error': {
            color: cssVar(semantic.error),
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
            color: cssVar(semantic.error),
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
        popper: {
          zIndex: POPUP_Z,
        },
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
          paddingTop: '22px !important',
          paddingBottom: '6px !important',
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
          boxShadow: cssVar(shadows.popup),
        },
        option: {
          minHeight: 40,
          // Figma «Dropdown menu» (306:9741): ховер пункта — светло-голубая
          // подложка с синим текстом, как у tertiary-кнопок.
          '&:hover, &.Mui-focused': {
            backgroundColor: cssVar(semantic.selection),
            color: cssVar(semantic.primary),
          },
          '&[aria-selected="true"]': {
            backgroundColor: `${cssVar(semantic.selection)} !important`,
            color: cssVar(semantic.primary),
          },
        },
      },
    },
    // Табы форм/панелей по Figma (side-panel 324:13541, компонент Tab):
    // активный — тёмная плашка с белым текстом, неактивные — белые, обычный
    // регистр; индикатор — синяя полоска под баром.
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 36 },
        indicator: {
          height: 3,
          borderRadius: 2,
          backgroundColor: cssVar(semantic.primary),
        },
        flexContainer: { gap: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: 16,
          fontWeight: 500,
          minHeight: 36,
          padding: '8px 16px',
          color: cssVar(semantic.textPrimary),
          backgroundColor: cssVar(palette.ui01),
          borderRadius: '8px 8px 0 0',
          '&:hover:not(.Mui-selected)': {
            color: cssVar(semantic.primary),
          },
          '&.Mui-selected': {
            backgroundColor: cssVar(palette.ui06),
            color: cssVar(palette.ui01),
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: cssVar(shadows.popup),
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        // Figma «Dropdown menu» (306:9741): пункт 40px, Body2, синий ховер
        root: {
          minHeight: 40,
          fontSize: 14,
          fontWeight: 500,
          color: cssVar(semantic.textPrimary),
          '&:hover, &.Mui-focusVisible': {
            backgroundColor: cssVar(semantic.selection),
            color: cssVar(semantic.primary),
          },
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: cssVar(semantic.selection),
            color: cssVar(semantic.primary),
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
          backgroundColor: cssVar(palette.ui01),
          border: `1px solid ${cssVar(semantic.divider)}`,
          minHeight: 44,
          // У пикеров свои имена size-классов (MuiPickersInputBase-*), общий
          // MuiInputBase-sizeSmall на них не вешается.
          '&.MuiInputBase-sizeSmall, &.MuiPickersInputBase-sizeSmall, &.MuiPickersInputBase-inputSizeSmall':
            {
              minHeight: 32,
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
          paddingTop: 22,
          paddingBottom: 6,
          paddingLeft: 20,
          paddingRight: 20,
          fontSize: 16,
          fontWeight: 500,
          color: cssVar(semantic.textPrimary),
          '&.Mui-disabled': { cursor: 'not-allowed' },
          '&.MuiInputBase-inputSizeSmall': {
            paddingTop: 6,
            paddingBottom: 6,
          },
        },
        sectionsContainer: {
          paddingTop: 22,
          paddingBottom: 6,
          paddingLeft: 20,
          paddingRight: 8,
          fontSize: 16,
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
    MuiPopover: {
      styleOverrides: {
        root: {
          zIndex: POPUP_Z,
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
  },
})
