import { useState } from 'react'
import { Button, Menu, MenuItem } from '@mui/material'

import type { ReportAltMenuItem } from './reportalt-row-menu'

interface ReportAltKnopkaMenyuProps {
  label: string
  items: ReportAltMenuItem[]
  disabled?: boolean
}

/**
 * Кнопка панели отчёта с выпадающим списком — как в форме 1С.
 *
 * <p>В эталоне команды собраны во всплывающие меню: «Очистить» открывает «Отчет / Текущую
 * страницу / Приложение 200.5», «Выгрузить в XML 200.03» — «текущее приложение / все
 * приложения». Плоский ряд из дюжины кнопок читать невозможно, а в эталоне их шесть.
 */
export const ReportAltKnopkaMenyu = ({
  label,
  items,
  disabled,
}: ReportAltKnopkaMenyuProps) => {
  const [yakor, setYakor] = useState<HTMLElement | null>(null)

  return (
    <>
      <Button
        variant="outlined"
        size="medium"
        sx={{ height: 48, flexShrink: 0 }}
        disabled={disabled ?? items.length === 0}
        onClick={(event) => {
          setYakor(event.currentTarget)
        }}
      >
        {label} ▾
      </Button>
      <Menu
        open={yakor != null}
        anchorEl={yakor}
        onClose={() => {
          setYakor(null)
        }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.key}
            disabled={item.disabled}
            onClick={() => {
              // Отключённый пункт у MUI перехватывается только стилем (pointer-events), а
              // программный клик его проходит. Проверяем явно: недоступная команда не должна
              // выполняться никаким путём.
              if (item.disabled) {
                return
              }
              item.onClick()
              setYakor(null)
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
