import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { apiService } from '@/shared/api/api'
import { Button } from '@/shared/ui/buttons'
import { downloadBlob } from '@/shared/lib/xlsx/write-xlsx'
import { AssistantComparisonResult } from './assistant-comparison-result'

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

export function AssistantStepOutput({
  output,
  onOpenDocument,
}: {
  output: Record<string, unknown>
  onOpenDocument: (typeCode: string, entryId: number) => void
}) {
  const { t } = useTranslation()
  const [visibleResults, setVisibleResults] = useState(20)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)
  const document = object(output.document) ?? object(output.reference)
  const artifact = object(output.artifact)
  const comparison = object(output.comparison)
  const issues = Array.isArray(output.issues)
    ? output.issues.map(object).filter((item) => item !== null)
    : []
  const results = Array.isArray(output.results)
    ? output.results.map(object).filter((item) => item !== null)
    : []
  const artifactId = typeof artifact?.id === 'string' ? artifact.id : null
  const fileName =
    typeof artifact?.fileName === 'string' ? artifact.fileName : null

  const download = async () => {
    if (!artifactId || !fileName || downloading) return
    setDownloading(true)
    setDownloadError(false)
    try {
      const response = await apiService.getFileBlob({
        url: `/api/ai-assistant/artifacts/${encodeURIComponent(artifactId)}`,
      })
      downloadBlob(response.data, fileName)
    } catch {
      setDownloadError(true)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {comparison && <AssistantComparisonResult result={comparison} />}
      {output.complete === false && (
        <Typography variant="caption" className="text-support-01">
          {t('aiAssistant.outputIncomplete')}
        </Typography>
      )}
      {typeof output.valid === 'boolean' && (
        <Typography variant="caption">
          {t(
            output.valid
              ? 'aiAssistant.outputValid'
              : 'aiAssistant.outputInvalid'
          )}
        </Typography>
      )}
      {typeof output.checked === 'number' && (
        <Typography variant="caption">
          {t('aiAssistant.outputChecked', { count: output.checked })}
        </Typography>
      )}
      {typeof output.invalid === 'number' && (
        <Typography variant="caption">
          {t('aiAssistant.outputInvalidCount', { count: output.invalid })}
        </Typography>
      )}
      {issues.map(
        (issue, index) =>
          typeof issue.message === 'string' && (
            <Typography
              key={index}
              variant="caption"
              className="break-words text-support-01"
            >
              {issue.message}
            </Typography>
          )
      )}
      {typeof document?.typeCode === 'string' &&
        (document.domain == null || document.domain === 'DOCUMENT') &&
        typeof document.entryId === 'number' && (
          <Button
            size="small"
            variant="tertiary"
            className="justify-start"
            onClick={() => {
              onOpenDocument(
                document.typeCode as string,
                document.entryId as number
              )
            }}
          >
            {typeof document.presentation === 'string'
              ? document.presentation
              : t('aiAssistant.outputOpenDocument', { id: document.entryId })}
          </Button>
        )}
      {document?.domain === 'DICTIONARY' &&
        typeof document.typeCode === 'string' &&
        typeof document.entryId === 'number' && (
          <Link
            className="text-xs text-interactive-01 underline"
            to={`/dictionaries/${encodeURIComponent(document.typeCode)}/${String(document.entryId)}`}
          >
            {typeof document.presentation === 'string'
              ? document.presentation
              : t('aiAssistant.outputOpenDictionary', { id: document.entryId })}
          </Link>
        )}
      {results.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-ui-05">
            {t('aiAssistant.outputDetails')}
          </summary>
          <div
            className="flex max-h-60 flex-col gap-1 overflow-y-auto"
            onScroll={(event) => {
              const node = event.currentTarget
              if (node.scrollHeight - node.scrollTop - node.clientHeight < 40)
                setVisibleResults((count) =>
                  Math.min(count + 20, results.length)
                )
            }}
          >
            {results.slice(0, visibleResults).map((result, index) => (
              <div key={index} className="border-b border-ui-03 py-1 text-xs">
                {typeof result.entryId === 'number' && (
                  <span>№{result.entryId}: </span>
                )}
                {typeof result.valid === 'boolean' &&
                  t(
                    result.valid
                      ? 'aiAssistant.outputValid'
                      : 'aiAssistant.outputInvalid'
                  )}
                {typeof result.error === 'string' && result.error}
                {Array.isArray(result.issues) &&
                  result.issues.map((issue, index) => {
                    const message = object(issue)?.message
                    return typeof message === 'string' ? (
                      <p key={index} className="break-words">
                        {message}
                      </p>
                    ) : null
                  })}
              </div>
            ))}
          </div>
          {visibleResults < results.length && (
            <Button
              size="small"
              variant="tertiary"
              onClick={() => {
                setVisibleResults((count) => count + 20)
              }}
            >
              {t('aiAssistant.comparisonMore')}
            </Button>
          )}
        </details>
      )}
      {artifactId && fileName && (
        <Button
          size="small"
          variant="tertiary"
          disabled={downloading}
          onClick={() => {
            void download()
          }}
        >
          {t('aiAssistant.artifactDownload', { name: fileName })}
        </Button>
      )}
      {downloadError && (
        <Typography variant="caption" className="text-support-01">
          {t('aiAssistant.artifactError')}
        </Typography>
      )}
    </div>
  )
}
