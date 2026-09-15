export interface FaceIdAvailability {
  enabled: boolean
  identifyEnabled: boolean
}

export interface FaceIdStart {
  authorizationUrl: string
  state: string
  expiresAt: string
}

export interface FaceIdUser {
  userEntryId: number
  userName: string
  accountAvailable: boolean
  canManage: boolean
  canReplace: boolean
  registered: boolean
  profile: {
    id: string
    subject: string
    source: string
    created: number | null
  } | null
}

export interface FaceIdSettings {
  enabled: boolean
  configured: boolean
  experimentalAuthenticationAllowed: boolean
  serviceUrl: string
  callbackUrl: string
  managementMode: string
}

/** accountId у self используется только для изоляции UI-кэша между сессиями. */
export type FaceIdPhotoTarget =
  | { kind: 'self'; accountId: number }
  | { kind: 'user'; userEntryId: number }
