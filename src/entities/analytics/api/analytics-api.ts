import type {
  AnalyticsDictionaryPermission,
  AnalyticsDictionaryPermissionPage,
} from '../types/dictionary-permissions'
import { apiService } from '@/shared/api/api'
import type { AiStatistics, AiStatisticsFilters } from '../types/ai-statistics'
import type { AnalyticsOrganization } from '../types/organization'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  AnalyticsAiSettings,
  AnalyticsAiSettingsUpdate,
  AnalyticsAiTestResult,
  AnalyticsModel,
  LlmProvider,
} from '../types/ai-settings'
import type {
  AnalyticsConversation,
  AnalyticsGenerateRequest,
  AnalyticsGenerateResponse,
  AnalyticsLlmRequest,
} from '../types/assistant'
import type {
  AnalyticsCatalogIndexItem,
  AnalyticsCatalogView,
  AnalyticsItem,
  AnalyticsItemSaveRequest,
  AnalyticsItemSummary,
  AnalyticsWidgetKind,
} from '../types/item'
import type {
  AnalyticsQueryRequest,
  AnalyticsQueryResult,
  AnalyticsSqlValidation,
} from '../types/query'
import type { AnalyticsItemKind } from '../types/spec'

/**
 * Итог пересборки каталога витрин — зеркало
 * `catalog/AnalyticsCatalogRebuildResultDto`. Живёт здесь, а не в `types/`:
 * это ответ единственной операции обслуживания, отдельного типа он не стоит.
 */
export interface AnalyticsCatalogRebuildResult {
  created: number
  skipped: number
  failed: number
  durationMs: number
  errors: string[]
}

const BASE_URL = '/api/analytics'

/**
 * Потолок ожидания вызова, который ждёт языковую модель.
 *
 * Общие 60 секунд `DEFAULT_TIMEOUT_MS` сюда не годятся: они выровнены с дефолтом
 * nginx-ingress, а долгие пути аналитики (`/api/analytics/assistant`,
 * `/api/analytics/ai-settings`) вынесены в отдельный Ingress с потолком 900 с —
 * см. `k8s/ingress-analytics.yml` в репозитории webbuh.
 *
 * Значение чуть больше шлюзового: клиент не должен сдаваться раньше него, иначе
 * пользователь увидит «превышено время ожидания» вместо настоящей причины,
 * которую сервер к тому моменту уже готов назвать.
 *
 * Числа такие большие из-за своей модели (провайдер LOCAL): на пользовательском
 * железе через VPN, да ещё с рассуждением, ответ идёт минутами. У облачных
 * провайдеров запрос укладывается в секунды-десятки секунд, и потолок не трогает
 * никого — он именно потолок, а не ожидаемое время.
 */
const LLM_CALL_TIMEOUT_MS = 930_000

/**
 * Все ответы раздела обёрнуты в `ApiDataResponse<T>` (поле `data`), поэтому
 * axios отдаёт `res.data.data`. Разворачиваем здесь — наружу уходит уже
 * доменный результат, хуки про обёртку ничего не знают.
 *
 * Важно про ошибки: `makeRequest` в `shared/api/api.ts` бросает ТЕЛО ответа,
 * а не `AxiosError`. HTTP-статуса в `error` не будет — 422 (SQL отклонён
 * guardrails), 409 (расхождение sqlHash) и 502 (провайдер LLM недоступен)
 * различаются только по содержимому тела.
 */
