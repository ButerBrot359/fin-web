/** Сохранённый серверный результат выполнения, а не обещание модели. */
export type AiExecutionStatus =
  | 'NEEDS_INPUT'
  | 'RUNNING'
  | 'WAITING_TASK'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'INDETERMINATE'
export type AiStepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_TASK'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'INDETERMINATE'

export interface AiExecutionStep {
  id: string
  tool: string
  status: AiStepStatus
  output?: Record<string, unknown> | null
  error?: { code?: string; message: string } | null
  blockedBy?: string[]
}

export interface AiAssistantExecution {
  id: string
  requestId: string
  status: AiExecutionStatus
  steps: AiExecutionStep[]
}
