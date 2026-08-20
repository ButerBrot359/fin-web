// SCRUM-277 §8/§13.13: API подбора производственных календарей из
// классификатора КБП. CAS-draft: каждый мутирующий вызов несёт текущую
// draftVersion и принимает НОВЫЙ серверный снимок PickerView целиком —
// локальных optimistic-переключений нет. Провод валидируется zod на границе.

import { z } from 'zod'

import { apiService } from '@/shared/api/api'

const BASE = '/api/view/production-calendar/classifier-picker'

// Формат UUID без RFC-4122 version/variant-строгости (z.uuid() их требует, а
// серверные draftId обязаны быть лишь синтаксически UUID — §6.1).
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)

export const classifierPickerCalendarSchema = z.object({
  code: z.string(),
  description: z.string(),
  baseCode: z.string().nullish(),
  existingEntryId: z.number().int().positive().nullish(),
  baseEntryId: z.number().int().positive().nullish(),
  existing: z.boolean(),
  requiresBaseCreation: z.boolean(),
})

export const classifierPickerViewSchema = z.object({
  draftId: uuidSchema,
  draftVersion: z.number().int().nonnegative(),
  status: z.enum(['OPEN', 'CLAIMED', 'APPLIED', 'CANCELLED', 'EXPIRED']),
  selectedCodes: z.array(z.string()),
  catalog: z.object({
    artifactId: z.number().int().positive(),
    classifierId: z.string(),
    classifierVersion: z.number().int(),
    sourceKind: z.enum(['EMBEDDED', 'DOWNLOADED']),
    listSource: z.enum(['SELECTED_ARTIFACT', 'EMBEDDED_FALLBACK']),
    rawSha256: sha256Schema,
    selectionVersion: z.number().int(),
    calendars: z.array(classifierPickerCalendarSchema),
  }),
})

export const classifierApplyResultSchema = z.object({
  requestId: uuidSchema,
  status: z.enum(['SUCCEEDED', 'PARTIAL_FAILED', 'FAILED']),
  stages: z.array(
    z.object({
      sequenceNumber: z.number().int().positive(),
      stageKind: z.enum([
        'LIST',
        'CALENDAR_METADATA',
        'BASE_CALENDAR',
        'PERIODS',
        'DAY_ROWS',
        'GRAPH_PROPAGATION',
      ]),
      calendarCode: z.string().nullish(),
      calendarYear: z.number().int().nullish(),
      status: z.enum([
        'PENDING',
        'RUNNING',
        'SUCCEEDED',
        'ABSENT',
        'FAILED',
        'RECOVERED',
      ]),
      errorCode: z.string().nullish(),
      errorMessage: z.string().nullish(),
    })
  ),
})

export type ClassifierPickerCalendar = z.infer<
  typeof classifierPickerCalendarSchema
>
export type ClassifierPickerView = z.infer<typeof classifierPickerViewSchema>
export type ClassifierApplyResult = z.infer<typeof classifierApplyResultSchema>

export interface VersionedClassifierDraftRequest {
  draftId: string
  formSessionId: string
  expectedDraftVersion: number
}

// Data envelope §8.2: {success, data}. Извлечь data, провалидировать, и только
// потом вернуть компоненту.
const dataEnvelopeSchema = z.object({ success: z.boolean(), data: z.unknown() })

async function postData<T>(
  path: string,
  body: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> {
  const res = await apiService.post({ url: `${BASE}${path}`, data: body })
  const envelope = dataEnvelopeSchema.parse(res.data)
  return schema.parse(envelope.data)
}

export const productionCalendarClassifierApi = {
  open(formSessionId: string): Promise<ClassifierPickerView> {
    return postData('/open', { formSessionId }, classifierPickerViewSchema)
  },

  status(req: {
    draftId: string
    formSessionId: string
  }): Promise<ClassifierPickerView> {
    return postData('/status', { ...req }, classifierPickerViewSchema)
  },

  select(
    req: VersionedClassifierDraftRequest & { calendarCode: string }
  ): Promise<ClassifierPickerView> {
    return postData('/select', { ...req }, classifierPickerViewSchema)
  },

  unselect(
    req: VersionedClassifierDraftRequest & { calendarCode: string }
  ): Promise<ClassifierPickerView> {
    return postData('/unselect', { ...req }, classifierPickerViewSchema)
  },

  apply(
    req: VersionedClassifierDraftRequest & { requestId: string }
  ): Promise<ClassifierApplyResult> {
    return postData('/apply', { ...req }, classifierApplyResultSchema)
  },

  async cancel(req: VersionedClassifierDraftRequest): Promise<void> {
    // §8.2: /cancel отвечает 204 No Content — тела нет, валидировать нечего.
    await apiService.post({ url: `${BASE}/cancel`, data: { ...req } })
  },
}
