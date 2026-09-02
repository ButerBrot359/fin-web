import { useState } from 'react'
import { Badge, Popover } from '@mui/material'
import { useTranslation } from 'react-i18next'

import LayersIcon from '@/shared/assets/icons/layers.svg'
import { Button } from '@/shared/ui/buttons'

import { useActiveTasksCount } from '../lib/hooks/use-active-tasks-count'
import { BackgroundTasksPanel } from './background-tasks-panel'

// Кнопка «Мои операции» в шапке: бейдж с числом активных фоновых задач,
// по клику — поповер со списком и отменой (SCRUM-330 Работа 3).
export const BackgroundTasksIndicator = () => {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const activeCount = useActiveTasksCount()

  return (
    <>
      <Button
        variant="tertiary"
        aria-label={t('backgroundTasks.title')}
        onClick={(e) => {
          setAnchor(e.currentTarget)
        }}
        startIcon={
          <Badge badgeContent={activeCount} color="primary">
            <LayersIcon className="h-5 w-5" />
          </Badge>
        }
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {/* Переход к объекту закрывает поповер: иначе он висел бы поверх только
            что открытой карточки, ради которой пользователь и кликнул. */}
        <BackgroundTasksPanel
          onNavigate={() => {
            setAnchor(null)
          }}
        />
      </Popover>
    </>
  )
}
