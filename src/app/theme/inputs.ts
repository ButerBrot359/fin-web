import { createElement } from 'react'

import type { Components, Theme } from '@mui/material/styles'

import { cssVar, palette, semantic } from '@/shared/design/tokens'
import {
  CheckboxBlankIcon,
  CheckboxCheckedIcon,
  CheckboxIndeterminateIcon,
} from '@/shared/ui/checkbox/checkbox-icons'

export const inputsComponents: Components<Omit<Theme, 'components'>> = {
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
        minHeight: 38,
        '&.MuiInputBase-sizeSmall': {
          minHeight: 32,
          height: 36,
        },
        // Small С ЛЕЙБЛОМ (label — сосед root'а в FormControl): в 36px
        // плавающему лейблу нет места, он ложится на текст — даём таким
        // полям геометрию обычного размера. Small без лейбла не задет.
        'label + &.MuiInputBase-sizeSmall': {
          height: 'auto',
          minHeight: 40,
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
        paddingTop: 18,
        paddingBottom: 4,
        paddingLeft: 20,
        paddingRight: 20,
        fontSize: 14,
        fontWeight: 500,
        // Явный line-height: у Select значение — div с наследуемым 23px
        // (высота поля прыгала до 47 против 44 у текстовых инпутов).
        lineHeight: '20px',
        color: cssVar(semantic.textPrimary),
        '&.Mui-disabled': { cursor: 'not-allowed' },
        '&.MuiInputBase-inputSizeSmall': {
          paddingTop: 6,
          paddingBottom: 6,
        },
        // Пара к 'label + &.MuiInputBase-sizeSmall' в root: значение — под
        // лейблом, как у обычного размера.
        'label + .MuiInputBase-sizeSmall &': {
          paddingTop: 18,
          paddingBottom: 4,
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
        // Компактные поля (высота ~44 → ~40): лейбл и значение сжаты по
        // вертикали, поэтому позиции лейбла прибиты руками — дефолтные
        // transform'ы MUI рассчитаны на высоту 56 и уводят лейбл на текст.
        // Small с лейблом получает ту же геометрию (см. MuiFilledInput),
        // поэтому transform'ы общие для всех filled-лейблов.
        fontSize: 14,
        '&.MuiInputLabel-filled': {
          transform: 'translate(12px, 10px) scale(1)',
        },
        '&.MuiInputLabel-filled.MuiInputLabel-shrink': {
          transform: 'translate(12px, 3px) scale(0.75)',
        },
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
  // Чекбокс по Figma (772:24370): 24×24, тёмная рамка, checked — салатовая
  // заливка с тёмной галкой. MUI-дефолт (синий квадрат, белая галка) в
  // макетах отсутствует. Цвет рамки/галки — через color (currentColor глифов).
  MuiCheckbox: {
    defaultProps: {
      // createElement: файл — .ts, JSX здесь недоступен
      icon: createElement(CheckboxBlankIcon),
      checkedIcon: createElement(CheckboxCheckedIcon),
      indeterminateIcon: createElement(CheckboxIndeterminateIcon),
    },
    styleOverrides: {
      root: {
        color: cssVar(palette.ui06),
        '&.Mui-checked, &.MuiCheckbox-indeterminate': {
          color: cssVar(palette.ui06),
        },
        '&.Mui-disabled': {
          color: cssVar(palette.ui05),
        },
      },
    },
  },
}
