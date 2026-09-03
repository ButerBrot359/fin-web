import {
  formInstanceIdFor,
  rotateFormInstanceId,
} from '@/features/workspace-tabs/lib/utils/form-instance-id'

import { consumeFreshFormInstance } from './fresh-form-instance'

/**
 * Идентификатор экземпляра формы для маршрута — уходит в `action.formInstanceId` на КАЖДОМ
 * OPEN (фронт-спека 03.09.2026 §5.1).
 *
 * <p>Возврат на свою вкладку, реопен после конфликта ревизий и переход «новый → записанный»
 * дают ТОТ ЖЕ идентификатор: вкладка та же, значит и её черновик тот же. Переход, начинающий
 * новый документ («Создать», копия, ввод на основании), помечен интентом — идентификатор
 * меняется, и форма создания открывается пустой.
 *
 * <p>Импорт по прямому пути, а не через бочку {@code @/features/workspace-tabs}: та тянет
 * React-хуки и утилиты, транспортному слою не нужные.
 */
export function currentFormInstanceId(pathname: string): string {
  if (consumeFreshFormInstance(pathname)) {
    return rotateFormInstanceId(pathname)
  }
  return formInstanceIdFor(pathname)
}
