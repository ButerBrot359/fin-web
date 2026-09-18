import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssistantHistoryScroll } from './use-assistant-history-scroll'

interface HarnessProps {
  ids: string[]
  load: () => void
  active?: boolean
  loading?: boolean
  error?: boolean
  hasMore?: boolean
  pending?: boolean
}

function Harness({
  ids,
  load,
  active = true,
  loading = false,
  error = false,
  hasMore = true,
  pending = false,
}: HarnessProps) {
  const { scrollRef, onScroll, loadOlder } = useAssistantHistoryScroll({
    active,
    messageIds: ids,
    isPending: pending,
    hasOlderMessages: hasMore,
    isLoadingOlder: loading,
    olderMessagesError: error,
    onLoadOlder: load,
  })
  const headerHeight = loading ? 40 : error ? 50 : 0
  return (
    <>
      <div
        ref={scrollRef}
        data-testid="history"
        data-history-height={
          ids.length * 100 + headerHeight + (pending ? 20 : 0)
        }
        onScroll={onScroll}
      >
        {ids.map((id, index) => (
          <div
            key={id}
            data-assistant-message-id={id}
            data-row-top={index * 100 + headerHeight}
          >
            {id}
          </div>
        ))}
      </div>
      <button onClick={loadOlder}>Retry</button>
    </>
  )
}

const latest = Array.from(
  { length: 10 },
  (_, index) => `m${String(index + 10)}`
)
const older = Array.from({ length: 10 }, (_, index) => `m${String(index)}`)

beforeEach(() => {
  const positions = new WeakMap<HTMLElement, number>()
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Number(this.dataset.historyHeight ?? 0)
    }
  )
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
  vi.spyOn(HTMLElement.prototype, 'scrollTop', 'get').mockImplementation(
    function (this: HTMLElement) {
      return positions.get(this) ?? 0
    }
  )
  vi.spyOn(HTMLElement.prototype, 'scrollTop', 'set').mockImplementation(
    function (this: HTMLElement, value: number) {
      positions.set(
        this,
        Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight))
      )
    }
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const top =
        this.dataset.rowTop == null
          ? 0
          : Number(this.dataset.rowTop) - (this.parentElement?.scrollTop ?? 0)
      return {
        top,
        bottom: top + 100,
        height: 100,
        left: 0,
        right: 300,
        width: 300,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function scroll(element: HTMLElement, top: number) {
  element.scrollTop = top
  fireEvent.scroll(element)
}

describe('assistant history scrolling', () => {
  it('opens at the latest messages and loads older messages only near the top', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    expect(element.scrollTop).toBe(700)
    expect(load).not.toHaveBeenCalled()
    scroll(element, 100)
    expect(load).not.toHaveBeenCalled()
    scroll(element, 80)
    scroll(element, 40)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('preserves the visible message and offset when ten earlier messages arrive', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 60)
    view.rerender(<Harness ids={latest} load={load} loading />)
    view.rerender(<Harness ids={[...older, ...latest]} load={load} />)
    expect(element.scrollTop).toBe(1060)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('preserves the anchor when loading and retry headers appear above it', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 60)
    view.rerender(<Harness ids={latest} load={load} loading />)
    expect(element.scrollTop).toBe(100)
    view.rerender(<Harness ids={latest} load={load} error />)
    expect(element.scrollTop).toBe(110)
    expect(
      element
        .querySelector<HTMLElement>('[data-assistant-message-id]')
        ?.getBoundingClientRect().top
    ).toBe(-60)
  })

  it('keeps the user’s latest position if they scroll while an older page loads', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 60)
    view.rerender(<Harness ids={latest} load={load} loading />)
    scroll(element, 350)
    view.rerender(<Harness ids={[...older, ...latest]} load={load} />)
    // Prepend adds 1000px while the 40px loading header disappears.
    expect(element.scrollTop).toBe(1310)
  })

  it('does not jump down on a new answer while the user reads earlier messages', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 300)
    view.rerender(<Harness ids={[...latest, 'new-answer']} load={load} />)
    expect(element.scrollTop).toBe(300)
  })

  it('follows appended messages and the pending indicator when already near the bottom', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 660)
    const ids = [...latest, 'new-answer']
    view.rerender(<Harness ids={ids} load={load} />)
    expect(element.scrollTop).toBe(800)
    view.rerender(<Harness ids={ids} load={load} pending />)
    expect(element.scrollTop).toBe(820)
  })

  it('does not treat simultaneous prepend and append as a request to jump to the bottom', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 50)
    view.rerender(
      <Harness ids={[...older, ...latest, 'new-answer']} load={load} />
    )
    expect(element.scrollTop).toBe(1050)
  })

  it('retries an older-page error explicitly without a scroll retry loop', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 60)
    view.rerender(<Harness ids={latest} load={load} error />)
    scroll(element, 40)
    expect(load).toHaveBeenCalledTimes(1)
    fireEvent.click(view.getByText('Retry'))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not fetch while loading or after the oldest page', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} loading />)
    const element = view.getByTestId('history')
    scroll(element, 40)
    expect(load).not.toHaveBeenCalled()
    view.rerender(<Harness ids={latest} load={load} hasMore={false} />)
    scroll(element, 20)
    expect(load).not.toHaveBeenCalled()
  })

  it('scrolls to the latest history after initial asynchronous loading', () => {
    const load = vi.fn()
    const view = render(<Harness ids={[]} load={load} />)
    view.rerender(<Harness ids={latest} load={load} />)
    expect(view.getByTestId('history').scrollTop).toBe(700)
  })

  it('opens the latest messages of a different context even without an intermediate empty render', () => {
    const load = vi.fn()
    const view = render(<Harness ids={latest} load={load} />)
    const element = view.getByTestId('history')
    scroll(element, 300)
    view.rerender(<Harness ids={older} load={load} />)
    expect(element.scrollTop).toBe(700)
  })
})
