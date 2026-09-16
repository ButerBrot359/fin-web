import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import {
  DEFAULT_INTERFACE_SCALE,
  MAX_INTERFACE_SCALE,
  MIN_INTERFACE_SCALE,
  useInterfaceScaleStore,
} from '../model/interface-scale-store'

export const InterfaceScaleSection = () => {
  const { t } = useTranslation()
  const scale = useInterfaceScaleStore((s) => s.scale)
  const zoomIn = useInterfaceScaleStore((s) => s.zoomIn)
  const zoomOut = useInterfaceScaleStore((s) => s.zoomOut)
  const resetScale = useInterfaceScaleStore((s) => s.resetScale)

  return (
    <section className="flex flex-col gap-3">
      <Typography variant="subtitle2" fontWeight={600}>
        {t('interfaceScale.title')}
      </Typography>

      <div className="flex items-center gap-2">
        <Button
          size="small"
          aria-label={t('interfaceScale.decrease')}
          onClick={zoomOut}
          disabled={scale <= MIN_INTERFACE_SCALE}
        >
          −
        </Button>

        <Typography variant="body2" className="min-w-12 text-center">
          {Math.round(scale * 100)}%
        </Typography>

        <Button
          size="small"
          aria-label={t('interfaceScale.increase')}
          onClick={zoomIn}
          disabled={scale >= MAX_INTERFACE_SCALE}
        >
          +
        </Button>

        <Button
          size="small"
          variant="tertiary"
          onClick={resetScale}
          disabled={scale === DEFAULT_INTERFACE_SCALE}
        >
          {t('interfaceScale.reset')}
        </Button>
      </div>
    </section>
  )
}
