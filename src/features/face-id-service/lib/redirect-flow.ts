import { completeFaceId, startFaceId } from '../api/face-id-api'

const PREFIX = 'webbuh.face-id.'
const MAX_AGE_MS = 5 * 60_000
const OPAQUE = /^[A-Za-z0-9_-]{20,256}$/

interface BrowserProof {
  browserToken: string
  returnPath: string
  expiresAt: number
}

export interface FaceIdCallback {
  state: string
  code: string
}

function containsForbiddenPathCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127 || code === 92
  })
}

function isBrowserProof(value: unknown): value is BrowserProof {
  return (
    typeof value === 'object' &&
    value !== null &&
    'browserToken' in value &&
    typeof value.browserToken === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(value.browserToken) &&
    'returnPath' in value &&
    typeof value.returnPath === 'string' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  )
}

/** Адрес возврата — только локальный путь, в том числе после URL-декодирования. */
export function safeFaceIdReturnPath(value: string | null): string {
  if (!value || value.length > 2048) return '/'
  let decoded = value
  try {
    for (let i = 0; i < 3; i += 1) {
      if (
        !decoded.startsWith('/') ||
        decoded.startsWith('//') ||
        containsForbiddenPathCharacter(decoded)
      )
        return '/'
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    return '/'
  }
  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    containsForbiddenPathCharacter(decoded)
  )
    return '/'
  return value
}

export function createBrowserToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

export async function prepareFaceIdRedirect(
  returnPath: string | null
): Promise<string> {
  const browserToken = createBrowserToken()
  // Если storage недоступен, не создаём попытку, которую невозможно завершить.
  const probe = `${PREFIX}probe`
  sessionStorage.setItem(probe, '1')
  sessionStorage.removeItem(probe)
  const result = await startFaceId(browserToken)
  const url = new URL(result.authorizationUrl)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.hash ||
    !OPAQUE.test(result.state)
  ) {
    throw new Error('Invalid Face ID redirect')
  }
  const serverExpiry = Date.parse(result.expiresAt)
  if (!Number.isFinite(serverExpiry) || serverExpiry <= Date.now())
    throw new Error('Expired Face ID flow')
  const proof: BrowserProof = {
    browserToken,
    returnPath: safeFaceIdReturnPath(returnPath),
    expiresAt: Math.min(serverExpiry, Date.now() + MAX_AGE_MS),
  }
  sessionStorage.setItem(PREFIX + result.state, JSON.stringify(proof))
  return url.href
}

export function parseFaceIdCallback(search: string): FaceIdCallback | null {
  const params = new URLSearchParams(search)
  if (
    params.getAll('state').length !== 1 ||
    params.getAll('code').length !== 1 ||
    params.has('error')
  )
    return null
  const state = params.get('state') ?? ''
  const code = params.get('code') ?? ''
  return OPAQUE.test(state) && OPAQUE.test(code) ? { state, code } : null
}

/** Proof удаляется ДО одноразового обмена: при неопределённом исходе нужен новый вход. */
export async function finishFaceIdRedirect(callback: FaceIdCallback | null) {
  if (!callback) throw new Error('Invalid Face ID callback')
  const key = PREFIX + callback.state
  const raw = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)
  if (!raw) throw new Error('Missing Face ID proof')
  const proof: unknown = JSON.parse(raw)
  if (!isBrowserProof(proof) || proof.expiresAt <= Date.now())
    throw new Error('Expired Face ID proof')
  const tokens = await completeFaceId({
    ...callback,
    browserToken: proof.browserToken,
  })
  return { tokens, returnPath: safeFaceIdReturnPath(proof.returnPath) }
}
