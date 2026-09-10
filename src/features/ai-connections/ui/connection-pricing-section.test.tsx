import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/app/config/i18n'
import { ConnectionPricingSection } from './connection-pricing-section'
import {
  pricingDraft,
  pricingRequest,
  validPricing,
} from '../lib/pricing/connection-pricing'

afterEach(cleanup)

describe('connection pricing editor', () => {
  it('preserves zero, existing rates and blank fields on edit; rejects negative prices', () => {
    const submit = vi.fn()
    function Form() {
      const [draft, setDraft] = useState(() =>
        pricingDraft({
          inputPerMillion: 0,
          outputPerMillion: 15,
          cacheReadPerMillion: null,
          cacheWritePerMillion: null,
          cacheWrite5mPerMillion: 3.75,
          cacheWrite1hPerMillion: null,
        })
      )
      return (
        <>
          <ConnectionPricingSection
            draft={draft}
            onChange={setDraft}
            provider="ANTHROPIC"
            model="claude"
            cacheEnabled={false}
            onCacheChange={vi.fn()}
          />
          <button
            disabled={!validPricing(draft)}
            onClick={() => {
              submit(pricingRequest(draft))
            }}
          >
            Submit
          </button>
        </>
      )
    }
    render(<Form />)
    expect(screen.getByLabelText<HTMLInputElement>('Обычный вход').value).toBe(
      '0'
    )
    fireEvent.change(screen.getByLabelText('Чтение кеша'), {
      target: { value: '-0.5' },
    })
    expect(screen.getByText<HTMLButtonElement>('Submit').disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Чтение кеша'), {
      target: { value: '0,3' },
    })
    fireEvent.change(screen.getByLabelText('Выход'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Submit'))
    expect(submit).toHaveBeenCalledWith({
      inputPerMillion: 0,
      outputPerMillion: null,
      cacheReadPerMillion: 0.3,
      cacheWritePerMillion: null,
      cacheWrite5mPerMillion: 3.75,
      cacheWrite1hPerMillion: null,
    })
  })
  it('offers opt-in only for Claude rather than a fake OpenAI cache switch', () => {
    const props = {
      draft: pricingDraft(),
      onChange: vi.fn(),
      cacheEnabled: false,
      onCacheChange: vi.fn(),
    }
    const { rerender } = render(
      <ConnectionPricingSection {...props} provider="OPENAI" model="gpt" />
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
    rerender(
      <ConnectionPricingSection
        {...props}
        provider="OPENROUTER"
        model="anthropic/claude"
      />
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(props.onCacheChange).toHaveBeenCalledWith(true)
  })
  it('sends all-null object to clear tariffs instead of preserve-on-null request', () => {
    expect(Object.values(pricingRequest(pricingDraft()))).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })
})
