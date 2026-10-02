export interface TabLeaveFlush {
  hasPending: () => boolean
  flush: () => Promise<void>
}

let current: TabLeaveFlush | null = null

export function setTabLeaveFlush(flush: TabLeaveFlush | null): () => void {
  current = flush
  return () => {
    if (current === flush) current = null
  }
}

export function runAfterTabLeaveFlush(action: () => void): void {
  const flush = current
  if (!flush?.hasPending()) {
    action()
    return
  }
  void flush.flush().then(action, action)
}
