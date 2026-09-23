import { createContext, useContext } from 'react'

// SCRUM-355 §5/§8.4: число равных колонок, объявленное группой
// (props.columnsCount). Контекст нужен, чтобы правило «раскладывать по
// колонкам» действовало ТОЛЬКО там, где группа об этом объявила:
// горизонтальные стеки шлют и MovementsComposer, и NodeBuilder, и таблицы
// метаданных форм — их задевать нельзя.
export const GroupColumnsContext = createContext<number | undefined>(undefined)

export const useGroupColumns = (): number | undefined =>
  useContext(GroupColumnsContext)
