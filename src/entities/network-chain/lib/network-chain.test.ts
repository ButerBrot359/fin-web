import { describe, expect, it } from 'vitest'

import { formatNetworkChainShort, resolveNetworkChain } from './network-chain'

const fullChain = [
  { ip: '192.168.1.15', role: 'LOCAL', source: 'CLIENT' },
  { ip: '10.20.0.3', role: 'PROXY', source: 'X_ORIGINAL_FORWARDED_FOR' },
  { ip: '95.56.1.2', role: 'PUBLIC', source: 'X_FORWARDED_FOR' },
  { ip: '10.244.0.12', role: 'EDGE', source: 'REMOTE_ADDR' },
]

describe('IP-цепочка журнала (SCRUM-371)', () => {
  it('коротко — «компьютер → внешний адрес», прокси и шлюз только в подробностях', () => {
    expect(
      formatNetworkChainShort(resolveNetworkChain({ networkChain: fullChain }))
    ).toBe('192.168.1.15 → 95.56.1.2')
  })

  it('без цепочки собирает её из отдельных полей', () => {
    expect(
      resolveNetworkChain({
        clientLocalIp: '192.168.1.15, 10.8.0.2',
        clientPublicIp: '95.56.1.2',
      })
    ).toEqual([
      { ip: '192.168.1.15', role: 'LOCAL', source: 'CLIENT' },
      { ip: '10.8.0.2', role: 'LOCAL', source: 'CLIENT' },
      { ip: '95.56.1.2', role: 'PUBLIC', source: null },
    ])
  })

  it('старая запись — единственный адрес клиента', () => {
    const hops = resolveNetworkChain({ clientAddress: '204.168.204.132' })
    expect(formatNetworkChainShort(hops)).toBe('204.168.204.132')
  })

  it('ничего нет — пусто; мусор в цепочке отбрасывается', () => {
    expect(formatNetworkChainShort(resolveNetworkChain({}))).toBe('')
    expect(
      resolveNetworkChain({
        networkChain: [{ ip: '', role: 'LOCAL' }, null as never],
        clientAddress: '1.2.3.4',
      })
    ).toEqual([{ ip: '1.2.3.4', role: 'PUBLIC', source: null }])
  })

  it('только прокси и шлюз — показывается путь как есть', () => {
    expect(
      formatNetworkChainShort([
        { ip: '10.20.0.3', role: 'PROXY' },
        { ip: '10.244.0.12', role: 'EDGE' },
      ])
    ).toBe('10.20.0.3 → 10.244.0.12')
  })
})
