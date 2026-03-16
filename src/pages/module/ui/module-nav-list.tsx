import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { ModuleNavItem } from './module-nav-item'
import type { ModuleNavListProps } from '../types/module-nav'

export const ModuleNavList = ({ items, pageCode }: ModuleNavListProps) => {
  const { i18n } = useTranslation()

  return (
    <div className="grid grid-cols-3 gap-x-10">
      {items.map((column, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-6">
          {column.map((section) => {
            const title =
              i18n.language === 'kz' ? section.nameKz : section.nameRu

            return (
              <div key={title} className="flex flex-col gap-2">
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  className="text-accent-02"
                >
                  {title}
                </Typography>
                <ul className="flex flex-col gap-1">
                  {section.elements.map((element) => (
                    <ModuleNavItem
                      key={element.code}
                      item={element}
                      pageCode={pageCode}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
