import { Typography } from '@mui/material'

import type { ReportFormSignatureDto } from '@/pages/reports/report-list/types/report'

/**
 * Подвал-подписи после таблицы (гос-бланк М-44, 1 в 1 с 1С): компактные графы
 * фикс-ширины (линии НЕ растягиваются на всю таблицу). Как в 1С:
 * НАД линией первой графы — роль («Главный бухгалтер»), над последней — ФИО (`name`);
 * подписи-подписи (должность | подпись | расшифровка подписи) стоят ПОД линиями.
 * Пустые значения = пустые линии (эталон печатается так).
 */
export const ReportSignature = ({
  signature,
}: {
  signature: ReportFormSignatureDto
}) => {
  const captions = signature.captions ?? ['подпись']
  const lastIdx = captions.length - 1
  return (
    <div className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-3">
      {captions.map((caption, ci) => (
        <div key={ci} className="flex w-52 flex-col items-center">
          {/* Над линией: в 1-й графе — роль («Главный бухгалтер»), в последней — ФИО. */}
          <Typography
            variant="body2"
            sx={{ color: '#333' }}
            className="min-h-5 truncate"
          >
            {ci === 0
              ? signature.role
              : ci === lastIdx
                ? (signature.name ?? '')
                : ''}
          </Typography>
          <div className="w-full border-t border-[#333]" />
          {/* Под линией: подпись-графа (должность | подпись | расшифровка подписи). */}
          <Typography
            variant="caption"
            sx={{ color: '#666', fontSize: 10 }}
            className="min-h-4"
          >
            {caption}
          </Typography>
        </div>
      ))}
    </div>
  )
}
