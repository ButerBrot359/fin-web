import SearchIcon from '@/shared/assets/icons/search.svg'
import HistoryIcon from '@/shared/assets/icons/history.svg'
import StarIcon from '@/shared/assets/icons/star.svg'

import type { ToolbarAction } from '../../types/types'

// Колокольчик оповещений (SCRUM-317) — живой компонент NotificationBell в
// top-bar.tsx, из декоративного списка убран.
export const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { id: 'search', icon: SearchIcon, label: 'Search' },
  { id: 'history', icon: HistoryIcon, label: 'History' },
  { id: 'star', icon: StarIcon, label: 'Favorites' },
]
