import type { FC } from 'react'
import { Tooltip } from '@mui/material'

import { formatNetworkChainShort } from '../lib/network-chain'
import type { NetworkHop } from '../types/network-chain'
import { NetworkChainHops } from './network-chain-hops'

interface NetworkChainViewProps {
  hops: NetworkHop[]
}

/**
 * IP-цепочка в ячейке: коротко «адрес компьютера → внешний адрес», полная цепочка с ролями —
 * в подсказке. Адресов нет — «—»: у событий, записанных до SCRUM-371, их может не быть.
 */
export const NetworkChainView: FC<NetworkChainViewProps> = ({ hops }) => {
  const short = formatNetworkChainShort(hops)
  if (!short) return <>—</>

  return (
    <Tooltip
      title={<NetworkChainHops hops={hops} />}
      placement="bottom-start"
      enterDelay={300}
    >
      <span
        className="whitespace-nowrap"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {short}
      </span>
    </Tooltip>
  )
}
