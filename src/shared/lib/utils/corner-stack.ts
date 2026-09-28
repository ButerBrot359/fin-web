/**
 * Правый нижний угол экрана — одна колонка (SCRUM-317 v6 §3): общие края,
 * одна ширина, без наложений. Нижний этаж (сегодня — панель ошибок SDUI)
 * публикует занятое место двумя CSS-переменными; верхний этаж (тосты) читает
 * их с фолбэками. Сколько этажей и кто на каком, shared не знает: контракт —
 * только имена переменных и фолбэки.
 *
 * Прочие жильцы угла (кнопки поддержки/AI из floating-widgets.ts, окно
 * помощника, плашка звонка) скрыты флагом showFloatingButtons и в колонку
 * пока не встроены; при включении флага их место в колонке — продуктовый
 * вопрос (v6 §6.1).
 */

/** Общий правый край колонки — совпадает с дефолтным отступом sonner. */
export const CORNER_RIGHT_PX = 24

/** Низ нижнего этажа — над лентой вкладок рабочего стола. */
export const CORNER_BOTTOM_PX = 56

/** Зазор между этажами колонки. */
export const CORNER_GAP_PX = 12

/** Обычный отступ тостов от низа экрана, когда нижнего этажа нет. */
export const TOAST_BOTTOM_PX = 24

/** Обычная ширина тоста без нижнего этажа (прежнее зашитое значение). */
export const TOAST_WIDTH_PX = 351

/** Верх занятого места, от низа экрана, уже с зазором {@link CORNER_GAP_PX}. */
export const CORNER_STACK_TOP_VAR = '--corner-stack-top'

/** Фактическая ширина нижнего этажа (учитывает max-width на узком экране). */
export const CORNER_STACK_WIDTH_VAR = '--corner-stack-width'

/** Публикует занятое нижним этажом место. Звать синхронно (useLayoutEffect). */
export function publishCornerStack(el: HTMLElement): void {
  const style = document.documentElement.style
  style.setProperty(
    CORNER_STACK_TOP_VAR,
    `${String(CORNER_BOTTOM_PX + el.offsetHeight + CORNER_GAP_PX)}px`
  )
  style.setProperty(CORNER_STACK_WIDTH_VAR, `${String(el.offsetWidth)}px`)
}

/** Снимает обе переменные — тосты возвращаются на обычное место и ширину. */
export function clearCornerStack(): void {
  const style = document.documentElement.style
  style.removeProperty(CORNER_STACK_TOP_VAR)
  style.removeProperty(CORNER_STACK_WIDTH_VAR)
}
