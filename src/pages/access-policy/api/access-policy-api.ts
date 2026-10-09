import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

/**
 * Экран «Режим прав доступа» (SCRUM-400 §11): чтение состояния политики прав
 * и переключение режима одним вызовом. Доступ — только администратору политики
 * прав («Полные права», break-glass, явный ALLOWLIST): остальным сервер
 * отвечает 403, пункта меню у них нет.
 */

export type AccessEnforcementMode = 'OFF' | 'SHADOW' | 'ENFORCE'

export type AccessChannel =
  | 'MENU'
  | 'VIEW_OPEN'
  | 'VIEW_COMMAND'
  | 'REST_WRITE'
  | 'PRINT_EXPORT'
  | 'ASYNC'
  | 'WRITE_SEAM'
  | 'RECORD_READ'
  | 'RECORD_SCOPE'

export interface AccessPolicySmoke {
  ok: boolean
  runtimeStateReadable: boolean
  projectionSafeToEnforce: boolean
  channelModesHealthy: boolean
  pendingSubjectsCount: number
  rightsDataReady: boolean
  rightsDataProblems: string[]
}

export interface AccessPolicyRelease {
  id: number
  /** ACTIVE | RETIRED | READY | FAILED | PENDING — открытый набор (§11.3). */
  status: string
  policyVersion: string
  activatedAt: string | null
  retiredAt: string | null
  createdBy: string | null
}

export interface AccessPolicyOverview {
  mode: AccessEnforcementMode
  /** Только явно заданные ключи; {} — переопределений нет. */
  channelModes: Partial<Record<AccessChannel, AccessEnforcementMode>>
  /** Передавать в switch как expectedPolicyRevision. */
  policyRevision: number
  /** > 0 — «права пользователей обновляются», перечитывать overview. */
  pendingSubjectsCount: number
  activeRelease: {
    id: number
    policyVersion: string
    activatedAt: string | null
    activatedBy: string | null
    manifestSha256: string
  } | null
  smoke: AccessPolicySmoke
  /** Последние 10 релизов, новые сверху. */
  recentReleases: AccessPolicyRelease[]
}

export interface AccessPolicySwitchRequest {
  mode: AccessEnforcementMode
  /** null/отсутствует — переопределения НЕ меняются; {} — снимаются; иначе
   * карта ЗАМЕНЯЕТСЯ целиком (прежние переопределения передавать явно). */
  channelModes?: Partial<Record<AccessChannel, AccessEnforcementMode>> | null
  expectedPolicyRevision: number
  /** Обязателен, если не dryRun; ≤500 символов; уходит в журнал регистрации. */
  comment?: string | null
  dryRun?: boolean | null
}

export type AccessPolicySwitchOutcome =
  | 'PENDING'
  | 'READY'
  | 'CHECK_PASSED'
  | 'CHECK_FAILED'

export interface AccessPolicySwitchResult {
  outcome: AccessPolicySwitchOutcome
  policyRevision: number
  activeReleaseId: number | null
  problems: string[]
  smoke: AccessPolicySmoke | null
}

export interface AccessPolicyRollbackRequest {
  expectedPolicyRevision: number
  expectedActiveReleaseId: number | null
  expectedManifestSha256: string | null
  targetReleaseId?: number | null
  mode?: AccessEnforcementMode | null
  channelModes?: Partial<Record<AccessChannel, AccessEnforcementMode>> | null
}

export interface AccessPolicyActivationResult {
  outcome: 'PENDING' | 'READY'
  policyRevision: number
  activeReleaseId: number
  protocolFloor: number
  pendingSubjectsCount: number
}

const BASE_URL = '/api/admin/access/policy'

export const fetchAccessPolicyOverview = async (
  signal?: AbortSignal
): Promise<AccessPolicyOverview> => {
  const res = await apiService.get<ApiResponse<AccessPolicyOverview>>({
    url: `${BASE_URL}/overview`,
    signal,
  })
  return res.data.data
}

export const switchAccessPolicy = async (
  body: AccessPolicySwitchRequest
): Promise<AccessPolicySwitchResult> => {
  const res = await apiService.post<ApiResponse<AccessPolicySwitchResult>>({
    url: `${BASE_URL}/switch`,
    data: body,
  })
  return res.data.data
}

export const rollbackAccessPolicy = async (
  body: AccessPolicyRollbackRequest
): Promise<AccessPolicyActivationResult> => {
  const res = await apiService.post<ApiResponse<AccessPolicyActivationResult>>({
    url: `${BASE_URL}/rollback`,
    data: body,
  })
  return res.data.data
}
