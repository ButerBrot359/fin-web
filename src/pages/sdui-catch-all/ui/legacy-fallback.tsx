import type { FC } from 'react'
import { Routes, Route } from 'react-router-dom'

import { NotFound } from '@/shared/ui/not-found/not-found'

import { resolveLegacyEntry } from '../lib/kind-to-legacy'

// 422 SCREEN_NOT_SDUI: монтируем легаси-страницу. Вложенный <Routes> нужен,
// чтобы легаси получил свой useParams (мы не рефакторим легаси под пропы).
export const LegacyFallback: FC<{ kind: string | null }> = ({ kind }) => {
  const entry = kind ? resolveLegacyEntry(kind) : null
  if (!entry) return <NotFound />
  return (
    <Routes>
      <Route path={entry.path} element={entry.element} />
    </Routes>
  )
}
