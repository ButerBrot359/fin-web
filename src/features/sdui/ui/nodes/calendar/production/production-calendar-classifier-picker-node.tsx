import { useEffect, useRef, useState, type FC } from 'react'
import { Alert, Button, CircularProgress, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { SearchInput } from '@/shared/ui/inputs'

import type { NodeProps } from '../../../../types/view'
import { usePanelStore } from '../../../../lib/stores/panel-store'
import {
  classifierPickerViewSchema,
  productionCalendarClassifierApi,
  type ClassifierApplyResult,
  type ClassifierPickerView,
} from '../../../../api/production-calendar-classifier'
import { ClassifierPickerTable } from './classifier-picker-table'

// Содержимое server-opened modal (§13.14): узел САМ является панелью,
// открытой openDialog-эффектом — отдельного dialog-компонента нет. CAS-draft:
// каждый select/unselect шлёт текущую draftVersion и принимает новый snapshot.
export const ProductionCalendarClassifierPickerNode: FC<NodeProps> = ({
  node,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const formSessionId = node.props?.formSessionId as string | undefined
  const initialParse = classifierPickerViewSchema.safeParse(
    node.props?.pickerView
  )
  const wireValid = initialParse.success && typeof formSessionId === 'string'

  const [view, setView] = useState<ClassifierPickerView | null>(
    initialParse.success ? initialParse.data : null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<ClassifierApplyResult | null>(
    null
  )
  const [search, setSearch] = useState('')

  // Terminal: после отправки apply draft claimed/applied — cancel ему слать
  // нельзя (§8.5), даже best-effort при unmount.
  const terminalRef = useRef(false)

  // Актуальное состояние для cleanup-замыкания (unmount-cancel).
  const liveRef = useRef({ view, formSessionId })
  liveRef.current = { view, formSessionId }

  // §8.5: best-effort /cancel при РЕАЛЬНОМ unmount открытого draft. StrictMode
  // rehearsal не должен отменять draft: cleanup ставит microtask, а тот шлёт
  // cancel только если generation не изменилась (реальный unmount, не повторный
  // mount той же ноды).
  const generationRef = useRef(0)
  useEffect(() => {
    generationRef.current += 1
    const generation = generationRef.current
    return () => {
      queueMicrotask(() => {
        if (generationRef.current !== generation) return
        if (terminalRef.current) return
        const { view: v, formSessionId: fsid } = liveRef.current
        if (v?.status !== 'OPEN' || !fsid) return
        void productionCalendarClassifierApi
          .cancel({
            draftId: v.draftId,
            formSessionId: fsid,
            expectedDraftVersion: v.draftVersion,
          })
          .catch(() => undefined)
      })
    }
  }, [])

  const closePanel = () => {
    usePanelStore.getState().remove(node.id)
  }

  const runMutation = async (fn: () => Promise<ClassifierPickerView>) => {
    setBusy(true)
    setError(null)
    try {
      setView(await fn())
    } catch {
      setError(t('sdui.productionCalendar.classifier.requestError'))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (calendarCode: string, selected: boolean) => {
    if (!view || !formSessionId) return
    const req = {
      draftId: view.draftId,
      formSessionId,
      expectedDraftVersion: view.draftVersion,
      calendarCode,
    }
    void runMutation(() =>
      selected
        ? productionCalendarClassifierApi.select(req)
        : productionCalendarClassifierApi.unselect(req)
    )
  }

  const apply = async () => {
    if (!view || !formSessionId || view.selectedCodes.length === 0) return
    setBusy(true)
    setError(null)
    terminalRef.current = true
    try {
      const result = await productionCalendarClassifierApi.apply({
        draftId: view.draftId,
        formSessionId,
        expectedDraftVersion: view.draftVersion,
        requestId: crypto.randomUUID(),
      })
      setApplyResult(result)
      // Список справочника обновляется при любом terminal-результате (§8.5).
      void queryClient.invalidateQueries({ queryKey: ['sdui-list'] })
      if (result.status === 'SUCCEEDED') closePanel()
    } catch {
      setError(t('sdui.productionCalendar.classifier.requestError'))
    } finally {
      setBusy(false)
    }
  }

  const cancelOrClose = async () => {
    // Terminal draft (apply уже отправлялся) ложный cancel не получает.
    if (!terminalRef.current && view?.status === 'OPEN' && formSessionId) {
      terminalRef.current = true
      await productionCalendarClassifierApi
        .cancel({
          draftId: view.draftId,
          formSessionId,
          expectedDraftVersion: view.draftVersion,
        })
        .catch(() => undefined)
    }
    closePanel()
  }

  if (!wireValid || !view) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <Alert severity="error">
          {t('sdui.productionCalendar.classifier.invalidWire')}
        </Alert>
        <div className="flex justify-end">
          <Button onClick={closePanel}>
            {t('sdui.productionCalendar.close')}
          </Button>
        </div>
      </div>
    )
  }

  const terminalFailed =
    applyResult != null && applyResult.status !== 'SUCCEEDED'
  const mutationsDisabled = busy || terminalRef.current || terminalFailed
  const query = search.trim().toLowerCase()
  const filtered = query
    ? view.catalog.calendars.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query)
      )
    : view.catalog.calendars

  return (
    <div className="p-4 flex flex-col gap-3 min-w-[480px]">
      <Typography variant="body2" color="text.secondary">
        {t('sdui.productionCalendar.classifier.version', {
          version: view.catalog.classifierVersion,
        })}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {terminalFailed && (
        <Alert severity="error">
          {t('sdui.productionCalendar.classifier.applyFailed', {
            status: applyResult.status,
          })}
          <ul className="list-disc pl-5">
            {applyResult.stages
              .filter((s) => s.status === 'FAILED')
              .map((s) => (
                <li key={s.sequenceNumber}>
                  {[s.stageKind, s.calendarCode, s.errorMessage]
                    .filter(Boolean)
                    .join(' · ')}
                </li>
              ))}
          </ul>
        </Alert>
      )}
      <SearchInput
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
        }}
        placeholder={t('sdui.productionCalendar.classifier.search')}
      />
      <div className="max-h-96 overflow-y-auto">
        <ClassifierPickerTable
          calendars={filtered}
          selectedCodes={view.selectedCodes}
          disabled={mutationsDisabled}
          onToggle={toggle}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {busy && <CircularProgress size={18} />}
        <Button
          disabled={busy}
          onClick={() => {
            void cancelOrClose()
          }}
        >
          {terminalRef.current || terminalFailed
            ? t('sdui.productionCalendar.close')
            : t('sdui.productionCalendar.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={mutationsDisabled || view.selectedCodes.length === 0}
          onClick={() => {
            void apply()
          }}
        >
          {t('sdui.productionCalendar.classifier.apply')}
        </Button>
      </div>
    </div>
  )
}
