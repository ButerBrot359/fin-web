import { apiService } from '@/shared/api/api'

/** Учётная запись, которую правило бездействия сейчас не пускает (ТЗ §А4). */
export interface InactivityLock {
  appUserId: number
  login: string
  displayName: string | null
  lastLoginAt: string | null
  countFrom: string | null
  inactiveWorkingDays: number
  thresholdWorkingDays: number
}

interface ApiData<T> {
  data: T
}

const BASE_URL = '/api/admin/users'

export const getInactivityLocks = async (): Promise<InactivityLock[]> => {
  const response = await apiService.get<ApiData<InactivityLock[]>>({
    url: `${BASE_URL}/inactivity-locked`,
  })
  return response.data.data
}

/**
 * Снятие блокировки. Основание обязательно и уходит в журнал регистрации: требование заказчика —
 * «открывать только с согласия руководства», а согласие, нигде не записанное, нечем подтвердить.
 */
export const unlockInactivity = async (
  appUserId: number,
  reason: string
): Promise<void> => {
  await apiService.put({
    url: `${BASE_URL}/${String(appUserId)}/unlock-inactivity`,
    data: { reason },
  })
}
