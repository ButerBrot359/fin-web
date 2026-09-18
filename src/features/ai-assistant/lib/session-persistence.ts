import { useAuthStore } from '@/features/auth/lib/hooks/use-auth-store'

export interface StoredAssistantSession {
  conversationId: number | null
  explicitNew: boolean
  pending?: {
    requestId: string
    startedAt: number
    question?: string
    createdAt?: string
  }
}
export function useAssistantOwnerKey(): string | null {
  const userId = useAuthStore((state) => state.user?.id)
  return userId == null ? null : `${window.location.origin}:${String(userId)}`
}
const key = (owner: string) => `ai-assistant-session-v1:${owner}`
export function readAssistantSession(
  owner: string | null
): StoredAssistantSession | null {
  if (!owner) return null
  try {
    const raw = sessionStorage.getItem(key(owner))
    if (!raw) return null
    const value = JSON.parse(raw) as StoredAssistantSession
    if (
      value.conversationId != null &&
      (!Number.isSafeInteger(value.conversationId) || value.conversationId <= 0)
    )
      return null
    if (typeof value.explicitNew !== 'boolean') return null
    if (
      value.pending &&
      (typeof value.pending.requestId !== 'string' ||
        !Number.isFinite(value.pending.startedAt))
    )
      return null
    return value
  } catch {
    return null
  }
}
export function writeAssistantSession(
  owner: string | null,
  value: StoredAssistantSession
): void {
  if (!owner) return
  try {
    sessionStorage.setItem(key(owner), JSON.stringify(value))
  } catch {
    /* Storage can be unavailable; server history remains authoritative. */
  }
}
