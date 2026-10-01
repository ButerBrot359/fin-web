import { cssVar, palette, semantic } from '@/shared/design/tokens'

// Геометрия и стили сетки отчёта: имя и код строки закреплены слева (как
// сотрудник и «Итого» в матрице Табеля), графы — по колонке на каждую.

export const NAME_COLUMN_WIDTH = 320
export const CODE_COLUMN_WIDTH = 88
export const VALUE_COLUMN_MIN_WIDTH = 140

/** Отступ иерархии: 16px на уровень ниже корня (шкала 4px). */
export const indentPx = (uroven: number): number =>
  8 + Math.max(uroven - 1, 0) * 16

export const nameCellSx = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 1,
  backgroundColor: 'background.paper',
  width: NAME_COLUMN_WIDTH,
  minWidth: NAME_COLUMN_WIDTH,
  maxWidth: NAME_COLUMN_WIDTH,
}

export const codeCellSx = {
  position: 'sticky' as const,
  left: NAME_COLUMN_WIDTH,
  zIndex: 1,
  backgroundColor: 'background.paper',
  width: CODE_COLUMN_WIDTH,
  minWidth: CODE_COLUMN_WIDTH,
  textAlign: 'center' as const,
  borderRight: '1px solid',
  borderRightColor: 'divider',
}

// Шапка липнет сверху; её ячейки имени и кода — ещё и слева, поверх
// закреплённых колонок тела (zIndex выше, чем у sticky-ячеек строк).
export const headNameSx = { ...nameCellSx, zIndex: 3 }
export const headCodeSx = { ...codeCellSx, zIndex: 3 }

export const valueCellSx = {
  p: 0,
  position: 'relative' as const,
  minWidth: VALUE_COLUMN_MIN_WIDTH,
  borderLeft: '1px solid',
  borderLeftColor: 'divider',
}

// Пересечение без показателя: штриховка, как «закрытая» клетка бланка 1С.
export const absentCellSx = {
  ...valueCellSx,
  backgroundImage: `repeating-linear-gradient(45deg, transparent 0 6px, ${cssVar(palette.ui03)} 6px 7px)`,
}

/** Нередактируемая ячейка (вычисляемая или закрытая состоянием) — приглушённо. */
export const READ_ONLY_CELL_BG = cssVar(semantic.surfaceRaised)

/** Ячейка — цель сообщения проверки: рамка цвета ошибки. */
export const ERROR_CELL_SHADOW = `inset 0 0 0 2px ${cssVar(semantic.error)}`

// Уголок «изменено вручную» — треугольник в правом верхнем углу ячейки.
export const manualMarkerStyle = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  width: 0,
  height: 0,
  borderTop: `8px solid ${cssVar(semantic.warning)}`,
  borderLeft: '8px solid transparent',
  pointerEvents: 'none' as const,
}
