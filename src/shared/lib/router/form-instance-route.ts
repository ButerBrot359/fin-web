import { generateUuidV4 } from '@/shared/lib/client-context/device-id'

import { groupCreateRoute } from './group-create-route'

export const FORM_INSTANCE_PARAM = 'fi'

const isCreatePath = (pathname: string): boolean => pathname.endsWith('/new')

export const formInstanceOf = (
  pathname: string,
  search: string
): string | null =>
  isCreatePath(pathname)
    ? new URLSearchParams(search).get(FORM_INSTANCE_PARAM) || null
    : null

export const withNewFormInstance = (route: string): string => {
  const queryStart = route.indexOf('?')
  const pathname = queryStart >= 0 ? route.slice(0, queryStart) : route
  if (!isCreatePath(pathname)) return route
  const params = new URLSearchParams(
    queryStart >= 0 ? route.slice(queryStart + 1) : ''
  )
  if (params.get(FORM_INSTANCE_PARAM)) return route
  params.set(FORM_INSTANCE_PARAM, generateUuidV4())
  return `${pathname}?${params.toString()}`
}

export const tabRouteKey = (pathname: string, search: string): string => {
  const base = groupCreateRoute(pathname, search)
  const instance = formInstanceOf(pathname, search)
  if (!instance) return base
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}${FORM_INSTANCE_PARAM}=${encodeURIComponent(instance)}`
}
