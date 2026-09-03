import { useWorkspaceTabsStore } from '@/features/workspace-tabs/lib/hooks/use-workspace-tabs-store'
import {
  clearFormInstanceReservation,
  reserveFormInstanceId,
} from '@/features/workspace-tabs/lib/utils/form-instance-id'

import { consumeFreshFormInstance } from './fresh-form-instance'

/**
 * Идентификатор экземпляра формы для маршрута — уходит в `action.formInstanceId` на OPEN.
 *
 * <p>Вкладка уже есть (возврат на неё, реопен после 409, переход новый → записанный) — берём
 * её идентификатор: сервер восстановит черновик именно этой вкладки. Вкладки ещё нет (первый
 * OPEN, она создастся из ответа) — резервируем, и созданная вкладка заберёт тот же.
 *
 * <p>Если переход был помечен как НОВЫЙ экземпляр («Создать», копия, ввод на основании),
 * идентификатор меняется: прежний черновик этой вкладки на сервере становится недостижим, и
 * форма создания открывается пустой — требование владельца.
 *
 * <p>Импорты по прямым путям, а не через бочку {@code @/features/workspace-tabs}: та тянет
 * React-хуки и утилиты, транспортному слою не нужные.
 */
export function currentFormInstanceId(pathname: string): string {
  const store = useWorkspaceTabsStore.getState()
  const tab = store.tabs.find((t) => t.path === pathname)
  if (consumeFreshFormInstance(pathname)) {
    // rotateFormInstanceId возвращает новый идентификатор вкладки (null только если вкладку
    // успели закрыть между поиском и вызовом — тогда резервируем как для новой).
    const rotated = tab ? store.rotateFormInstanceId(tab.id) : null
    if (rotated !== null) return rotated
    // Вкладки нет, но резерв мог остаться от прошлой формы этого маршрута (её вкладку
    // закрыли) — снимаем, иначе новый документ подхватил бы её черновик.
    clearFormInstanceReservation(pathname)
    return reserveFormInstanceId(pathname)
  }
  return tab?.formInstanceId ?? reserveFormInstanceId(pathname)
}
