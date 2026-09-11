import { beforeEach, describe, expect, it } from 'vitest'
import {
  readAssistantSession,
  writeAssistantSession,
} from './session-persistence'
beforeEach(() => {
  sessionStorage.clear()
})
describe('assistant session identity storage', () => {
  it('stores only identifiers, isolates accounts and preserves explicit new chat', () => {
    writeAssistantSession('host:1', {
      conversationId: 42,
      explicitNew: false,
      pending: { requestId: 'uuid', startedAt: 123 },
    })
    expect(readAssistantSession('host:2')).toBeNull()
    expect(readAssistantSession('host:1')?.pending?.requestId).toBe('uuid')
    writeAssistantSession('host:1', { conversationId: null, explicitNew: true })
    expect(readAssistantSession('host:1')).toEqual({
      conversationId: null,
      explicitNew: true,
    })
    expect(readAssistantSession(null)).toBeNull()
  })
  it('rejects corrupt and invalid identifiers', () => {
    sessionStorage.setItem('ai-assistant-session-v1:host:1', '{broken')
    expect(readAssistantSession('host:1')).toBeNull()
    sessionStorage.setItem(
      'ai-assistant-session-v1:host:1',
      '{"conversationId":-1,"explicitNew":false}'
    )
    expect(readAssistantSession('host:1')).toBeNull()
  })
})
