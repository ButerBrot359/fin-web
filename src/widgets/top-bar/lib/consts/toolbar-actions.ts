import SearchIcon from '@/shared/assets/icons/search.svg'
import NotificationIcon from '@/shared/assets/icons/notification.svg'
import HistoryIcon from '@/shared/assets/icons/history.svg'
import StarIcon from '@/shared/assets/icons/star.svg'

import type { ToolbarAction } from '../../types/types'

export const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { id: 'search', icon: SearchIcon, label: 'Search' },
  { id: 'notification', icon: NotificationIcon, label: 'Notifications' },
  { id: 'history', icon: HistoryIcon, label: 'History' },
  { id: 'star', icon: StarIcon, label: 'Favorites' },
]
