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
  '& .MuiInputAdornment-root': {
    width: 0,
    overflow: 'visible',
    ml: 0,
    transform: 'translateX(-24px)',
  },
  '& .MuiInputAdornment-root .MuiIconButton-root': { p: '2px' },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': { fontSize: 16 },
}
