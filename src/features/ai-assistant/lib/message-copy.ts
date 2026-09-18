import type { AssistantChatMessage } from './hooks/use-assistant-session'

/** Plain text from the visible saved answer; never copies hidden tool payloads. */
export function assistantMessageCopyText(
  message: AssistantChatMessage
): string {
  if (message.error) return message.error
  const answer = message.answer
  if (!answer) return message.text
  return [
    answer.conclusion,
    ...answer.breakdown.map((row) => `${row.label ?? ''}: ${row.value ?? ''}`),
    ...answer.sources,
    answer.missing,
    ...answer.created.flatMap((document) => [
      document.presentation,
      ...document.warnings,
    ]),
    ...answer.actions.map(
      (action) =>
        action.error ||
        ([
          'DELETE_DOCUMENT',
          'CREATE_DICTIONARY_ENTRY',
          'UPDATE_DICTIONARY_ENTRY',
        ].includes(action.kind)
          ? action.preview || action.label
          : action.label)
    ),
  ]
    .filter((part) => part != null && part !== '')
    .join('\n')
}

export function failedQuestionFor(
  messages: readonly AssistantChatMessage[],
  index: number
): string | null {
  if (index < 0 || index >= messages.length) return null
  const message = messages[index]
  const previous = index > 0 ? messages[index - 1] : undefined
  return message.role === 'ASSISTANT' &&
    message.error &&
    previous?.role === 'USER'
    ? previous.text
    : null
}
