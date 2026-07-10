import { useEffect, useMemo, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { DocumentAttribute } from '@/entities/document-type'
import { apiService } from '@/shared/api/api'

import {
  resolveAccountAutofill,
  accountAutofillUrl,
  buildAccountRef,
  type AccountAutofillConfig,
  type AutofillTargets,
  type AutofillTriggerKind,
} from '../utils/account-autofill'

interface UchetParamsData {
  schetUchetaId?: number | string | null
  schetUchetaCode?: string | null
  vidVNAId?: number | string | null
  schetUchetaAmortizatsiiId?: number | string | null
  schetUchetaAmortizatsiiCode?: string | null
  molId?: number | string | null
  pervonachalnayaStoimost?: number | null
  tekushchayaStoimost?: number | null
  srokPoleznogoIspolzovaniya?: number | null
  nachislyatAmortizatsiyu?: boolean | null
}

interface UchetParamsResponse {
  success: boolean
  data: UchetParamsData
}

// RHF по динамическому пути (форма Record<string, unknown>) выводит тип значения
// как undefined — приводим через `never`/`unknown`.
const setCell = (
  form: UseFormReturn<Record<string, unknown>>,
  path: string,
  value: unknown
) => form.setValue(path, value as never, { shouldDirty: true })

const getRefId = (
  form: UseFormReturn<Record<string, unknown>>,
  path: string
): number | string | undefined =>
  (form.getValues(path) as unknown as { id?: number | string } | null)?.id

async function fetchAndApply(
  kind: AutofillTriggerKind,
  triggerCol: string,
  targets: AutofillTargets,
  id: number | string,
  form: UseFormReturn<Record<string, unknown>>,
  rowPath: string,
  suppressVidVna: Set<string>
): Promise<void> {
  let data: UchetParamsData | undefined
  try {
    const res = await apiService.get<UchetParamsResponse>({
      url: accountAutofillUrl(kind, id),
    })
    data = res.data?.data
  } catch {
    return // сеть/сервер — молча, поля не трогаем
  }
  // Пустой data ({}) — счёт не задан: ничего не подставляем.
  if (!data) return
  // Копируем id в локали — сужение переживает промежуточные вызовы функций.
  const { schetUchetaId, vidVNAId, schetUchetaAmortizatsiiId, molId } = data
  if (schetUchetaId == null) return

  // Гвард от гонки: применяем, только если в строке всё ещё выбран тот же элемент.
  if (getRefId(form, `${rowPath}.${triggerCol}`) !== id) return

  const set = (col: string | undefined, value: unknown) => {
    if (col && value != null) setCell(form, `${rowPath}.${col}`, value)
  }

  set(targets.schetUchetaCol, buildAccountRef(schetUchetaId, data.schetUchetaCode))

  // Вид ВНА (только при выборе актива): ставим id. Меняем лишь при реальной смене
  // (иначе watch не сработает и «глушилка» зависнет). Чтобы установка не
  // спровоцировала повторный подбор по виду (он бы перебил счёт из карточки
  // актива) — гасим одно срабатывание vidVna-триггера для этой строки.
  if (
    targets.vidVnaCol &&
    vidVNAId != null &&
    getRefId(form, `${rowPath}.${targets.vidVnaCol}`) !== vidVNAId
  ) {
    suppressVidVna.add(rowPath)
    setCell(form, `${rowPath}.${targets.vidVnaCol}`, buildAccountRef(vidVNAId, ''))
  }

  if (targets.schetAmortizatsiiCol && schetUchetaAmortizatsiiId != null) {
    setCell(
      form,
      `${rowPath}.${targets.schetAmortizatsiiCol}`,
      buildAccountRef(schetUchetaAmortizatsiiId, data.schetUchetaAmortizatsiiCode)
    )
  }
  // МОЛ — ссылка, в ответе только id (без кода): ставим id, показ резолвится позже.
  if (targets.molCol && molId != null) {
    setCell(form, `${rowPath}.${targets.molCol}`, buildAccountRef(molId, ''))
  }
  set(targets.pervonachalnayaStoimostCol, data.pervonachalnayaStoimost)
  set(targets.tekushchayaStoimostCol, data.tekushchayaStoimost)
  set(targets.spiCol, data.srokPoleznogoIspolzovaniya)
  set(targets.nachislyatCol, data.nachislyatAmortizatsiyu)
}

/**
 * Автоподстановка полей строки ТЧ по выбранному элементу (самодостаточные GET):
 *  - Основное средство/НМА → счёт учёта, ВидВНА, стоимости, амортизация, СПИ;
 *  - ВидВНА (ручная смена) → пере-подбор счёта/амортизации/СПИ;
 *  - Номенклатура (ТМЗ) → счёт учёта.
 * На лету, без сохранения; на загрузке (replace) не срабатывает (watch без name).
 */
export function useAccountAutofill(
  form: UseFormReturn<Record<string, unknown>>,
  tableCode: string,
  columns: DocumentAttribute[],
  /** Дата документа (шапка) — для «Даты ввода» строки ОС/НМА. */
  documentDate?: unknown
): void {
  const config: AccountAutofillConfig | null = useMemo(
    () => resolveAccountAutofill(columns),
    [columns]
  )
  // Актуальная дата документа без пересоздания подписки.
  const documentDateRef = useRef(documentDate)
  documentDateRef.current = documentDate
  // Строки, для которых нужно пропустить один подбор по ВидВНА (см. fetchAndApply).
  const suppressVidVna = useRef<Set<string>>(new Set())

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

      const trigger = config.triggers.find((t) => t.triggerCol === colCode)
      if (!trigger) return

      const rowPath = `${tableCode}.${rowIndex}`
      // Программная установка ВидВНА из подбора по активу — не пере-подбираем.
      if (trigger.kind === 'vidVna' && suppressVidVna.current.has(rowPath)) {
        suppressVidVna.current.delete(rowPath)
        return
      }

      const id = getRefId(form, `${rowPath}.${trigger.triggerCol}`)
      if (id == null) return

      // «Дата ввода» строки ОС/НМА = дата документа (не из эндпоинта): ставим при
      // выборе актива. Бэк её не возвращает.
      const docDate = documentDateRef.current
      if (trigger.kind === 'asset' && config.targets.dataVvodaCol && docDate != null) {
        setCell(form, `${rowPath}.${config.targets.dataVvodaCol}`, docDate)
      }

      void fetchAndApply(
        trigger.kind,
        trigger.triggerCol,
        config.targets,
        id,
        form,
        rowPath,
        suppressVidVna.current
      )
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [form, tableCode, config])
}
