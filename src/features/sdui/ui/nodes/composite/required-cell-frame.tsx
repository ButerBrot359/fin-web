import type { FC, ReactNode } from 'react'
import { Box, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface RequiredCellFrameProps {
  show: boolean
  children: ReactNode
}

/**
 * Обёртка обязательной ячейки ТЧ (SCRUM-329): при show=true — красная рамка
 * + tooltip «Обязательное поле». Структура стабильна (Box+Tooltip всегда),
 * меняются только sx/title/data-атрибут — инпут не перемонтируется, фокус
 * сохраняется. `data-required-error` — надёжный якорь для тестов (MUI sx
 * компилируется в CSS-класс, инлайн-стиля outline в DOM нет).
 */
export const RequiredCellFrame: FC<RequiredCellFrameProps> = ({
  show,
  children,
}) => {
  const { t } = useTranslation()
  return (
    <Tooltip title={show ? t('errors.required') : ''}>
      <Box
        data-required-error={show ? 'true' : undefined}
        sx={{
          width: '100%',
          borderRadius: 1,
          outline: show ? '1px solid' : 'none',
          outlineColor: 'error.main',
        }}
      >
        {children}
      </Box>
    </Tooltip>
  )
}
