import type { SelectOption } from '@/shared/types/select-option'

export interface ReferencePickerRequest {
  mode: 'list' | 'create' | 'edit'
  domain: string
  typeCode: string
  entryId?: number | string
  searchParams?: Record<string, string>
  onSelect: (option: SelectOption | null) => void
}

type Gateway = (req: ReferencePickerRequest) => void

let gateway: Gateway | null = null

// SDUI не знает про реализацию пикера справочников (легаси dict-sidebar).
// Хост-приложение регистрирует реализацию на своём уровне (app/).
export function setReferencePickerGateway(g: Gateway | null): void {
  gateway = g
}

export function openReferencePicker(req: ReferencePickerRequest): void {
  gateway?.(req)
}
