import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Typography } from '@mui/material'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'

import { usePrintReport } from '../lib/hooks/use-print-report'
import type { RunReportBody } from '../types/report'

interface ReportPdfViewProps {
  code: string
  /** Применённое тело запроса (те же параметры, что и у /run). */
  body: RunReportBody | null
  /**
   * Служебные сообщения пред-валидации (B0) из /run — неблокирующий список над
   * документом (как окно сообщений формы 1С). Пусто ⇒ блок не показывается.
   */
  validationMessages?: string[]
}

/**
 * Отображение отчёта-бланка как PDF (для отчётов, чей /run отдаёт спец-DTO без
 * таблицы — например «Инвентарная карточка ОС»). PDF рендерит сервер
 * (POST /api/reports/{code}/print) — это прямой аналог табличного документа 1С:
 * встроенный просмотрщик даёт печать/сохранение/масштаб/навигацию по страницам.
 * Сверху — неблокирующий список B0-предупреждений (как окно сообщений формы 1С),
 * плюс явная кнопка «Печать».
 *
 * Если движок печати для отчёта не реализован (бэк отвечает 501) — показываем
 * прежний фолбэк «Этот отчёт открывается на отдельном экране».
 */
export const ReportPdfView = ({
  code,
  body,
  validationMessages,
}: ReportPdfViewProps) => {
  const { t } = useTranslation()
  const { blob, isLoading, isError } = usePrintReport(code, body, body != null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Объектный URL создаём из Blob и обязательно освобождаем при смене/анмаунте
  // (иначе утечка памяти вкладки).
  const objectUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob]
  )
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const messages = validationMessages ?? []

  // Печать встроенного PDF: blob-URL тот же origin, поэтому доступен
  // contentWindow.print(); фолбэк — открыть в новой вкладке.
  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow
    if (win) win.print()
    else if (objectUrl) window.open(objectUrl, '_blank')
  }

  // Неблокирующий список B0-предупреждений — показываем всегда, даже если PDF
  // не собрался (напр. все активы отфильтрованы валидацией).
  const messagesBlock = messages.length > 0 && (
    <Alert severity="warning" variant="outlined" className="mb-1">
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {t('reports.validationMessages')}
      </Typography>
      <ul className="list-disc pl-5">
        {messages.map((m, i) => (
          <li key={i}>
            <Typography variant="body2" component="span">
              {m}
            </Typography>
          </li>
        ))}
      </ul>
    </Alert>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {messagesBlock}
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (isError || !objectUrl) {
    return (
      <div className="flex flex-col gap-2">
        {messagesBlock}
        <div className="rounded-md bg-ui-02 px-4 py-6 text-center">
          <Typography variant="body1" className="text-ui-06">
            {t('reports.separateScreen')}
          </Typography>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {messagesBlock}
      <div className="flex justify-end gap-2">
        <Button variant="outlined" size="small" onClick={handlePrint}>
          {t('reports.print')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => window.open(objectUrl, '_blank')}
        >
          {t('reports.openInNewTab')}
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        title={t('reports.pdfTitle')}
        src={objectUrl}
        className="h-[80vh] w-full rounded-md border border-ui-04"
      />
    </div>
  )
}
