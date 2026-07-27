import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Typography,
} from '@mui/material'

import { showToast } from '@/shared/ui/toast/show-toast'

import { useTreasuryExportPreview } from '../lib/hooks/use-treasury-export-preview'
import { treasuryExportDownloadUrl } from '../lib/download-url'
import { TreasuryExportTable } from './treasury-export-table'
import type {
  TreasuryExportItem,
  TreasuryExportPreviewResponse,
} from '../types/treasury-export'

/**
 * Страница «Выгрузка документов в казначейство» (SCRUM-265 v6+v7).
 * Легаси-контур: SDUI-эффект navigate наводит на роут /treasury-export.
 * MVP — один документ (?typeCode&id); скачивание — нативная GET-навигация.
 */
export const TreasuryExportPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const typeCode = params.get('typeCode') ?? ''
  const idParam = params.get('id')
  const id = idParam != null ? Number(idParam) : NaN

  const preview = useTreasuryExportPreview()
  const previewMutate = preview.mutate

  // Авто-preview при маунте и при смене документа (typeCode/id) без
  // перемонтирования страницы — роут /treasury-export кейзится по pathname
  // без search, поэтому переход между документами меняет только params.
  // Дедуп по ключу защищает от повторного прогона (в т.ч. StrictMode).
  const lastPreviewKey = useRef<string>('')
  useEffect(() => {
    if (!typeCode || Number.isNaN(id)) return
    const key = `${typeCode}:${String(id)}`
    if (lastPreviewKey.current === key) return
    lastPreviewKey.current = key
    previewMutate([{ typeCode, id }])
  }, [typeCode, id, previewMutate])

  const item: TreasuryExportItem = { typeCode, id }

  const handleExport = () => {
    if (!typeCode || Number.isNaN(id)) return
    // Валидация перед скачиванием (v7 §2.1): при ошибках не навигируем.
    preview.mutate([item], {
      onSuccess: (data: TreasuryExportPreviewResponse) => {
        if (data.hasErrors) {
          showToast('error', t('treasuryExport.hasErrorsToast'))
          return
        }
        window.location.assign(treasuryExportDownloadUrl(typeCode, id))
      },
      onError: () => {
        showToast('error', t('treasuryExport.loadFailed'))
      },
    })
  }

  const rows = preview.data?.rows ?? []
  const allErrors = rows.flatMap((r) => r.errors)

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <Typography variant="h6">{t('treasuryExport.title')}</Typography>

      <div className="flex items-center gap-3">
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={preview.isPending || !typeCode || Number.isNaN(id)}
        >
          {t('treasuryExport.export')}
        </Button>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          {t('treasuryExport.cancel')}
        </Button>
      </div>

      <Tooltip title={t('treasuryExport.mxFieldsSoon')}>
        <span style={{ width: 'fit-content' }}>
          <FormControlLabel
            control={<Checkbox size="small" disabled />}
            label={t('treasuryExport.includeMxFields')}
          />
        </span>
      </Tooltip>

      <Typography variant="caption" color="text.secondary">
        {t('treasuryExport.filesDownloadedByBrowser')}
      </Typography>

      <TreasuryExportTable rows={rows} />

      <div>
        <Typography variant="subtitle2">
          {t('treasuryExport.errorDetailsTitle')}
        </Typography>
        {allErrors.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('treasuryExport.noErrors')}
          </Typography>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {allErrors.map((err, i) => (
              <li key={i}>
                <Typography variant="body2" color="error">
                  {err}
                </Typography>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
