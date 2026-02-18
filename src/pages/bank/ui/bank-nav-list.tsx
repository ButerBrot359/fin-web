import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { BANK_COLUMNS } from '../lib/consts/bank-sections'

export const BankNavList = () => {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-3 gap-x-10">
      {BANK_COLUMNS.map((column, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-6">
          {column.map((section) => (
            <div key={section.titleKey} className="flex flex-col gap-2">
              <Typography
                variant="subtitle1"
                fontWeight={600}
                className="text-accent-02"
              >
                {t(section.titleKey as never)}
              </Typography>
              <ul className="flex flex-col gap-3 pl-8">
                {section.items.map((item) => (
                  <li key={item.labelKey}>
                    <Typography variant="body2" className="text-ui-06">
                      {t(item.labelKey as never)}
                    </Typography>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