const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const analyticsApi = {
  getDictionaryPermissions: (
    q: string,
    page: number,
    signal?: AbortSignal
  ): Promise<AnalyticsDictionaryPermissionPage> =>
    apiService
      .get<
        ApiResponse<AnalyticsDictionaryPermissionPage>
      >({ url: `${BASE_URL}/ai-settings/dictionary-permissions`, params: { q, page, size: 50 }, signal })
      .then(unwrap),
  updateDictionaryPermission: (
    typeCode: string,
    allowed: boolean
  ): Promise<AnalyticsDictionaryPermission> =>
    apiService
      .put<
        ApiResponse<AnalyticsDictionaryPermission>
      >({ url: `${BASE_URL}/ai-settings/dictionary-permissions/${encodeURIComponent(typeCode)}`, data: { allowed } })
      .then(unwrap),
  getAiStatistics: (
    filters: AiStatisticsFilters,
    signal?: AbortSignal
  ): Promise<AiStatistics> =>
    apiService
      .get<ApiResponse<AiStatistics>>({
        url: `${BASE_URL}/ai-statistics`,
        params: { ...filters },
        signal,
      })
      .then(unwrap),

  /** Индекс витрин: то, из чего ассистент выбирает источники данных. */
  getCatalogIndex: (
    signal?: AbortSignal
  ): Promise<AnalyticsCatalogIndexItem[]> =>
    apiService
      .get<ApiResponse<AnalyticsCatalogIndexItem[]>>({
        url: `${BASE_URL}/catalog`,
        signal,
      })
      .then(unwrap),

  /** Полное описание одной витрины вместе с колонками. */
  getCatalogView: (
    viewName: string,
    signal?: AbortSignal
  ): Promise<AnalyticsCatalogView> =>
    apiService
      .get<ApiResponse<AnalyticsCatalogView>>({
        url: `${BASE_URL}/catalog/${viewName}`,
        signal,
      })
      .then(unwrap),

  /** Пересборка каталога витрин по актуальным метаданным EAV. */
  rebuildCatalog: (
    signal?: AbortSignal
  ): Promise<AnalyticsCatalogRebuildResult> =>
    apiService
      .post<ApiResponse<AnalyticsCatalogRebuildResult>>({
        url: `${BASE_URL}/catalog/rebuild`,
        signal,
      })
      .then(unwrap),

  /** Организации для отбора данных: действующие, без групп, по алфавиту. */
  getOrganizations: (signal?: AbortSignal): Promise<AnalyticsOrganization[]> =>
    apiService
      .get<ApiResponse<AnalyticsOrganization[]>>({
        url: `${BASE_URL}/organizations`,
        signal,
      })
      .then(unwrap),

  /**
   * Выполнение датасета. Строки идут БД → бэкенд → фронт и в LLM не попадают
   * никогда — этот вызов к модели не обращается.
   */
  executeQuery: (
    request: AnalyticsQueryRequest,
    signal?: AbortSignal
  ): Promise<AnalyticsQueryResult> =>
    apiService
      .post<ApiResponse<AnalyticsQueryResult>>({
        url: `${BASE_URL}/query/execute`,
        data: request,
        signal,
      })
      .then(unwrap),

  /** Проверка SQL guardrails без выполнения: что именно не понравилось. */
  validateSql: (
    request: AnalyticsQueryRequest,
    signal?: AbortSignal
  ): Promise<AnalyticsSqlValidation> =>
    apiService
      .post<ApiResponse<AnalyticsSqlValidation>>({
        url: `${BASE_URL}/query/validate`,
        data: request,
        signal,
      })
      .then(unwrap),

  /** Построение спецификации ассистентом по формулировке пользователя. */
  generate: (
    request: AnalyticsGenerateRequest,
    signal?: AbortSignal
  ): Promise<AnalyticsGenerateResponse> =>
    apiService
      .post<ApiResponse<AnalyticsGenerateResponse>>({
        url: `${BASE_URL}/assistant/generate`,
        data: request,
        signal,
        // За один HTTP-запрос модель отрабатывает дважды (выбор витрин, затем
        // генерация), плюс возможная попытка починки SQL — три вызова подряд.
        timeout: LLM_CALL_TIMEOUT_MS,
      })
      .then(unwrap),

  /** История диалога с ассистентом. */
  getConversation: (
    id: number,
    signal?: AbortSignal
  ): Promise<AnalyticsConversation> =>
    apiService
      .get<ApiResponse<AnalyticsConversation>>({
        url: `${BASE_URL}/assistant/conversations/${String(id)}`,
        signal,
      })
      .then(unwrap),

  /** Аудит обращения к модели — источник панели «Что ушло в ИИ». */
  getLlmRequest: (
    id: number,
    signal?: AbortSignal
  ): Promise<AnalyticsLlmRequest> =>
    apiService
      .get<ApiResponse<AnalyticsLlmRequest>>({
        url: `${BASE_URL}/llm-requests/${String(id)}`,
        signal,
      })
      .then(unwrap),

  /** Сохранённые дашборды и отчёты; без `kind` — весь список. */
  listItems: (
    kind?: AnalyticsItemKind,
    signal?: AbortSignal
  ): Promise<AnalyticsItemSummary[]> =>
    apiService
      .get<ApiResponse<AnalyticsItemSummary[]>>({
        url: `${BASE_URL}/items`,
        params: kind ? { kind } : {},
        signal,
      })
      .then(unwrap),

  getItem: (code: string, signal?: AbortSignal): Promise<AnalyticsItem> =>
    apiService
      .get<ApiResponse<AnalyticsItem>>({
        url: `${BASE_URL}/items/${code}`,
        signal,
      })
      .then(unwrap),

  /** Создание (POST) или перезапись (PUT) — по наличию кода в запросе. */
  saveItem: (
    request: AnalyticsItemSaveRequest,
    signal?: AbortSignal
  ): Promise<AnalyticsItem> =>
    request.code
      ? apiService
          .put<ApiResponse<AnalyticsItem>>({
            url: `${BASE_URL}/items/${request.code}`,
            data: request,
            signal,
          })
          .then(unwrap)
      : apiService
          .post<ApiResponse<AnalyticsItem>>({
            url: `${BASE_URL}/items`,
            data: request,
            signal,
          })
          .then(unwrap),

  deleteItem: (code: string, signal?: AbortSignal): Promise<void> =>
    apiService
      .delete({ url: `${BASE_URL}/items/${code}`, signal })
      .then(() => undefined),

  getAiSettings: (signal?: AbortSignal): Promise<AnalyticsAiSettings> =>
    apiService
      .get<ApiResponse<AnalyticsAiSettings>>({
        url: `${BASE_URL}/ai-settings`,
        signal,
      })
      .then(unwrap),

  updateAiSettings: (
    request: AnalyticsAiSettingsUpdate,
    signal?: AbortSignal
  ): Promise<AnalyticsAiSettings> =>
    apiService
      .put<ApiResponse<AnalyticsAiSettings>>({
        url: `${BASE_URL}/ai-settings`,
        data: request,
        signal,
      })
      .then(unwrap),

  /**
   * Каталог моделей провайдера. `baseUrl` нужен для self-hosted шлюзов:
   * список берётся с того же адреса, на который потом пойдут запросы.
   */
  getModels: (
    provider: LlmProvider,
    baseUrl?: string | null,
    signal?: AbortSignal
  ): Promise<AnalyticsModel[]> =>
    apiService
      .get<ApiResponse<AnalyticsModel[]>>({
        url: `${BASE_URL}/ai-settings/models`,
        params: { provider, ...(baseUrl ? { baseUrl } : {}) },
        signal,
      })
      .then(unwrap),

  /**
   * Проверка подключения: короткий пробный запрос к провайдеру.
   *
   * Короткий он по числу токенов ответа, а не по времени. Reasoning-модель
   * (Qwen3, R1) и на «ответь одним словом: ok» сначала думает, поэтому общих
   * 60 секунд не хватает — потолок тот же, что у генерации.
   */
  testAiSettings: (signal?: AbortSignal): Promise<AnalyticsAiTestResult> =>
    apiService
      .post<ApiResponse<AnalyticsAiTestResult>>({
        url: `${BASE_URL}/ai-settings/test`,
        signal,
        timeout: LLM_CALL_TIMEOUT_MS,
      })
      .then(unwrap),

  /**
   * Реестр видов виджетов: какие слоты обязательны и когда вид деградирует.
   * Фронт эти правила не дублирует — читает отсюда.
   */
  getWidgetKinds: (signal?: AbortSignal): Promise<AnalyticsWidgetKind[]> =>
    apiService
      .get<ApiResponse<AnalyticsWidgetKind[]>>({
        url: `${BASE_URL}/widget-kinds`,
        signal,
      })
      .then(unwrap),
}
