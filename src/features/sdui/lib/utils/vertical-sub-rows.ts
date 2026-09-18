import { type ReactNode, createElement } from 'react'

import type { ViewNode } from '../../types/view'

/**
 * Сетка VERTICAL-группы: стопка под-строк, общая для шапки, ячейки и подвала
 * таблицы. Вынесено из build-column-defs.ts при декомпозиции (2026-09-18),
 * поведение 1:1.
 */

/**
 * Минимальная высота одной под-строки VERTICAL-группы. Единая сетка для шапки и
 * ячейки: i-я подпись стоит ровно над i-м редактором (эталон 1С — две
 * «под-строки» в одной колонке). Пара с ROW_HEIGHT в
 * `complex-editable-table.tsx`, который считает минимальную высоту строки как
 * 2 × это значение.
 */
export const VERTICAL_SUB_ROW_HEIGHT = 36

/**
 * Стопка под-строк VERTICAL-группы: равные по высоте под-строки + разделитель
 * между ними (как линия сетки в 1С).
 *
 * @param paddingX горизонтальный отступ под-строки: 16px в шапке (совпасть с
 *                 остальными заголовками MUI), 0 в ячейке (у редакторов свой)
 * @param clip     обрезать содержимое по границам под-строки. Только для ШАПКИ:
 *                 подпись, не влезшая в ширину, не должна вылезать на соседнюю
 *                 под-строку. В ЯЧЕЙКЕ обрезать нельзя — у редакторов есть то,
 *                 что законно выходит за их границы (рамка обязательного поля,
 *                 focus-ring), и `overflow:hidden` срезал бы её
 *
 * КАК ДЕРЖИТСЯ ОБЩАЯ СЕТКА СТРОКИ. Значения в ТЧ переносятся по ширине колонки
 * (как во вкладке «Вычеты ИПН», где вертикальных групп нет), поэтому жёсткой
 * высоты у под-строки быть не может: длинное ФИО занимает две строки текста.
 * Вместо неё:
 *   1) контейнер стопки тянется во всю высоту ячейки (`height: 100%`), а ячейки
 *      строки таблицы по природе `<tr>` одной высоты;
 *   2) под-строки — треки грида `1fr` (то есть `minmax(auto, 1fr)`): при
 *      измерении контента трек не меньше своего содержимого И все треки
 *      выравниваются по самому высокому, а при готовой высоте ячейки делят её
 *      поровну.
 * Отсюда: разделитель под-строк во ВСЕХ колонках строки встаёт на одной высоте
 * (эталон 1С — единая линия), а содержимое при этом не обрезается. Прежняя
 * жёсткая `height` тот же результат давала ценой обрезки значений многоточием.
 *
 * ОДИНАКОВОЕ ЧИСЛО ТРЕКОВ ВО ВСЕХ КОЛОНКАХ (`subRowCount`). Треков всегда
 * столько, сколько под-колонок у САМОЙ БОЛЬШОЙ вертикальной группы таблицы, а
 * не сколько их у этой группы. Иначе равные `1fr`-треки делят одну и ту же
 * высоту строки на разное число частей: в «Сотрудник / Вид занятости / Вид
 * деятельности» разделители встают на 1/3 и 2/3 высоты, а в соседнем
 * «Подразделение / Должность» — на 1/2, и линии сетки идут по строке
 * ступеньками. Группа с меньшим числом под-колонок занимает ПЕРВЫЕ треки
 * общей сетки, хвост остаётся пустым — так же, как в эталоне 1С.
 *
 * <p>Пустые треки рисуются наравне с заполненными (и с тем же разделителем):
 * иначе линия сетки обрывалась бы на колонке, у которой под-колонок меньше.
 */
export interface SubRowItem {
  key: string
  content: ReactNode
}

