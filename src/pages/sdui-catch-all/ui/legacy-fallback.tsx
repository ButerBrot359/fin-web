import type { FC } from 'react'
import { Routes, Route } from 'react-router-dom'

import { NotFound } from '@/shared/ui/not-found/not-found'

import { resolveLegacyRoutes } from '../lib/kind-to-legacy'

// 422 SCREEN_NOT_SDUI: монтируем легаси-страницу. Вложенный <Routes> нужен,
// чтобы легаси получил свой useParams (мы не рефакторим легаси под пропы).
// Каждый kind может резолвить несколько путей (module-путь на легаси-страницу
// напрямую + плоский путь на редирект, который сначала находит pageCode).
export const LegacyFallback: FC<{ kind: string | null }> = ({ kind }) => {
  const routes = kind ? resolveLegacyRoutes(kind) : null
  if (!routes) return <NotFound />
  return (
    <Routes>
      {routes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
