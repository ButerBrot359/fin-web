import type { Theme } from '@mui/material'
import type { SystemStyleObject } from '@mui/system'

// Компактная стилизация под ячейку ТЧ — по образцу cellSx/dateCellSx
// из table-cell-editor.tsx (прозрачный фон, без рамки, высота 28px).
const inputBase = {
  backgroundColor: 'transparent !important',
  border: 'none !important',
  borderRadius: '0 !important',
  minHeight: '28px !important',
  padding: '0 8px !important',
}

export const wrapperSx: SystemStyleObject<Theme> = {
  width: '100%',
  '& .MuiFormControl-root': { mb: 0, position: 'static' },
  '& .MuiFilledInput-root': {
    ...inputBase,
    // Кнопки (стрелка списка, «открыть карточку») прижаты к ВЕРХУ, а не к
    // середине: значение многострочное, и на двух строках центрированные
    // иконки уезжали бы к середине текста.
    alignItems: 'flex-start',
  },
  '& .MuiAutocomplete-input': {
    padding: '4px 0 !important',
    fontSize: '14px !important',
    // Значение поля — textarea (multilineInput), перенос по ширине колонки.
    // resize: none — ручка изменения размера в ячейке ТЧ неуместна.
    resize: 'none',
    overflowWrap: 'anywhere',
  },
  '& .MuiAutocomplete-endAdornment': { top: 2 },
}

/**
 * Тот же пикер в колонке БЕЗ переноса («Источник финансирования»): значение —
 * однострочный <input> (multilineInput={false}), поэтому кнопки центрируются по
 * высоте поля, а не прижимаются к верху, а не влезший «хвост» наименования
 * срезается многоточием.
 */
export const nowrapWrapperSx: SystemStyleObject<Theme> = {
  width: '100%',
  '& .MuiFormControl-root': { mb: 0, position: 'static' },
  '& .MuiFilledInput-root': { ...inputBase, alignItems: 'center' },
  '& .MuiAutocomplete-input': {
    padding: '4px 0 !important',
    fontSize: '14px !important',
    textOverflow: 'ellipsis',
  },
  '& .MuiAutocomplete-endAdornment': { top: 2 },
}
