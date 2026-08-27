// Фоновая задача бэка (SCRUM-330, handoff §3.2): приезжает целиком в эффекте
// taskStarted и в REST /api/tasks*. Статусы: QUEUED → RUNNING → SUCCEEDED |
// FAILED | CANCELLED; последние три окончательные — опрос прекращается.
export type AsyncTaskStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

export interface AsyncTask {
  id: string
  kind: string
  title: string
  status: AsyncTaskStatus
  targetDomainKind?: string | null
  targetEntryId?: number | null
  targetTypeCode?: string | null
  progressCurrent?: number | null
  // null — объём заранее неизвестен: индикатор неопределённый, НЕ «0 %»
  progressTotal?: number | null
  // Считает бэк; при progressTotal null — тоже null
  progressPercent?: number | null
  progressMessage?: string | null
  // true при RUNNING — отмена запрошена, но ещё не сработала («отменяется»)
  cancelRequested?: boolean
  // Заполнен только при FAILED, текст доменный — можно показывать пользователю
  errorMessage?: string | null
  createdAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}
