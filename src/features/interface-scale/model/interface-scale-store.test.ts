import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_INTERFACE_SCALE,
  MAX_INTERFACE_SCALE,
  MIN_INTERFACE_SCALE,
  useInterfaceScaleStore,
} from './interface-scale-store'

describe('useInterfaceScaleStore', () => {
  beforeEach(() => {
    useInterfaceScaleStore.getState().resetScale()
  })

  it('увеличивает и уменьшает масштаб шагом 10%', () => {
    useInterfaceScaleStore.getState().zoomIn()
    expect(useInterfaceScaleStore.getState().scale).toBe(1.1)

    useInterfaceScaleStore.getState().zoomOut()
    expect(useInterfaceScaleStore.getState().scale).toBe(DEFAULT_INTERFACE_SCALE)
  })

  it('не выходит за границы диапазона', () => {
    useInterfaceScaleStore.getState().setScale(10)
    expect(useInterfaceScaleStore.getState().scale).toBe(MAX_INTERFACE_SCALE)

    useInterfaceScaleStore.getState().setScale(0.1)
    expect(useInterfaceScaleStore.getState().scale).toBe(MIN_INTERFACE_SCALE)

    useInterfaceScaleStore.getState().zoomOut()
    expect(useInterfaceScaleStore.getState().scale).toBe(MIN_INTERFACE_SCALE)
  })

  it('сбрасывает масштаб к 100%', () => {
    useInterfaceScaleStore.getState().setScale(1.5)
    useInterfaceScaleStore.getState().resetScale()
    expect(useInterfaceScaleStore.getState().scale).toBe(DEFAULT_INTERFACE_SCALE)
  })
})
