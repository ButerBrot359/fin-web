import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { NetworkHop } from '../types/network-chain'

// Литеральные ключи, а не шаблонная строка: ключи i18n типизированы, и забытый перевод роли
// должен ловить компилятор. Неизвестная роль/источник (контракт может пополниться) — код как есть.
const ROLE_KEYS = {
  LOCAL: 'networkChain.roles.LOCAL',
  PROXY: 'networkChain.roles.PROXY',
  PUBLIC: 'networkChain.roles.PUBLIC',
  EDGE: 'networkChain.roles.EDGE',
} as const

const SOURCE_KEYS = {
  CLIENT: 'networkChain.sources.CLIENT',
  X_ORIGINAL_FORWARDED_FOR: 'networkChain.sources.X_ORIGINAL_FORWARDED_FOR',
  X_FORWARDED_FOR: 'networkChain.sources.X_FORWARDED_FOR',
  X_REAL_IP: 'networkChain.sources.X_REAL_IP',
  REMOTE_ADDR: 'networkChain.sources.REMOTE_ADDR',
} as const

const hasKey = <T extends object>(
  map: T,
  key: string
): key is Extract<keyof T, string> =>
  Object.prototype.hasOwnProperty.call(map, key)

interface NetworkChainHopsProps {
  hops: NetworkHop[]
}

/**
 * Полная цепочка адресов по звеньям: адрес, его роль и откуда сервер его взял. Порядок — от
 * компьютера пользователя к серверу, как пришёл с сервера.
 */
export const NetworkChainHops: FC<NetworkChainHopsProps> = ({ hops }) => {
  const { t } = useTranslation()

  if (hops.length === 0) {
    return <Typography variant="body2">{t('networkChain.empty')}</Typography>
  }

  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {hops.map((hop, index) => {
        const role = hasKey(ROLE_KEYS, hop.role)
          ? t(ROLE_KEYS[hop.role])
          : hop.role
        const source =
          hop.source && hasKey(SOURCE_KEYS, hop.source)
            ? t(SOURCE_KEYS[hop.source])
            : hop.source
        return (
          <li key={`${hop.ip}-${String(index)}`}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ fontVariantNumeric: 'tabular-nums', userSelect: 'text' }}
            >
              {hop.ip}
            </Typography>
            <Typography variant="caption" display="block">
              {source ? `${role} · ${source}` : role}
            </Typography>
          </li>
        )
      })}
    </ol>
  )
}
