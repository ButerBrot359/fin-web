import { useTranslation } from 'react-i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import { useSduiDispatch } from '../../../../lib/dispatch'
import { useGenerationCommandQueue } from '../../../../lib/hooks/use-generation-command-queue'
import {
  parseReportSheetPayload,
  RASSHIFROVKA_COMMAND,
  type EditCellCommand,
  type ReportCellAddress,
  type ReportSheetPayload,
} from './report-sheet-contract'
import { buildEditCell, normalizeReportInput } from './report-sheet-logic'

export interface ReportSheetActions {
  /**
   * Правка ячейки. false (сразу или из промиса после ответа сервера) —
   * ввод отклонён; успешный ответ уже заменил payload целиком (SET_VALUE).
   */
  editCell: (
    address: ReportCellAddress,
    raw: string
  ) => boolean | Promise<boolean>
  /** Расшифровка показателя — ответ сервера открывает модальный диалог. */
  openRasshifrovka: (address: ReportCellAddress) => void
  busy: boolean
}

/**
 * Команды сетки report-sheet/v1. Правки идут общей generation-очередью (та же,
 * что у матрицы Табеля): EVENT change на сам узел, baseGeneration — из
 * payload в момент отправки. Отказы сервер показывает штатным notify.
 */
export function useReportSheetActions(
  nodeId: string,
  binding: string
): ReportSheetActions {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()
  const queue = useGenerationCommandQueue<ReportSheetPayload, EditCellCommand>({
    sourceNodeId: nodeId,
    binding,
    parse: parseReportSheetPayload,
  })

  const editCell = (address: ReportCellAddress, raw: string) => {
    const input = normalizeReportInput(raw)
    if (!input.ok) {
      showToast('warning', t('sdui.reportSheet.invalidNumber'))
      return false
    }
    return queue.enqueue((payload) =>
      buildEditCell(payload, address, input.value)
    )
  }

  const openRasshifrovka = ({ pokazatelId, indeks }: ReportCellAddress) => {
    void dispatch({
      type: 'COMMAND',
      command: RASSHIFROVKA_COMMAND,
      value: { pokazatelId, indeks },
    })
  }

  return { editCell, openRasshifrovka, busy: queue.busy }
}
