import type { Theme } from '@mui/material'
import type { SystemStyleObject } from '@mui/system'

export const baseInputSx: SystemStyleObject<Theme> = {
  '& .MuiFilledInput-root': {
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    minHeight: 50,
    '&:hover': { backgroundColor: '#ffffff' },
    '&.Mui-focused': { backgroundColor: '#ffffff' },
    '&::before, &::after': { display: 'none' },
  },
  '& .MuiFilledInput-input': {
    paddingLeft: '20px',
    paddingRight: '20px',
    fontSize: 16,
    fontWeight: 500,
    color: '#222124',
  },
  '& .MuiInputLabel-root': {
    color: '#9fa9ba',
    fontWeight: 500,
    left: '8px',
    '&.MuiInputLabel-shrink': {
      color: '#2a75f4',
    },
    '&.Mui-error': {
      color: '#f4482a',
    },
  },
  '& .MuiFormHelperText-root': {
    marginLeft: 0,
    '&.Mui-error': {
      color: '#f4482a',
    },
  },
}
