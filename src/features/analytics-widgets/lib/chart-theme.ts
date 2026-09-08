import { CHART_TEXT_COLOR, GRID_COLOR, NEUTRAL_COLOR } from './chart-colors'

/**
 * Общее оформление осей, сетки и легенды для всех графиков раздела.
 *
 * Смысл в вычитании: у графика по умолчанию есть осевые линии, засечки и
 * контрастная сетка — три слоя разметки вокруг данных. Убираем осевые линии и
 * засечки, а сетку уводим почти в фон: уровень подсказывают подписи делений,
 * а рисовать под данными сетку в полный контраст незачем.
 *
 * Один объект на все виды графиков — иначе линейный и столбчатый разъезжаются
 * по кеглю подписей, и дашборд перестаёт выглядеть собранным.
 */
export const CHART_SX = {
  '& .MuiChartsAxis-line': { display: 'none' },
  '& .MuiChartsAxis-tick': { display: 'none' },
  '& .MuiChartsAxis-tickLabel': {
    fill: NEUTRAL_COLOR,
    fontSize: 11,
    fontWeight: 500,
  },
  '& .MuiChartsGrid-line': { stroke: GRID_COLOR, strokeWidth: 1 },
  '& .MuiChartsLegend-label': { fontSize: 12, fill: CHART_TEXT_COLOR },
  '& .MuiChartsLegend-mark': { rx: 2 },
} as const

/**
 * Отступы области построения — только сверху и справа.
 *
 * Слева и снизу отступы НЕ задаём: их считает сам график под фактическую
 * ширину подписей делений. Жёсткое значение обрезало суммы до «140…», причём
 * тем сильнее, чем крупнее числа — то есть ровно на настоящих данных.
 */
export const CHART_MARGIN = { top: 12, right: 16 }

/**
 * Оформление подписей делений — свойством оси, а не через `sx`.
 *
 * График проставляет подписям инлайновый стиль (кегль из типографики темы), а
 * инлайн сильнее любого класса: правило `.MuiChartsAxis-tickLabel` в `sx`
 * молча проигрывает, и подписи остаются 12-м кеглем основного цвета. Осевые
 * линии и сетку `sx` при этом перекрывает нормально — они без инлайна.
 */
export const TICK_LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 500,
  fill: NEUTRAL_COLOR,
} as const

/**
 * Подписи оси значений — компактной записью: 140 000 → «140 тыс.».
 *
 * Полные суммы на оси не помещаются и обрезаются многоточием («140…»), причём
 * тем чаще, чем крупнее числа, — то есть именно на настоящих бухгалтерских
 * данных. Точная величина всё равно доступна в подсказке столбца, а оси нужна
 * только шкала.
 */
const compact = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatAxisNumber = (value: number | null): string =>
  value == null ? '' : compact.format(value)

/** Конфигурация оси значений: общая для линейного и столбчатого графика. */
export const VALUE_AXIS = [
  { valueFormatter: formatAxisNumber, tickLabelStyle: TICK_LABEL_STYLE },
]
