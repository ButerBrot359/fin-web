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
