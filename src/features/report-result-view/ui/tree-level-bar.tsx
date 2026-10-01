import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

interface TreeLevelBarProps {
  levels: number
  onSelect: (level: number) => void
}

export const TreeLevelBar = ({ levels, onSelect }: TreeLevelBarProps) => {
  const { t } = useTranslation()
  if (levels < 2) return null
  return (
    <div
      role="toolbar"
      aria-label={t('reports.groupLevels')}
      className="mb-1 flex items-center gap-1 print:hidden"
    >
      {Array.from({ length: levels }, (_, i) => i + 1).map((level) => (
        <Button
          key={level}
          size="small"
          variant="secondary"
          title={t('reports.groupLevel', { level })}
          aria-label={t('reports.groupLevel', { level })}
          onClick={() => {
            onSelect(level)
          }}
        >
          {String(level)}
        </Button>
      ))}
    </div>
  )
}
