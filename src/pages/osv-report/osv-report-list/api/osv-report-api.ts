import { apiService } from '@/shared/api/api'
import type { ApiListResponse } from '@/entities/account-plan'

import type {
  OsvReportEntry,
  OsvReportParams,
  OsvReportTotal,
} from '../types/osv-report'

/**
 * Ответ ОСВ — `ApiListResponse` (поле `list` со строками-счетами) плюс
 * серверная строка `total` (бэкендовый OsvReportResponse). `total` может
 * отсутствовать на старых сборках бэка — поэтому опционально.
 */
export interface OsvReportResponse extends ApiListResponse<OsvReportEntry> {
  total?: OsvReportTotal | null
}

/**
 * Код типа регистра бухгалтерии, по которому строится ОСВ.
 * Эндпоинт ОСВ параметризован typeCode регистра (а не code пункта меню).
 */
export const OSV_REGISTER_TYPE_CODE = 'ZhurnalProvodokGosUchrezhdeniya'

/**
 * Оборотно-сальдовая ведомость: остатки и обороты по счетам за период.
 * GET /api/accounting-registers/{typeCode}/balances-and-turnovers
 *     ?from={ISO}&to={ISO}&groupByDimensions=true[&accountId={Long}]
 * Ответ — ApiListResponse с массивом строк-счетов в поле `list`; каждая
 * строка содержит рекурсивный `children[]` — многоуровневый разворот по
 * измерениям (ORGANIZATION → … → SUBKONTO), см. OsvReportEntry.
 *
 * `groupByDimensions=true` отправляется только при непустом `groupBy`
 * (пользователь включил измерения на вкладке «Группировка»). Без измерений
 * запрос уходит без обоих параметров — строки по счетам; включённый
 * `expandBySubkonto` даёт базовый вариант ОСВ 1С (Счёт → Субконто).
 */
export const fetchOsvReport = (params: OsvReportParams, signal?: AbortSignal) =>
  apiService.get<OsvReportResponse>({
    url: `/api/accounting-registers/${OSV_REGISTER_TYPE_CODE}/balances-and-turnovers`,
    params: {
      from: params.from,
      to: params.to,
      // groupByDimensions — обратная совместимость со старым бэком (полный
      // разворот). Новый бэк приоритезирует `groupBy` (состав/порядок уровней).
      // Отправляем ТОЛЬКО при непустом groupBy: на бэке пустой groupBy +
      // groupByDimensions=true → принудительно ПОЛНОЕ дерево измерений, а
      // дефолт ОСВ (как в 1С) — без измерений, только Счёт → Субконто
      // (expandBySubkonto).
      // CSV (`?groupBy=ORGANIZATION,FKR`) — Spring биндит в List<String>.
      ...(params.groupBy && params.groupBy.length > 0
        ? { groupByDimensions: true, groupBy: params.groupBy.join(',') }
        : {}),
      ...(params.expandBySubkonto ? { expandBySubkonto: true } : {}),
      ...(params.accountId != null ? { accountId: params.accountId } : {}),
      // Отборы по измерениям — только заданные (не-null).
      ...Object.fromEntries(
        Object.entries(params.dimensionFilters ?? {}).filter(
          ([, v]) => v != null
        )
      ),
    },
    signal,
  })
