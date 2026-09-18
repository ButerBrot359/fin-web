/**
 * Курсор агента на управляемом экране (ADR-0050).
 *
 * <p><b>Без него управление невидимо.</b> Синтетические события не двигают настоящий указатель
 * системы: человек видел бы, как сами собой нажимаются кнопки, но не понимал бы, куда смотрит
 * собеседник и что тот сейчас нажмёт. Отдельная стрелка отвечает на оба вопроса и заодно служит
 * постоянным напоминанием, что экраном управляют.
 *
 * <p>Рисуется в самом документе, а не в React-дереве: управление приходит из обработчика
 * сообщений, живущего вне рендера, и заводить ради курсора состояние с перерисовкой на каждое
 * движение мыши — лишняя работа тридцать раз в секунду.
 */

import { cssVar, palette, semantic, shadows } from '@/shared/design/tokens'

import type { Point } from './remote-control-apply'
import { elementAt, mouseInit, toViewport } from './remote-control-apply'

const CURSOR_ID = 'webbuh-remote-cursor'

const cursorElement = (): HTMLElement => {
  const existing = document.getElementById(CURSOR_ID)
  if (existing) {
    return existing
  }
  const cursor = document.createElement('div')
  cursor.id = CURSOR_ID
  cursor.setAttribute('aria-hidden', 'true')
  cursor.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    // Не перехватывает события: иначе курсор закрывал бы собой то, по чему кликает.
    'pointer-events:none',
    'width:16px',
    'height:16px',
    // ОСТРИЁ В ЛЕВОМ ВЕРХНЕМ УГЛУ — там же, где left/top, то есть ровно в точке действия.
    // С острым углом снизу (и отрицательным отступом) стрелка рисовалась на полтора десятка
    // пикселей ниже настоящей точки: агент целился верно, а указатель показывал мимо.
    'margin:0',
    'border-radius:2px 50% 50% 50%',
    `background:${cssVar(semantic.primary)}`,
    `box-shadow:0 0 0 2px ${cssVar(palette.ui01)}, ${cssVar(shadows.pendingRemoteCursor)}`,
    'transition:left 60ms linear, top 60ms linear',
  ].join(';')
  document.body.appendChild(cursor)
  return cursor
}

/** Убирает курсор агента. Зовётся, как только управление перестаёт действовать. */
export const hideRemoteCursor = (): void => {
  document.getElementById(CURSOR_ID)?.remove()
}

/**
 * Наведение: двигает курсор агента и посылает `mousemove`, чтобы срабатывали подсказки и
 * наведённые состояния под ним.
 */
export const applyMove = (share: Point): void => {
  const point = toViewport(share)
  const cursor = cursorElement()
  cursor.style.left = `${String(point.x)}px`
  cursor.style.top = `${String(point.y)}px`

  const target = elementAt(point)
  target?.dispatchEvent(new MouseEvent('mousemove', mouseInit(point)))
}
