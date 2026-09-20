import type { ViewNode } from '../../types/view'

/**
 * Корень дерева, который сам должен занять высоту окна и прокручиваться.
 *
 * <p>Нужен формам без узла PAGE («Корректировка параметров учёта ОС», «Тарификация»,
 * «Кадровое перемещение», «Приём на работу списком»): у них корень раскладки — VSTACK, и
 * режим растянутой карточки включать некому — PageNode такого дерева не видит. Признак тот
 * же, что у PageNode: `props.flex` — порт «РастягиватьПоВертикали» 1С.
 */
export const isStretchedRoot = (node: ViewNode | null | undefined): boolean =>
  node !== null &&
  node !== undefined &&
  node.type !== 'PAGE' &&
  node.props?.flex !== undefined
