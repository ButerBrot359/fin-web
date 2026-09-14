import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'

/**
 * Слияние слоёв патча по (nodeId, prop) — клиентское зеркало серверного
 * mergeLayers: базовый слой снизу, override поверх, пропы одной ноды
 * объединяются, а не заменяются целиком. Нужен редактору ролевого слоя:
 * роль настраивается ПОВЕРХ «для всех», и админ должен видеть в редакторе
 * ровно ту раскладку, которую увидит роль.
 */
export function mergePatchLayers(
  base: ViewSettingsPatchEntry[],
  override: ViewSettingsPatchEntry[]
): ViewSettingsPatchEntry[] {
  if (base.length === 0) return override
  if (override.length === 0) return base
  const merged = new Map<string, ViewSettingsPatchEntry>()
  for (const entry of base) {
    merged.set(entry.nodeId, {
      nodeId: entry.nodeId,
      props: { ...entry.props },
    })
  }
  for (const entry of override) {
    const existing = merged.get(entry.nodeId)
    merged.set(entry.nodeId, {
      nodeId: entry.nodeId,
      props: { ...existing?.props, ...entry.props },
    })
  }
  return [...merged.values()]
}
