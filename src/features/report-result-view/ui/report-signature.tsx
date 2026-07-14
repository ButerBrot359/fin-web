import { Typography } from '@mui/material'

import type { ReportFormSignatureDto } from '@/pages/reports/report-list/types/report'

/**
 * Подвал-подписи после таблицы (по 1С-скрину): слева роль («Главный бухгалтер»),
 * правее — подчёркнутые графы по `captions` (должность | подпись | расшифровка
 * подписи). ФИО (`name`) выводится над ПОСЛЕДНЕЙ линией (расшифровка подписи);
 * пустые значения = пустые линии (эталон печатается так).
 */
export const ReportSignature = ({
  signature,
}: {
  signature: ReportFormSignatureDto
}) => {
  const captions = signature.captions ?? ['подпись']
  const lastIdx = captions.length - 1
  return (
    // Как в 1С: слева роль, правее — компактные графы фикс-ширины (линии НЕ
    // растягиваются на всю таблицу). Подпись-графа (должность/подпись/расшифровка)
    // стоит НАД линией; ФИО — под линией (у графы «расшифровка подписи»).
    <div className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-3">
      <Typography
        variant="body2"
        sx={{ color: '#333' }}
        className="shrink-0 pt-4"
      >
        {signature.role}
      </Typography>
      {captions.map((caption, ci) => (
        <div key={ci} className="flex w-52 flex-col items-center">
          <Typography
            variant="caption"
            sx={{ color: '#666', fontSize: 10 }}
            className="min-h-4"
          >
            {caption}
          </Typography>
          <div className="w-full border-t border-[#333]" />
          <Typography
            variant="body2"
            sx={{ color: '#333' }}
            className="min-h-5 truncate"
          >
            {ci === lastIdx ? (signature.name ?? '') : ''}
          </Typography>
        </div>
      ))}
    </div>
  )
}
