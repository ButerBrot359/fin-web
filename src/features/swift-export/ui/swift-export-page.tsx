import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, MenuItem, TextField, Typography } from '@mui/material'

import { showToast } from '@/shared/ui/toast/show-toast'

import { fetchSwiftExportBlob } from '../api/swift-export-api'
import { useSwiftExportPreview } from '../lib/hooks/use-swift-export-preview'
import { saveSwiftFile } from '../lib/save-swift-file'
import { SwiftExportTable } from './swift-export-table'
import type {
  SwiftEncoding,
  SwiftExportPreview,
  SwiftFormat,
} from '../types/swift-export'

const FORMATS: SwiftFormat[] = [
  'FORMAT_10_2023',
  'FORMAT_01_2024',
  'FORMAT_01_2025',
]

const ENCODINGS: SwiftEncoding[] = ['KZ_1048', 'OEM', 'UTF_8', 'UTF_16']

export const SwiftExportPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const typeCode = params.get('typeCode') ?? ''
  const idParam = params.get('id')
  const id = idParam != null ? Number(idParam) : NaN

  const [format, setFormat] = useState<SwiftFormat>('FORMAT_01_2024')
  const [encoding, setEncoding] = useState<SwiftEncoding>('KZ_1048')

  const preview = useSwiftExportPreview()
  const previewMutate = preview.mutate

  const lastPreviewKey = useRef<string>('')
  useEffect(() => {
    if (!typeCode || Number.isNaN(id)) return
    const key = `${String(id)}:${format}`
    if (lastPreviewKey.current === key) return
    lastPreviewKey.current = key
    previewMutate({ documentIds: [id], format, encoding })
  }, [typeCode, id, format, encoding, previewMutate])

  const downloadFile = async (data: SwiftExportPreview) => {
    try {
      const res = await fetchSwiftExportBlob(typeCode, id, format, encoding)
      const fallbackName =
        data.rows[0]?.fileName ?? `SWIFT_${typeCode}_${String(id)}.txt`
      saveSwiftFile(
        res.data,
        res.headers['content-disposition'] as string | undefined,
        fallbackName
      )
    } catch {
      showToast('error', t('swiftExport.loadFailed'))
    }
  }

  const handleExport = () => {
    if (!typeCode || Number.isNaN(id)) return
    preview.mutate(
      { documentIds: [id], format, encoding },
      {
        onSuccess: (data: SwiftExportPreview) => {
          if (data.hasErrors) {
            showToast('error', t('swiftExport.hasErrorsToast'))
            return
          }
          void downloadFile(data)
        },
        onError: () => {
          showToast('error', t('swiftExport.loadFailed'))
        },
      }
    )
  }

  const rows = preview.data?.rows ?? []
  const allErrors = rows.flatMap((row) => row.errors)

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <Typography variant="h6">{t('swiftExport.title')}</Typography>

      <div className="flex items-center gap-3">
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={preview.isPending || !typeCode || Number.isNaN(id)}
        >
          {t('swiftExport.export')}
        </Button>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          {t('swiftExport.cancel')}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <TextField
          select
          size="small"
          label={t('swiftExport.format')}
          value={format}
          onChange={(event) => {
            setFormat(event.target.value as SwiftFormat)
          }}
          sx={{ minWidth: 280 }}
        >
          {FORMATS.map((value) => (
            <MenuItem key={value} value={value}>
              {t(`swiftExport.formats.${value}`)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label={t('swiftExport.encoding')}
          value={encoding}
          onChange={(event) => {
            setEncoding(event.target.value as SwiftEncoding)
          }}
          sx={{ minWidth: 200 }}
        >
          {ENCODINGS.map((value) => (
            <MenuItem key={value} value={value}>
              {t(`swiftExport.encodings.${value}`)}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <Typography variant="caption" color="text.secondary">
        {t('swiftExport.filesDownloadedByBrowser')}
      </Typography>

      <SwiftExportTable rows={rows} />

      <div>
        <Typography variant="subtitle2">
          {t('swiftExport.errorDetailsTitle')}
        </Typography>
        {allErrors.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('swiftExport.noErrors')}
          </Typography>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {allErrors.map((error, index) => (
              <li key={index}>
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
