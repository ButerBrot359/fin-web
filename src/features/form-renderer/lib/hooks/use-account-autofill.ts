import { useEffect, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { DocumentAttribute } from '@/entities/document-type'
import { apiService } from '@/shared/api/api'

import {
  resolveAccountAutofill,
  accountAutofillUrl,
  buildAccountRef,
  type AccountAutofillConfig,
} from '../utils/account-autofill'

interface UchetParamsResponse {
  success: boolean
  data: {
    schetUchetaId?: number | string | null
    schetUchetaCode?: string | null
    schetUchetaAmortizatsiiId?: number | string | null
    schetUchetaAmortizatsiiCode?: string | null
    srokPoleznogoIspolzovaniya?: number | null
    nachislyatAmortizatsiyu?: boolean | null
  }
}

// RHF по динамическому пути на форме Record<string, unknown> выводит тип значения
// как undefined — приводим значение через `never`.
const setCell = (
  form: UseFormReturn<Record<string, unknown>>,
  path: string,
  value: unknown
) => form.setValue(path, value as never, { shouldDirty: true })

async function fetchAndApply(
  cfg: AccountAutofillConfig,
  id: number | string,
  form: UseFormReturn<Record<string, unknown>>,
  rowPath: string
): Promise<void> {
  let data: UchetParamsResponse['data'] | undefined
  try {
    const res = await apiService.get<UchetParamsResponse>({
      url: accountAutofillUrl(cfg, id),
    })
    data = res.data?.data
  } catch {
    return // сеть/сервер — молча, поле не трогаем
  }
  // Пустой data ({}) — счёт для элемента не задан: ничего не подставляем.
  if (!data) return
  const schetUchetaId = data.schetUchetaId
  if (schetUchetaId == null) return

  // Гвард от гонки: применяем только если в строке всё ещё выбран тот же элемент.
  const current = form.getValues(`${rowPath}.${cfg.triggerCol}`) as unknown as {
    id?: number | string
  } | null
  if (current?.id !== id) return

  setCell(
    form,
    `${rowPath}.${cfg.schetUchetaCol}`,
    buildAccountRef(schetUchetaId, data.schetUchetaCode)
  )

  const amortId = data.schetUchetaAmortizatsiiId
  if (cfg.schetAmortizatsiiCol && amortId != null) {
    setCell(
      form,
      `${rowPath}.${cfg.schetAmortizatsiiCol}`,
      buildAccountRef(amortId, data.schetUchetaAmortizatsiiCode)
    )
  }
  if (cfg.spiCol && data.srokPoleznogoIspolzovaniya != null) {
    setCell(form, `${rowPath}.${cfg.spiCol}`, data.srokPoleznogoIspolzovaniya)
  }
  if (cfg.nachislyatCol && data.nachislyatAmortizatsiyu != null) {
    setCell(form, `${rowPath}.${cfg.nachislyatCol}`, data.nachislyatAmortizatsiyu)
  }
}

/**
 * Автоподстановка «Счёт учёта» (и для ОС/НМА — амортизации/СПИ/признака) в строке
 * ТЧ при выборе Номенклатуры/ВидВНА: GET по id элемента → значения в ячейки.
 * На лету, без сохранения; на загрузке (replace) не срабатывает (watch без name).
 */
export function useAccountAutofill(
  form: UseFormReturn<Record<string, unknown>>,
  tableCode: string,
  columns: DocumentAttribute[]
): void {
  const config = useMemo(() => resolveAccountAutofill(columns), [columns])

  useEffect(() => {
    if (!config) return
    const prefix = `${tableCode}.`
    const subscription = form.watch((_values, { name }) => {
      if (!name || !name.startsWith(prefix)) return
      const rest = name.slice(prefix.length)
      const dot = rest.indexOf('.')
      if (dot < 0) return
      const rowIndex = rest.slice(0, dot)
      const colCode = rest.slice(dot + 1)
      if (colCode !== config.triggerCol) return

      const rowPath = `${tableCode}.${rowIndex}`
      const selected = form.getValues(
        `${rowPath}.${config.triggerCol}`
      ) as unknown as { id?: number | string } | null
      const id = selected?.id
      if (id == null) return

      void fetchAndApply(config, id, form, rowPath)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [form, tableCode, config])
}
