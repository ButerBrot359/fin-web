import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import { MicroLabel } from '@/shared/ui/micro-label'

interface LlmPayloadBlockProps {
  label: string
  text?: string | null
}

/**
 * Раздел панели «Что ушло в ИИ»: микро-лейбл, копирование и сам текст.
 *
 * Текст не обрезаем и не переформатируем — человек должен своими глазами
 * прочитать ровно то, что ушло в модель. Моноширинный шрифт здесь не украшение:
 * это инструкция и JSON, их читают построчно.
 */
export const LlmPayloadBlock = ({ label, text }: LlmPayloadBlockProps) => {
  const { t } = useTranslation()
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) return
    const timer = window.setTimeout(() => {
      setIsCopied(false)
    }, 1500)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isCopied])

  if (!text) return null

  const handleCopy = () => {
    void navigator.clipboard.writeText(text)
    setIsCopied(true)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>{label}</MicroLabel>
        <Button size="small" variant="tertiary" onClick={handleCopy}>
          {isCopied ? t('analytics.assistant.copied') : t('actions.copy')}
        </Button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg bg-ui-02 p-3 font-mono text-xs leading-[1.6] whitespace-pre-wrap text-ui-06">
        {text}
      </pre>
    </div>
  )
}
