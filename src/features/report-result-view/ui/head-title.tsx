import type { CSSProperties } from 'react'
import { Typography } from '@mui/material'

import { GREEN_1C, HEAD_FS } from '../lib/cell-helpers'

const thTextSx = { color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }

const VERTICAL_HEAD_MAX_PX = 220

const verticalTextStyle: CSSProperties = {
  writingMode: 'vertical-rl',
  transform: 'rotate(180deg)',
  whiteSpace: 'normal',
  maxHeight: VERTICAL_HEAD_MAX_PX,
  margin: '0 auto',
}

export const HeadTitle = ({
  title,
  vertical,
}: {
  title: string
  vertical?: boolean
}) =>
  vertical ? (
    <Typography
      variant="body2"
      component="div"
      data-vertical="true"
      sx={thTextSx}
      style={verticalTextStyle}
    >
      {title}
    </Typography>
  ) : (
    <Typography variant="body2" sx={thTextSx}>
      {title}
    </Typography>
  )
