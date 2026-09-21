import { Fragment, type FC } from 'react'

interface HighlightedTextProps {
  text: string
  /** Строка поиска; пустая — текст выводится как есть. */
  query?: string
}

/** Экранирование спецсимволов регулярного выражения: запрос вводит пользователь. */
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Текст ячейки с выделенными вхождениями строки поиска — как в списке 1С, где найденный
 * фрагмент подсвечен и сразу видно, ПО КАКОЙ колонке строка попала в результат.
 *
 * <p>Сравнение регистронезависимое, подсвечиваются ВСЕ вхождения. Пустой запрос, отсутствие
 * совпадений или отсутствие текста — обычный текст без единой обёртки.
 */
export const HighlightedText: FC<HighlightedTextProps> = ({ text, query }) => {
  const needle = query?.trim() ?? ''
  if (needle === '' || text === '') return <>{text}</>

  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'))
  if (parts.length === 1) return <>{text}</>

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark
            key={index}
            className="bg-support-03/40 rounded-sm px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  )
}
