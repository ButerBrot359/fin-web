import type { NetworkChainSource, NetworkHop } from '../types/network-chain'

const splitIps = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)

const isHop = (value: unknown): value is NetworkHop =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as NetworkHop).ip === 'string' &&
  (value as NetworkHop).ip.trim() !== ''

/**
 * Полная цепочка адресов записи. Если сервер прислал `networkChain` — она как есть (порядок —
 * серверный). Иначе собирается из отдельных полей: локальные адреса, внешний адрес, а для
 * старых записей — единственный `clientAddress`, роль которого неизвестна (`PUBLIC` — ближе
 * всего к тому, что сервер видел раньше).
 */
export const resolveNetworkChain = (
  source: NetworkChainSource
): NetworkHop[] => {
  const chain = Array.isArray(source.networkChain)
    ? source.networkChain.filter(isHop)
    : []
  if (chain.length > 0) return chain

  const hops: NetworkHop[] = splitIps(source.clientLocalIp).map((ip) => ({
    ip,
    role: 'LOCAL',
    source: 'CLIENT',
  }))
  const publicIp = source.clientPublicIp?.trim() || source.clientAddress?.trim()
  if (publicIp) hops.push({ ip: publicIp, role: 'PUBLIC', source: null })
  return hops
}

/**
 * Короткая запись цепочки для колонки: «адрес компьютера → внешний адрес»
 * («192.168.1.15 → 95.56.1.2»). Прокси и шлюзы — только в подробностях: в колонке журнала
 * человеку нужен ответ «с какого компьютера и из какой сети». Нет ни локального, ни внешнего —
 * показывается то, что есть.
 */
export const formatNetworkChainShort = (hops: NetworkHop[]): string => {
  if (hops.length === 0) return ''
  const local = hops.filter((hop) => hop.role === 'LOCAL').map((hop) => hop.ip)
  const external = hops.find((hop) => hop.role === 'PUBLIC')?.ip
  const parts = [local.join(', '), external].filter(
    (part): part is string => !!part
  )
  if (parts.length > 0) return parts.join(' → ')
  return hops.map((hop) => hop.ip).join(' → ')
}
