import type { FC } from 'react'
import { Typography } from '@mui/material'

import { cssVar, palette } from '@/shared/design/tokens'
import type { ReportFormSignatureDto } from '@/pages/reports/report-list/types/report'

import { ReportSignature } from './report-signature'

/** «М.П.» — место печати; в бланке стоит после первой подписи колонки. */
const MESTO_PECHATI = 'М.П.'

const Kolonka = ({ signatures }: { signatures: ReportFormSignatureDto[] }) => (
  <div className="flex flex-col">
    {signatures.map((signature, i) => (
      <div key={i}>
        <ReportSignature signature={signature} />
        {signature.stampAfter && (
          <Typography
            variant="body2"
            sx={{ color: cssVar(palette.pendingText1) }}
            className="mt-3"
          >
            {MESTO_PECHATI}
          </Typography>
        )}
      </div>
    ))}
  </div>
)

/**
 * Подписи бланка. У приказных форм их две колонки: слева территориальное подразделение
 * казначейства, справа учреждение (макет Форма4_20, строки 34–41). Подписи без `side`
 * идут одной колонкой — прежнее поведение гос-бланка М-44 не меняется.
 */
export const ReportSignatures: FC<{ signatures: ReportFormSignatureDto[] }> = ({
  signatures,
}) => {
  if (signatures.length === 0) return null
  const sleva = signatures.filter((s) => s.side !== 'RIGHT')
  const sprava = signatures.filter((s) => s.side === 'RIGHT')
  if (sprava.length === 0) {
    return <Kolonka signatures={sleva} />
  }
  return (
    <div className="flex flex-wrap gap-x-16">
      <Kolonka signatures={sleva} />
      <Kolonka signatures={sprava} />
    </div>
  )
}
