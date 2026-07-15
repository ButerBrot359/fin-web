import { apiService } from '@/shared/api/api'

interface OsGruppaResponse {
  // ApiDataResponse<{ gruppaOSId }> с бэка → тело в поле data.
  data: { gruppaOSId: number | null }
}

/**
 * Резолвит id группы «Виды долгосрочных активов» (реквизит ГруппаОС карточки ОС) —
 * КБП-ПОК-ВИДВНА. Используется для рантайм-отбора пикера «Вид ВНА» строки ТЧ по
 * `?parent=<id>`. `null` — ОС не найдено / не ОС / ГруппаОС не заполнена (graceful:
 * пикер покажет полный список).
 */
export const fetchOsGruppaId = async (osId: number): Promise<number | null> => {
  const res = await apiService.get<OsGruppaResponse>({
    url: `/api/dictionaries/os-gruppa/${osId}`,
  })
  return res.data.data.gruppaOSId ?? null
}
