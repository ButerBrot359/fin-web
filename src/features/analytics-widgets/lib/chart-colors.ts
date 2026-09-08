import { cssVar, palette, semantic } from '@/shared/design/tokens'

/**
 * Категориальная палитра графиков аналитики.
 *
 * Не набор «всех цветов радуги»: восемь несвязанных ярких оттенков читаются как
 * значение по умолчанию, а не как выбор, и на дашборде из четырёх виджетов
 * каждый начинает спорить с соседом. Здесь семейство — все цвета близки по
 * светлоте, идут от фирменного `accent02` через холодную часть круга, и только
 * два тёплых (янтарный, бронзовый) стоят разрывами, чтобы соседние серии не
 * сливались.
 *
 * Красный в категориальный ряд не входит намеренно: он занят под отрицательное
 * значение и ошибку, и серия такого цвета читалась бы как «плохо».
 *
 * Значения берутся из канона токенов, а не пишутся литералами: страж дрейфа
 * (`src/shared/design/no-hex-drift.test.ts`) допускает literal-цвета только в
 * `tokens.ts`. `cssVar` даёт `var(--…, #fallback)` — это корректный цвет и для
 * SVG-атрибутов графика.
 */
export const CHART_COLORS: string[] = [
  cssVar(palette.accent02), // фирменный синий, всегда первая серия
  cssVar(palette.pendingChart2), // бирюзовый
  cssVar(palette.pendingChart3), // индиго
  cssVar(palette.pendingChart4), // янтарный — тёплый разрыв
  cssVar(palette.pendingChart5), // зелёный
  cssVar(palette.pendingChart6), // пурпурный
  cssVar(palette.pendingChart7), // сине-серый
  cssVar(palette.pendingChart8), // бронзовый — второй тёплый разрыв
]

/** Цвет серии по индексу; палитра циклическая. */
export const colorAt = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length]

/**
 * Семантические цвета — отдельно от категориальных: они означают оценку
 * («выросло», «упало»), а не принадлежность к серии.
 */
export const POSITIVE_COLOR = cssVar(palette.pendingChartPositive)
export const NEGATIVE_COLOR = cssVar(semantic.error)

/** Нейтральное значение и подписи осей. */
export const NEUTRAL_COLOR = cssVar(semantic.textSecondary)

/**
 * Сетка. Светлее `ui03`: линии разметки не должны спорить с самими данными —
 * их задача подсказать уровень, а не расчертить лист.
 */
export const GRID_COLOR = cssVar(palette.pendingChartGrid)

/** Основной текст графика — подписи легенды. */
export const CHART_TEXT_COLOR = cssVar(semantic.textPrimary)

/**
 * Подложка чипа дельты. Чип, а не строка текста: направление изменения должно
 * читаться формой, а не только цветом, иначе при дальтонизме рост и падение
 * неразличимы.
 */
export const deltaBackground = (percent: number): string => {
  if (percent > 0) return cssVar(palette.pendingDeltaPositiveBg)
  if (percent < 0) return cssVar(palette.pendingDeltaNegativeBg)
  return cssVar(palette.pendingDeltaNeutralBg)
}
