import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { NoContent } from '@/shared/ui/no-content/no-content'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { ModuleNavItem } from './module-nav-item'
import type { ModuleNavListProps } from '../types/module-nav'

export const ModuleNavList = ({ items, pageCode }: ModuleNavListProps) => {
  const { i18n } = useTranslation()

  if (items.length === 0) {
    return <NoContent />
  }

  return (
    <div
      className="grid gap-x-10"
      style={{ gridTemplateColumns: `repeat(${String(items.length)}, auto)` }}
    >
      {items.map((column, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-6 justify-start">
          {column.map((section) => (
            <div
              key={`${String(colIdx)}-${section.nameRu}`}
              className="flex flex-col gap-2"
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                className="text-accent-02"
              >
                {getLocalizedName(section, i18n.language)}
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
          ))}
        </div>
      ))}
    </div>
  )
}
