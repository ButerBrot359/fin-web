import { NAVIGATION_ITEMS } from '../lib/consts/navigation-items'
import type { NavigationItem } from '../types/types'

// TODO: replace with real API call
export function fetchNavigationItems(): Promise<NavigationItem[]> {
  return Promise.resolve(NAVIGATION_ITEMS)
}
