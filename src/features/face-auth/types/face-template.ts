export interface FaceTemplateSummary {
  templateId: number
  appUserId: number
  modelVersion: string
  status: 'ACTIVE' | 'STALE' | 'REVOKED'
  enrollmentMode: string
  enrolledAt: string
  enrolledBy: string | null
}

export type FaceTemplateUploadOutcome =
  | { kind: 'enrolled'; template: FaceTemplateSummary }
  | { kind: 'badPhoto' }
  | { kind: 'badFile' }
  | { kind: 'notAllowed' }
  | { kind: 'unavailable' }
  | { kind: 'failed' }
