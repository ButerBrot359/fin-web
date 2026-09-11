import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type {
  AiAssistantAction,
  AiAssistantAnswer,
} from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'

import { AssistantExecutionStatus } from './assistant-execution-status'
import { AssistantPostingStatus } from './assistant-posting-status'

interface AssistantAnswerCardProps {
  answer: AiAssistantAnswer
  onAction: (index: number) => void
  disabled?: boolean
  executionDisabled?: boolean
  /** Открыть созданный документ. Панель уводит на него сразу, это — способ вернуться. */
  onOpenDocument: (typeCode: string, entryId: number) => void
}

const isCompletedAction = (action: AiAssistantAction): boolean =>
  [
    'DELETE_DOCUMENT',
    'CREATE_DICTIONARY_ENTRY',
    'UPDATE_DICTIONARY_ENTRY',
  ].includes(action.kind)

const SectionLabel = ({ children }: { children: string }) => (
  <Typography
    component="span"
    fontSize={11}
    fontWeight={600}
    letterSpacing="0.08em"
    textTransform="uppercase"
    className="text-ui-05"
  >
    {children}
  </Typography>
)

/**
 * Ответ помощника: вывод, расшифровка, источник, действия.
 *
 * <p>Порядок и разделение блоков — требование приёмки, а не оформление. Бухгалтер должен
 * увидеть сначала вывод, затем расчёт, затем первоисточник; сплошной абзац этот порядок
 * теряет, и проверить ответ по строкам документа становится нельзя.
 *
 * <p>`min-w-0` и `break-words` расставлены не для красоты. Панель узкая, а в ответ попадают
 * длинные неразрывные строки — коды типов, сообщения об ошибках, наименования контрагентов.
 * Без них flex-элемент отказывается сжиматься ниже своего содержимого, и панель уезжает
 * горизонтальной прокруткой: читать приходится, таская ползунок.
 */
export const AssistantAnswerCard = ({
  answer,
  onAction,
  onOpenDocument,
  disabled = false,
  executionDisabled = disabled,
}: AssistantAnswerCardProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-ui-02 p-3">
      <Typography
        variant="body2"
        className="break-words whitespace-pre-wrap text-ui-06"
      >
        {answer.conclusion}
      </Typography>

      {answer.execution && (
        <AssistantExecutionStatus
          execution={answer.execution}
          disabled={executionDisabled}
          onOpenDocument={onOpenDocument}
        />
      )}

      {answer.breakdown.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          <SectionLabel>{t('aiAssistant.breakdown')}</SectionLabel>
          {answer.breakdown.map((row, index) => (
            <div
              key={`${row.label ?? 'row'}-${String(index)}`}
              className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-3 border-b border-ui-03 pb-1 last:border-0"
            >
              <Typography
                variant="body2"
                className="min-w-0 break-words whitespace-pre-wrap text-ui-06 [overflow-wrap:anywhere]"
              >
                {row.label}
              </Typography>
              <Typography
                variant="body2"
                className="min-w-0 break-words whitespace-pre-wrap tabular-nums text-ui-06 [overflow-wrap:anywhere]"
              >
                {row.value}
              </Typography>
            </div>
          ))}
        </div>
      )}

      {answer.sources.length > 0 && (
        <div className="flex min-w-0 flex-col gap-0.5">
          <SectionLabel>{t('aiAssistant.sources')}</SectionLabel>
          {answer.sources.map((source) => (
            <Typography
              key={source}
              variant="caption"
              className="break-words text-ui-05"
            >
              {source}
            </Typography>
          ))}
        </div>
      )}

      {/* Нехватка данных отделена от вывода намеренно: концепция требует прямо
          сообщать, чего не хватает, и не подавать предположение как факт. */}
      {answer.missing && (
        <div className="rounded-md bg-ui-01 px-3 py-2">
          <SectionLabel>{t('aiAssistant.missing')}</SectionLabel>
          <Typography variant="body2" className="break-words text-ui-06">
            {answer.missing}
          </Typography>
        </div>
      )}

      {answer.created.length > 0 && (
        <div className="flex min-w-0 flex-col items-start gap-0.5 rounded-r-md border-l-4 border-support-01 bg-ui-01 px-3 py-2">
          <SectionLabel>{t('aiAssistant.affectedTitle')}</SectionLabel>
          {answer.created.map((document) => (
            <div key={document.entryId} className="flex min-w-0 flex-col">
              <Button
                size="small"
                variant="tertiary"
                className="min-w-0 justify-start px-0 text-left whitespace-normal"
                onClick={() => {
                  onOpenDocument(document.typeCode, document.entryId)
                }}
              >
                {document.operationStatus === 'ACCEPTED'
                  ? document.presentation
                  : `${document.presentation} — ${t(document.stateFresh === false ? 'aiAssistant.documentStateUnknown' : document.posted ? 'aiAssistant.documentPosted' : 'aiAssistant.createdUnposted')}`}
              </Button>
              {document.operationStatus === 'ACCEPTED' && (
                <AssistantPostingStatus document={document} />
              )}
              {document.warnings.map((warning, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  className="break-words text-support-01"
                >
                  {warning}
                </Typography>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Неудавшееся действие — сообщение, а не кнопка. Рисовать отказ кнопкой
          значит предлагать нажать на текст ошибки. */}
      {answer.actions
        .filter((action) => action.error)
        .map((action, index) => (
          <div
            key={`error-${String(index)}`}
            className="min-w-0 rounded-md bg-ui-01 px-3 py-2 outline outline-support-01"
          >
            <Typography variant="body2" className="break-words text-ui-06">
              {action.error}
            </Typography>
          </div>
        ))}

      {answer.actions
        .filter((action) => !action.error && isCompletedAction(action))
        .map((action, index) => (
          <Typography
            key={`completed-${String(index)}`}
            variant="body2"
            className="break-words text-ui-06"
          >
            {action.preview ?? action.label}
          </Typography>
        ))}

      {answer.actions.some(
        (action) => !action.error && !isCompletedAction(action)
      ) && (
        <div className="flex min-w-0 flex-wrap gap-2">
          {answer.actions.map((action, index) =>
            action.error || isCompletedAction(action) ? null : (
              <Button
                key={`${action.kind}-${String(index)}`}
                size="small"
                disabled={disabled}
                variant={
                  action.kind === 'CREATE_DOCUMENT' ? 'primary' : 'tertiary'
                }
                className="h-auto max-w-full text-left whitespace-normal [overflow-wrap:anywhere]"
                onClick={() => {
                  onAction(index)
                }}
              >
                {action.label ?? t('aiAssistant.actionFallback')}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  )
}
