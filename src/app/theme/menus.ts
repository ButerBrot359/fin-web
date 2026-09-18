import type { Components, Theme } from '@mui/material/styles'

import { cssVar, semantic, shadows } from '@/shared/design/tokens'
import { POPUP_Z } from '@/shared/lib/utils/overlay-z-index'

export const menusComponents: Components<Omit<Theme, 'components'>> = {
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
        paddingTop: '18px !important',
        paddingBottom: '4px !important',
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
  MuiPopover: {
    styleOverrides: {
      root: {
        zIndex: POPUP_Z,
      },
    },
  },
}
