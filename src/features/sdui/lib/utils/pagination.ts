import type { ViewNode } from '../../types/view'
import type {
  PaginationConfig,
  VirtualizationOverride,
} from '../../types/pagination'

/**
 * Читает props.pagination ноды (SCRUM-368). Fail-safe: кривой конфиг или
 * PAGED без source.url → warn + null (нода живёт по INLINE-пути, как без
 * поля) — деградация без падения, малформленный контракт виден в консоли.
 */
export function readPagination(node: ViewNode): PaginationConfig | null {
  const raw = node.props?.pagination
  if (raw == null) return null
  if (typeof raw !== 'object') {
    console.warn('[sdui] malformed props.pagination', node.id, raw)
    return null
  }
  const config = raw as Record<string, unknown>
  const mode = config.mode
  if (mode !== 'INLINE' && mode !== 'PAGED') {
    console.warn('[sdui] unknown pagination.mode', node.id, mode)
    return null
  }
  const source = config.source as PaginationConfig['source']
  if (mode === 'PAGED' && typeof source?.url !== 'string') {
    console.warn('[sdui] PAGED pagination without source.url', node.id)
    return null
  }
  return raw as PaginationConfig
}

/** Нода в страничном режиме: PAGED с валидным source. */
export function isPagedNode(node: ViewNode): boolean {
  return readPagination(node)?.mode === 'PAGED'
}

/** props.virtualization: AUTO/ON/OFF; всё прочее (и отсутствие) — AUTO. */
export function readVirtualization(node: ViewNode): VirtualizationOverride {
  const raw = node.props?.virtualization
  return raw === 'ON' || raw === 'OFF' ? raw : 'AUTO'
}