export function verticalSubRows(
  items: SubRowItem[],
  paddingX: number,
  clip: boolean,
  subRowCount: number
): ReactNode {
  // Хвостовые слоты пустые — у группы с меньшим числом под-колонок (тип шире
  // элемента массива: индекс за пределами items даёт undefined).
  const slots: (SubRowItem | undefined)[] = Array.from(
    { length: Math.max(subRowCount, items.length) },
    (_, index) => items[index]
  )
  return createElement(
    'div',
    {
      style: {
        height: '100%',
        display: 'grid',
        // minmax(0, 1fr), а не дефолтный auto-трек: auto-трек не сжимается ниже
        // ширины содержимого, поэтому длинная подпись растягивала бы его и
        // вылезала за границы колонки вместо обрезки многоточием. Редакторы при
        // этом по-прежнему занимают всю ширину ячейки (1fr).
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: `repeat(${String(slots.length)}, 1fr)`,
      },
    },
    ...slots.map((item, index) =>
      createElement(
        'div',
        {
          key: item?.key ?? `empty-${String(index)}`,
          // SCRUM-312 (макет «Журнал проводок»): под-строки стопки разделены
          // тонкой линией и зеброй ui-02 на чётных — вместо снятой сетки.
          className:
            [
              index > 0 ? 'border-t border-ui-03' : '',
              index % 2 === 1 ? 'bg-ui-02' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined,
          style: {
            // Пол высоты — общий для всех колонок: строка с короткими
            // значениями не должна схлопываться (см. док-комментарий выше).
            minHeight: VERTICAL_SUB_ROW_HEIGHT,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            alignContent: 'center',
            ...(clip ? { overflow: 'hidden' } : {}),
            paddingLeft: paddingX,
            paddingRight: paddingX,
            boxSizing: 'border-box' as const,
          },
        },
        item?.content ?? null
      )
    )
  )
}

/**
 * Вложенная ГОРИЗОНТАЛЬНАЯ подгруппа внутри вертикальной — эталон 1С
 * ({@code ColumnGroup} c {@code <Group>Horizontal</Group>} внутри вертикальной
 * группы). Одна под-строка делится на несколько ячеек в ряд: у «Аналитики
 * затрат» Авансового отчёта это «Источник финансирования | ФКР» сверху и
 * «Код платных услуг | Специфика» снизу — две под-строки по две ячейки, а не
 * четыре подписи стопкой.
 */
export function isHorizontalSubGroup(node: ViewNode): boolean {
  if ((node.type as string) !== 'COLUMN_GROUP') return false
  const orientation =
    (node.props?.orientation as string | undefined) ?? 'HORIZONTAL'
  return orientation === 'HORIZONTAL'
}

/**
 * Ряд ячеек одной под-строки. Ширина делится поровну ({@code 1fr} с нулевым
 * минимумом — длинное значение обрезается, а не растягивает соседа), между
 * ячейками — вертикальная линия, как в сетке 1С.
 */
export function horizontalSubCells(items: SubRowItem[]): ReactNode {
  return createElement(
    'div',
    {
      style: {
        height: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${String(items.length)}, minmax(0, 1fr))`,
        alignItems: 'center',
      },
    },
    ...items.map((item, index) =>
      createElement(
        'div',
        {
          key: item.key,
          className: index > 0 ? 'border-l border-ui-03' : undefined,
          style: {
            minWidth: 0,
            paddingLeft: index > 0 ? 8 : 0,
            paddingRight: 8,
            boxSizing: 'border-box' as const,
          },
        },
        item.content
      )
    )
  )
}

/**
 * Сколько под-строк у самой большой VERTICAL-группы поддерева. Ноль — если
 * вертикальных групп нет вовсе.
 *
 * <p>Считается по ВСЕЙ таблице и раздаётся всем группам: общая сетка под-строк
 * — единственное, что держит линии разделителей на одной высоте по всей строке
 * (см. док-комментарий verticalSubRows).
 */
export function maxVerticalSubRows(children: ViewNode[] | undefined): number {
  if (!children) return 0

  let max = 0
  for (const node of children) {
    if (node.props?.visible === false) continue
    if ((node.type as string) !== 'COLUMN_GROUP') continue

    const orientation =
      (node.props?.orientation as string | undefined) ?? 'HORIZONTAL'
    if (orientation === 'VERTICAL') {
      const visible = (node.children ?? []).filter(
        (child) => child.props?.visible !== false
      )
      max = Math.max(max, visible.length)
      continue
    }
    // HORIZONTAL-группа — многоуровневая шапка: вертикальные группы могут
    // лежать внутри неё, и их сетка та же самая.
    max = Math.max(max, maxVerticalSubRows(node.children))
  }
  return max
}
