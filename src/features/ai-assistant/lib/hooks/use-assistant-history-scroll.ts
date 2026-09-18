import { useCallback, useLayoutEffect, useRef } from 'react'

interface HistoryScrollOptions {
  active: boolean
  messageIds: string[]
  isPending: boolean
  hasOlderMessages: boolean
  isLoadingOlder: boolean
  olderMessagesError: boolean
  onLoadOlder?: () => void
}

interface Viewport {
  top: number
  height: number
  nearBottom: boolean
  anchorId?: string
  anchorOffset?: number
}

const SCROLL_THRESHOLD = 80
const MESSAGE_SELECTOR = '[data-assistant-message-id]'

function captureViewport(element: HTMLDivElement): Viewport {
  const top = element.getBoundingClientRect().top
  const anchor = [
    ...element.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR),
  ].find((message) => message.getBoundingClientRect().bottom > top)
  return {
    top: element.scrollTop,
    height: element.scrollHeight,
    nearBottom:
      element.scrollHeight - element.clientHeight - element.scrollTop <=
      SCROLL_THRESHOLD,
    anchorId: anchor?.dataset.assistantMessageId,
    anchorOffset: anchor ? anchor.getBoundingClientRect().top - top : undefined,
  }
}

/** Keeps the reader on the same message when an older page is prepended. */
export function useAssistantHistoryScroll({
  active,
  messageIds,
  isPending,
  hasOlderMessages,
  isLoadingOlder,
  olderMessagesError,
  onLoadOlder,
}: HistoryScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const viewport = useRef<Viewport | null>(null)
  const previous = useRef({
    active: false,
    ids: [] as string[],
    loading: false,
    error: false,
  })
  const loadRequested = useRef(false)

  const loadOlder = useCallback(() => {
    if (
      !active ||
      !hasOlderMessages ||
      isLoadingOlder ||
      loadRequested.current ||
      !onLoadOlder
    )
      return
    if (scrollRef.current) viewport.current = captureViewport(scrollRef.current)
    loadRequested.current = true
    onLoadOlder()
  }, [active, hasOlderMessages, isLoadingOlder, onLoadOlder])

  const onScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    viewport.current = captureViewport(element)
    if (element.scrollTop <= SCROLL_THRESHOLD && !olderMessagesError)
      loadOlder()
  }, [loadOlder, olderMessagesError])

  useLayoutEffect(() => {
    const before = previous.current
    const firstBefore = before.ids.length > 0 ? before.ids[0] : null
    const prepended =
      firstBefore != null &&
      messageIds.length > 0 &&
      messageIds[0] !== firstBefore &&
      messageIds.includes(firstBefore)
    const replaced =
      before.ids.length > 0 &&
      messageIds.length > 0 &&
      !messageIds.some((id) => before.ids.includes(id))
    if (
      (before.loading && !isLoadingOlder) ||
      olderMessagesError ||
      !hasOlderMessages ||
      prepended
    ) {
      loadRequested.current = false
    }
    previous.current = {
      active,
      ids: messageIds,
      loading: isLoadingOlder,
      error: olderMessagesError,
    }
    const element = scrollRef.current
    if (!active || !element) return

    const saved = viewport.current
    if (!before.active || before.ids.length === 0 || replaced) {
      element.scrollTop = element.scrollHeight
    } else if (
      saved &&
      (prepended ||
        before.loading !== isLoadingOlder ||
        before.error !== olderMessagesError)
    ) {
      const anchor = [
        ...element.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR),
      ].find((message) => message.dataset.assistantMessageId === saved.anchorId)
      if (anchor && saved.anchorOffset != null) {
        element.scrollTop +=
          anchor.getBoundingClientRect().top -
          element.getBoundingClientRect().top -
          saved.anchorOffset
      } else {
        element.scrollTop = saved.top + element.scrollHeight - saved.height
      }
    } else if (saved?.nearBottom) {
      element.scrollTop = element.scrollHeight
    }
    viewport.current = captureViewport(element)
  }, [
    active,
    messageIds,
    isPending,
    isLoadingOlder,
    olderMessagesError,
    hasOlderMessages,
  ])

  return { scrollRef, onScroll, loadOlder }
}
