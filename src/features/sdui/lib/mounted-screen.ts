let mountedRoute: string | null = null

export function setMountedScreenRoute(route: string): void {
  mountedRoute = route
}

export function clearMountedScreenRoute(route: string): void {
  if (mountedRoute === route) mountedRoute = null
}

export function isScreenMounted(route: string): boolean {
  return mountedRoute === route
}
