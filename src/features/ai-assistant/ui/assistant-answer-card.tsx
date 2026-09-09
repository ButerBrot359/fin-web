import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AiAssistantAnswer } from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'

interface AssistantAnswerCardProps {
  answer: AiAssistantAnswer
  onAction: (index: number) => void
}

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
 * Порядок и разделение блоков — требование приёмки, а не оформление. Бухгалтер
 * должен увидеть сначала вывод, затем расчёт, затем первоисточник; сплошной
 * абзац этот порядок теряет, и проверить ответ по строкам документа становится
 * нельзя.
 *
 * Суммы идут табличными цифрами: в расшифровке они стоят столбцом, и без
 * `tabular-nums` разряды не совпадают.
 */
export const AssistantAnswerCard = ({
  answer,
  onAction,
}: AssistantAnswerCardProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-ui-01 p-3">
      <Typography variant="body2" className="text-ui-06">
        {answer.conclusion}
      </Typography>

      {answer.breakdown.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>{t('aiAssistant.breakdown')}</SectionLabel>
          <div className="flex flex-col gap-1">
            {answer.breakdown.map((row, index) => (
              <div
                key={`${row.label ?? 'row'}-${String(index)}`}
                className="flex items-baseline justify-between gap-3 border-b border-ui-03 pb-1 last:border-0"
              >
                <Typography variant="body2" className="text-ui-06">
                  {row.label}
                </Typography>
                <Typography
                  variant="body2"
                  className="shrink-0 tabular-nums text-ui-06"
                >
                  {row.value}
                </Typography>
              </div>
            ))}
          </div>
        </div>
      )}

      {answer.sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>{t('aiAssistant.sources')}</SectionLabel>
          {answer.sources.map((source) => (
            <Typography key={source} variant="caption" className="text-ui-05">
              {source}
            </Typography>
          ))}
        </div>
      )}

      {/* Нехватка данных отделена от вывода намеренно: концепция требует прямо
          сообщать, чего не хватает, и не подавать предположение как факт. */}
      {answer.missing && (
        <div className="rounded-md bg-ui-02 px-3 py-2">
          <Typography variant="caption" className="text-ui-05">
            {t('aiAssistant.missing')}
          </Typography>
          <Typography variant="body2" className="text-ui-06">
            {answer.missing}
          </Typography>
        </div>
      )}

      {/* Созданное помощником — отдельным блоком и с пометкой «не проведён».
          Бухгалтер должен увидеть факт появления документа в базе сразу, а не
          обнаружить его потом в списке: помощник создаёт без отдельного вопроса. */}
      {answer.created.length > 0 && (
        <div className="flex flex-col gap-1 rounded-r-lg border-l-4 border-support-01 bg-ui-04 px-3 py-2">
          <Typography
            variant="body2"
            fontWeight={700}
            className="text-support-01"
          >
            {t('aiAssistant.createdTitle')}
          </Typography>
          {answer.created.map((document) => (
            <Typography
              key={document.entryId}
              variant="body2"
              className="text-ui-06"
            >
              {`${document.presentation} — ${t('aiAssistant.createdUnposted')}`}
            </Typography>
          ))}
        </div>
      )}

      {answer.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {answer.actions.map((action, index) => (
            <Button
              key={`${action.kind}-${String(index)}`}
              size="small"
              variant={
                action.kind === 'CREATE_DOCUMENT' ? 'primary' : 'tertiary'
              }
              onClick={() => {
                onAction(index)
              }}
            >
              {action.label ?? t('aiAssistant.actionFallback')}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
