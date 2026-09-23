import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  detectLocalIps,
  extractAddressesFromSdp,
  isReportableIp,
  orderAddresses,
  parseCandidateAddress,
} from './local-ip'

const host = (address: string) =>
  `candidate:842163049 1 udp 1677729535 ${address} 56143 typ host generation 0 network-cost 999`

/**
 * Поддельный RTCPeerConnection: после setLocalDescription «присылает» заданные кандидаты
 * событиями и (по желанию) завершает сбор null-кандидатом.
 */
const fakeConnection = (options: {
  candidates: string[]
  sdp?: string
  endOfCandidates?: boolean
  offerFails?: boolean
}) => {
  const connection = {
    onicecandidate: null as
      | ((event: { candidate: { candidate: string } | null }) => void)
      | null,
    localDescription: null as { sdp: string } | null,
    close: vi.fn(),
    createDataChannel: vi.fn(),
    createOffer: vi.fn(() =>
      options.offerFails
        ? Promise.reject(new Error('offer'))
        : Promise.resolve({ type: 'offer', sdp: options.sdp ?? '' })
    ),
    setLocalDescription: vi.fn((offer: { sdp: string }) => {
      connection.localDescription = { sdp: offer.sdp }
      setTimeout(() => {
        for (const candidate of options.candidates) {
          connection.onicecandidate?.({ candidate: { candidate } })
        }
        if (options.endOfCandidates !== false) {
          connection.onicecandidate?.({ candidate: null })
        }
      }, 0)
      return Promise.resolve()
    }),
  }
  return connection
}

describe('локальные адреса через WebRTC (SCRUM-371)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('берёт адрес только из host-кандидата', () => {
    expect(parseCandidateAddress(host('192.168.1.15'))).toBe('192.168.1.15')
    expect(
      parseCandidateAddress(
        'candidate:1 1 udp 1686052607 95.56.1.2 50000 typ srflx raddr 0.0.0.0 rport 0'
      )
    ).toBeNull()
    expect(parseCandidateAddress('мусор')).toBeNull()
  })

  it('отбрасывает mDNS-имена, loopback и link-local', () => {
    expect(parseCandidateAddress(host('1f2e3d4c-aaaa-bbbb.local'))).toBeNull()
    expect(isReportableIp('127.0.0.1')).toBe(false)
    expect(isReportableIp('169.254.10.1')).toBe(false)
    expect(isReportableIp('0.0.0.0')).toBe(false)
    expect(isReportableIp('::1')).toBe(false)
    expect(isReportableIp('fe80::1c2b:3a4d')).toBe(false)
    expect(isReportableIp('256.1.1.1')).toBe(false)
    expect(isReportableIp('10.20.0.3')).toBe(true)
    expect(isReportableIp('2a02:6b8::1')).toBe(true)
  })

  it('достаёт кандидатов из SDP', () => {
    const sdp = [
      'v=0',
      `a=${host('10.0.0.7')}`,
      `a=${host('abc.local')}`,
      'a=mid:0',
    ].join('\r\n')
    expect(extractAddressesFromSdp(sdp)).toEqual(['10.0.0.7'])
  })

  it('убирает повторы, ставит IPv4 впереди и держит потолок', () => {
    expect(
      orderAddresses([
        '2a02:6b8::1',
        '192.168.1.15',
        '192.168.1.15',
        '10.0.0.1',
        '10.0.0.2',
        '10.0.0.3',
        '10.0.0.4',
      ])
    ).toEqual(['192.168.1.15', '10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4'])
  })

  it('собирает адреса событий и SDP, затем закрывает соединение', async () => {
    const connection = fakeConnection({
      candidates: [host('192.168.1.15'), host('x.local')],
      sdp: `a=${host('10.8.0.2')}`,
    })

    const ips = await detectLocalIps({
      createPeerConnection: () => connection as unknown as RTCPeerConnection,
    })

    expect(ips).toEqual(['192.168.1.15', '10.8.0.2'])
    expect(connection.createDataChannel).toHaveBeenCalled()
    expect(connection.close).toHaveBeenCalled()
  })

  it('не ждёт дольше таймаута, если сбор не завершился', async () => {
    vi.useFakeTimers()
    const connection = fakeConnection({
      candidates: [host('192.168.1.15')],
      endOfCandidates: false,
    })

    const result = detectLocalIps({
      timeoutMs: 1500,
      createPeerConnection: () => connection as unknown as RTCPeerConnection,
    })
    await vi.advanceTimersByTimeAsync(1500)

    await expect(result).resolves.toEqual(['192.168.1.15'])
    expect(connection.close).toHaveBeenCalled()
  })

  it('отказ браузера — пустой список, а не исключение', async () => {
    await expect(
      detectLocalIps({
        createPeerConnection: () => {
          throw new Error('WebRTC отключён')
        },
      })
    ).resolves.toEqual([])

    await expect(
      detectLocalIps({
        createPeerConnection: () =>
          fakeConnection({
            candidates: [],
            offerFails: true,
          }) as unknown as RTCPeerConnection,
      })
    ).resolves.toEqual([])
  })

  it('без WebRTC в среде — пустой список', async () => {
    // В jsdom RTCPeerConnection нет — ровно случай старого браузера.
    await expect(detectLocalIps()).resolves.toEqual([])
  })
})
