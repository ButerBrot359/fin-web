/**
 * Адреса компьютера в локальной сети — со слов браузера, через WebRTC (SCRUM-371).
 *
 * Сервер видит только адрес, с которого пришёл запрос, — обычно внешний адрес роутера (NAT),
 * общий для всего офиса. Чтобы в журнале была «вся цепочка» (адрес компьютера + адрес роутера),
 * локальный адрес сообщает сам браузер заголовком `X-Client-Local-Ip`.
 *
 * <b>Как.</b> `RTCPeerConnection` БЕЗ STUN-серверов, пустой datachannel и `createOffer`: браузер
 * собирает host-кандидатов — адреса своих сетевых интерфейсов. Никуда наружу при этом ничего не
 * уходит (нет ни STUN, ни TURN, ни удалённой стороны), разрешений у пользователя не спрашивается.
 *
 * <b>Современные браузеры по умолчанию прячут адрес</b> за mDNS-именем `<uuid>.local` — такие
 * кандидаты отбрасываются. Chrome/Edge раскрывают настоящий адрес, только если организация
 * включила политику `WebRtcLocalIpsAllowedUrls` для нашего домена: так и задумано — решение
 * о раскрытии принимает администратор, а не сайт. Ничего не нашли — заголовок не шлётся.
 */

/** Сколько ждать сбора кандидатов. Больше незачем: host-кандидаты приходят за миллисекунды. */
export const LOCAL_IP_DETECTION_TIMEOUT_MS = 1500

/** Потолок числа адресов: у машины с VPN и виртуальными адаптерами их бывает десяток. */
export const LOCAL_IP_MAX_COUNT = 5

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const IPV6 = /^[0-9a-f:]+$/i

const isIpv4 = (address: string): boolean => {
  const match = IPV4.exec(address)
  return !!match && match.slice(1).every((octet) => Number(octet) <= 255)
}

const isIpv6 = (address: string): boolean =>
  address.includes(':') && IPV6.test(address) && address.length <= 39

/**
 * Настоящий ли это адрес интерфейса, который есть смысл писать в журнал. Отбрасываются mDNS-имена
 * (`*.local` — браузер спрятал адрес), «никакой» адрес, loopback и link-local (169.254/16,
 * fe80::/10): они есть у любой машины и компьютер не идентифицируют.
 */
export const isReportableIp = (address: string): boolean => {
  const value = address.trim().toLowerCase()
  if (!value || value.endsWith('.local')) return false
  if (isIpv4(value)) {
    return !(
      value === '0.0.0.0' ||
      value.startsWith('127.') ||
      value.startsWith('169.254.')
    )
  }
  if (isIpv6(value)) {
    return !(value === '::' || value === '::1' || /^fe[89ab]/.test(value))
  }
  return false
}

/**
 * Адрес из строки ICE-кандидата (RFC 5245 §15.1):
 * `candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> …`.
 * Берутся только host-кандидаты: srflx/relay — это уже адреса снаружи, их сервер знает и сам.
 */
export const parseCandidateAddress = (candidate: string): string | null => {
  const parts = candidate.replace(/^a=/, '').trim().split(/\s+/)
  const typIndex = parts.indexOf('typ')
  if (parts.length < 8 || typIndex !== 6 || parts[7] !== 'host') return null
  const address = parts[4].replace(/^\[|\]$/g, '').toLowerCase()
  return isReportableIp(address) ? address : null
}

/** Кандидаты, попавшие в SDP (часть браузеров кладёт их туда вместо событий). */
export const extractAddressesFromSdp = (sdp: string): string[] =>
  sdp
    .split(/\r?\n/)
    .filter((line) => line.startsWith('a=candidate:'))
    .map(parseCandidateAddress)
    .filter((address): address is string => address !== null)

/** Без повторов, IPv4 впереди (их читают люди), не больше потолка. */
export const orderAddresses = (addresses: Iterable<string>): string[] => {
  const unique = [...new Set(addresses)]
  const v4 = unique.filter(isIpv4)
  const v6 = unique.filter((address) => !isIpv4(address))
  return [...v4, ...v6].slice(0, LOCAL_IP_MAX_COUNT)
}

export interface DetectLocalIpsOptions {
  timeoutMs?: number
  /** Подмена для тестов; по умолчанию — настоящий `RTCPeerConnection` без ICE-серверов. */
  createPeerConnection?: () => RTCPeerConnection
}

const defaultPeerConnection = (): RTCPeerConnection =>
  new RTCPeerConnection({ iceServers: [] })

/**
 * Собирает локальные адреса. Никогда не бросает и не висит дольше таймаута: нет WebRTC,
 * браузер отказал, адреса спрятаны — во всех случаях просто пустой список.
 */
export const detectLocalIps = (
  options: DetectLocalIpsOptions = {}
): Promise<string[]> => {
  const timeoutMs = options.timeoutMs ?? LOCAL_IP_DETECTION_TIMEOUT_MS
  const create =
    options.createPeerConnection ??
    (typeof RTCPeerConnection === 'undefined' ? null : defaultPeerConnection)
  if (!create) return Promise.resolve([])

  return new Promise((resolve) => {
    const found: string[] = []
    let connection: RTCPeerConnection
    try {
      connection = create()
    } catch {
      resolve([])
      return
    }

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      try {
        found.push(
          ...extractAddressesFromSdp(connection.localDescription?.sdp ?? '')
        )
      } catch {
        // SDP недоступен — хватит того, что пришло событиями.
      }
      try {
        connection.onicecandidate = null
        connection.close()
      } catch {
        // Соединение уже закрыто — не важно.
      }
      resolve(orderAddresses(found))
    }
    const timer = setTimeout(finish, timeoutMs)

    connection.onicecandidate = (event) => {
      // null-кандидат — сбор закончен.
      if (!event.candidate) {
        finish()
        return
      }
      const address = parseCandidateAddress(event.candidate.candidate)
      if (address) found.push(address)
    }

    try {
      connection.createDataChannel('')
      connection
        .createOffer()
        .then((offer) => connection.setLocalDescription(offer))
        .catch(finish)
    } catch {
      finish()
    }
  })
}
