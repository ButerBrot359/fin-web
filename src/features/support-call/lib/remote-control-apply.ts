/**
 * Применение действий агента к странице (ADR-0050).
 *
 * <p><b>Что это может и чего не может.</b> Управление живёт внутри вкладки webbuh и дальше неё
 * не идёт: веб-страница не умеет двигать курсор операционной системы, переключать вкладки,
 * нажимать в адресной строке и отвечать на диалоги браузера. Это не наше ограничение, а граница
 * песочницы — обойти её можно только расширением или программой на машине пользователя, а их
 * ставить нельзя по условию задачи. Всё, что показывает webbuh, управляется полностью; всё
 * остальное на экране — только видно.
 *
 * <p><b>Синтетические события не заменяют человека полностью.</b> Браузер помечает действия
 * пользователя признаком «user activation», и без него не открывается выбор файла, не
 * запускается показ экрана, не пишется буфер обмена. Эти шаги придётся делать самому человеку —
 * агент их подсказывает словами.
 */

interface Point {
  x: number
  y: number
}

/** Доли области просмотра → пиксели этой страницы. Разные экраны сторон здесь и сходятся. */
const toViewport = (share: Point): Point => ({
  x: Math.round(share.x * window.innerWidth),
  y: Math.round(share.y * window.innerHeight),
})

const elementAt = (point: Point): Element | null =>
  document.elementFromPoint(point.x, point.y)

/** Общая часть мышиных событий: без координат React-обработчики получат нули. */
const mouseInit = (point: Point): MouseEventInit => ({
  bubbles: true,
  cancelable: true,
  composed: true,
  clientX: point.x,
  clientY: point.y,
  view: window,
})

/**
 * Щелчок.
 *
 * <p>Полная цепочка `pointerdown → mousedown → mouseup → click`, а не один `click`: половина
 * интерфейса webbuh (меню, выпадающие списки, таблицы) слушает именно нажатие, и одиночный
 * `click` для них не происходит вовсе.
 */
export const applyClick = (share: Point, double = false): void => {
  const point = toViewport(share)
  const target = elementAt(point)
  if (!target) {
    return
  }

  // Фокус переводим до событий: поля ввода и кнопки ведут себя иначе, когда фокуса нет.
  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true })
  }

  target.dispatchEvent(new PointerEvent('pointerdown', mouseInit(point)))
  target.dispatchEvent(new MouseEvent('mousedown', mouseInit(point)))
  target.dispatchEvent(new PointerEvent('pointerup', mouseInit(point)))
  target.dispatchEvent(new MouseEvent('mouseup', mouseInit(point)))
  target.dispatchEvent(
    new MouseEvent('click', { ...mouseInit(point), detail: 1 })
  )

  if (double) {
    target.dispatchEvent(
      new MouseEvent('dblclick', { ...mouseInit(point), detail: 2 })
    )
  }
}

const CURSOR_ID = 'webbuh-remote-cursor'

/**
 * Курсор агента на управляемом экране.
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
    'background:#2a75f4',
    'box-shadow:0 0 0 2px #ffffff, 0 2px 8px rgba(0,0,0,0.35)',
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

/**
 * Прокрутка.
 *
 * <p>Крутится ближайший прокручиваемый предок под курсором, а не окно целиком: в webbuh
 * прокручиваются таблицы и панели внутри страницы, и `window.scrollBy` не сдвинул бы ничего.
 */
export const applyScroll = (share: Point, dx: number, dy: number): void => {
  const point = toViewport(share)
  let node: Element | null = elementAt(point)

  while (node) {
    const style = getComputedStyle(node)
    const scrollableY =
      node.scrollHeight > node.clientHeight &&
      /auto|scroll|overlay/.test(style.overflowY)
    const scrollableX =
      node.scrollWidth > node.clientWidth &&
      /auto|scroll|overlay/.test(style.overflowX)

    if (scrollableY || scrollableX) {
      node.scrollBy({ left: dx, top: dy, behavior: 'auto' })
      return
    }
    node = node.parentElement
  }

  window.scrollBy({ left: dx, top: dy, behavior: 'auto' })
}

/** Поле, в которое сейчас можно печатать. */
const editableAt = (
  point: Point
): HTMLInputElement | HTMLTextAreaElement | null => {
  const target = elementAt(point) ?? document.activeElement
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
    ? target
    : null
}

/**
 * Записывает значение так, чтобы его увидел React.
 *
 * <p>Через нативный сеттер, а не присваиванием: React запоминает предыдущее значение поля и
 * после простого `input.value = …` считает, что ничего не изменилось — на экране было бы новое,
 * а в состоянии формы старое.
 */
const setValue = (
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  caret: number
): void => {
  const prototype =
    field instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype
  // Reflect.set с явным получателем: он находит сеттер на ПРОТОТИПЕ и вызывает его для нашего
  // поля. Обычное присваивание попало бы в свойство, которое React подменил на самом элементе,
  // — а мимо этой подмены и нужно пройти, чтобы React заметил новое значение.
  Reflect.set(prototype, 'value', value, field)
  field.setSelectionRange(caret, caret)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Клавиша.
 *
 * <p>Печатный символ вставляется в поле под курсором на позицию каретки — как если бы человек
 * набрал его сам. Служебные клавиши уходят событием: Enter в форме webbuh запускает поиск или
 * сохранение, Escape закрывает окно, и подменять их вставкой текста бессмысленно.
 */
export const applyKey = (share: Point, key: string): void => {
  const point = toViewport(share)
  const field = editableAt(point)

  if (field && (key.length === 1 || key === 'Backspace')) {
    field.focus({ preventScroll: true })
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? start

    if (key === 'Backspace') {
      // Есть выделение — удаляем его целиком, нет — один символ слева от каретки.
      const from = start === end ? Math.max(0, start - 1) : start
      setValue(field, field.value.slice(0, from) + field.value.slice(end), from)
    } else {
      setValue(
        field,
        field.value.slice(0, start) + key + field.value.slice(end),
        start + key.length
      )
    }
    return
  }

  const target = elementAt(point) ?? document.activeElement ?? document.body
  const init: KeyboardEventInit = {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
  }
  target.dispatchEvent(new KeyboardEvent('keydown', init))
  target.dispatchEvent(new KeyboardEvent('keyup', init))
}
