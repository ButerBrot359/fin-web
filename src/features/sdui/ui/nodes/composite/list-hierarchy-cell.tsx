import type { FC, SVGProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'

/** Ширина раскрывателя — плейсхолдер той же ширины держит текст строк без потомков в колонке. */
const EXPANDER_WIDTH = 18

export interface ListHierarchyCellProps {
  text: string
  /** Глубина от корня выдачи (`_level`), корень = 0. */
  level: number
  /** Отступ на уровень — `props.indentPerLevel` колонки (контракт §8.3). */
  indentPerLevel: number
  /** Глиф группы/элемента по iconMap (может отсутствовать — только текст). */
  icon: FC<SVGProps<SVGSVGElement>> | null
  /** Есть живые потомки (`_hasChildren`) — только тогда рисуем треугольник. */
  hasChildren: boolean
  /** Узел раскрыт (`_expanded`) — направление треугольника; клиент сам не выведет. */
  expanded: boolean
  /** Клик по треугольнику; нет команды expand с бэка → раскрыватель не рисуем. */
  onToggle: ((expanded: boolean) => void) | undefined
}

// SCRUM-360 v6 §8.7 п.3 (дерево, фаза B): ведущая колонка cellKind=HIERARCHY —
// отступ по _level, треугольник раскрытия при _hasChildren (направление по
// _expanded), глиф группы/элемента. value.expanded в команде — ЖЕЛАЕМОЕ
// состояние, не переключатель (§8.5): шлём инверсию текущего серверного.
export const ListHierarchyCell: FC<ListHierarchyCellProps> = ({
  text,
  level,
  indentPerLevel,
  icon: Icon,
  hasChildren,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation()

  return (
    <span
      className="flex items-center gap-1.5"
      style={{ paddingLeft: level * indentPerLevel }}
    >
      {onToggle &&
        (hasChildren ? (
          <span
            role="button"
            aria-label={t(expanded ? 'table.collapseRow' : 'table.expandRow')}
            className="flex shrink-0 cursor-pointer"
            onClick={(e) => {
              // Клик по раскрывателю не должен выделять строку под ним.
              e.stopPropagation()
              onToggle(!expanded)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
            }}
          >
            {expanded ? (
              <KeyboardArrowDownIcon sx={{ fontSize: EXPANDER_WIDTH }} />
            ) : (
              <KeyboardArrowRightIcon sx={{ fontSize: EXPANDER_WIDTH }} />
            )}
          </span>
        ) : (
          <span className="shrink-0" style={{ width: EXPANDER_WIDTH }} />
        ))}
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
      <Typography variant="body2" noWrap className="text-ui-06">
        {text}
      </Typography>
    </span>
  )
}
