import type { SxProps, Theme } from '@mui/material'

/**
 * Цвет горизонтальных разделителей таблицы. Литерал, а не токен темы MUI: он
 * обязан совпадать с `border-ui-03` — классом Tailwind, которым
 * `verticalSubRows` (`lib/utils/build-column-defs.ts`) рисует разделитель
 * под-строк вертикальной группы. Значение — `colors.ui['03']` из
 * `tailwind.config.ts`.
 */
const GRID_LINE_COLOR = '#c3cee0'

/** `colors.ui['06']` — тёмная линия под шапкой из утверждённого макета. */
const HEADER_LINE_COLOR = '#222124'

/**
 * Стиль таблиц по утверждённому макету (SCRUM-312, Figma «Журнал проводок»,
 * node 466-15059): без внешней рамки и без вертикальных линий между колонками —
 * только горизонтальные разделители между строками и тёмная линия под шапкой.
 *
 * <p>Прежняя сетка «как в 1С» (внешняя рамка + вертикали, SCRUM-329) снята по
 * замечанию тестирования: утверждённый дизайн разделяет колонки воздухом, а
 * под-строки вертикальных групп — зеброй (`bg-ui-02` в `verticalSubRows`).
 *
 * <p>Реализовано дескендант-селекторами на `<Table>`, а не через
 * `styleOverrides` темы: тема задела бы ВСЕ таблицы обоих миров (легаси-списки,
 * отчёты, пикеры), а этот стиль — для табличных частей документа.
 *
 * <p>Тёмная линия — по НИЖНЕЙ кромке шапки: последний ряд `thead` плюс ячейки
 * с `rowspan` (номер строки и группы двухрядной шапки тянутся до её низа, но
 * лежат в первом ряду — `:last-child`-селектор их не видит).
 *
 * <p>Тип — `satisfies`, а не аннотация `: SxProps<Theme>`: `SxProps` —
 * объединение, и спред такого значения в другой объектный литерал теряет
 * объектность (см. историю файла).
 */
export const TABLE_GRID_SX = {
  '& .MuiTableCell-root': {
    borderBottomColor: GRID_LINE_COLOR,
  },
  '& .MuiTableHead-root .MuiTableRow-root:last-child .MuiTableCell-root, & .MuiTableHead-root .MuiTableCell-root[rowspan]':
    {
      borderBottomColor: HEADER_LINE_COLOR,
    },
} satisfies SxProps<Theme>
