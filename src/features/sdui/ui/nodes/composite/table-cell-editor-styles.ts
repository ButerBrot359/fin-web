import type { CSSProperties } from 'react'
import type { SxProps, Theme } from '@mui/material'

/**
 * Текст ячейки ТЧ, у которой нет редактора (readonly-значение, заглушка
 * составного типа): ПЕРЕНОСИТСЯ по ширине колонки.
 *
 * <p>Ширины колонок ТЧ фиксированы (`<colgroup>` + `tableLayout: fixed`), а сама
 * ячейка содержимое не обрезает — при `white-space: nowrap` длинное значение
 * («Доплата за квалификационную категорию 100%») выезжало поверх соседней
 * колонки. `display: block` — чтобы у переносимого текста работали собственные
 * паддинги, `overflowWrap: anywhere` — чтобы рвался и «неразрывный» токен (код
 * или номер без пробелов), иначе он снова вылезет за границу.
 *
 * <p>Общий стиль, а не копия в каждом редакторе: правило одно для всех ячеек без
 * редактора, и расходиться им нельзя.
 */
export const readonlyCellTextStyle: CSSProperties = {
  display: 'block',
  padding: '4px 8px',
  fontSize: 14,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

/**
 * Тот же текст, но ОДНОЙ строкой с многоточием — для под-строк вертикальной
 * группы колонок. Там высота под-строки жёсткая (общая сетка строки таблицы), и
 * перенос вылез бы поверх разделителя и соседней под-строки. Эталон 1С в этом
 * месте тоже обрезает: «ГЛАВНЫЙ ЭКОНОМИ…», «Основное подразделе…».
 *
 * Обрезка живёт на САМОМ тексте, а не на контейнере под-строки: `overflow:hidden`
 * у контейнера срезал бы рамку обязательного поля и focus-ring соседнего
 * редактора, которые законно выходят за 36px.
 */
export const readonlyCellTextTruncatedStyle: CSSProperties = {
  ...readonlyCellTextStyle,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  overflowWrap: 'normal',
}

export const cellSx: SxProps<Theme> = {
  mb: 0,
  position: 'static',
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
  },
  '& .MuiInputBase-input': {
    padding: '4px 8px !important',
    fontSize: '14px !important',
    // Текстовая ячейка — multiline (textarea): переносим по ширине колонки и
    // убираем ручку изменения размера, в ТЧ она неуместна.
    resize: 'none',
    overflowWrap: 'anywhere',
  },
}

export const enumCellSx: SxProps<Theme> = {
  fontSize: '14px',
  '&::before, &::after': { display: 'none' },
  '& .MuiSelect-select': {
    padding: '4px 8px !important',
    minHeight: '28px',
    display: 'flex',
    alignItems: 'center',
    // MUI держит подпись выбранного значения в одну строку — в ячейке ТЧ с
    // фиксированной шириной длинное значение перечисления так обрезается.
    whiteSpace: 'normal !important',
    overflowWrap: 'anywhere',
  },
}

export const dateCellSx: SxProps<Theme> = {
  '& .MuiFormControl-root': { mb: 0, position: 'static', width: '100%' },
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 !important',
  },
  '& .MuiPickersInputBase-root': {
    position: 'relative',
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 8px !important',
  },
  '& .MuiPickersInputBase-sectionsContainer': {
    padding: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    fontSize: '14px !important',
  },
  // Иконка календаря прижимается к правому краю СВОЕГО поля ввода
  // (`.MuiPickersInputBase-root` выше — `position: relative`), а не смещается на
  // фиксированные 24px. Прежний сдвиг был рассчитан на раскладку обычной ячейки;
  // в под-строке вертикальной группы контейнер другой (grid, свои паддинги), и
  // та же константа уводила иконку за границу колонки — в парах «Начало периода
  // / Окончание периода» она налезала на соседнее значение.
  '& .MuiInputAdornment-root': {
    position: 'absolute',
    right: '2px',
    top: '50%',
    transform: 'translateY(-50%)',
    height: 'auto',
    maxHeight: 'none',
    ml: 0,
  },
  // Место под иконку — чтобы она не легла поверх последних цифр даты.
  '& .MuiPickersInputBase-sectionsContainer, & .MuiInputBase-input': {
    paddingRight: '22px !important',
  },
  '& .MuiInputAdornment-root .MuiIconButton-root': { p: '2px' },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': { fontSize: 16 },
}
