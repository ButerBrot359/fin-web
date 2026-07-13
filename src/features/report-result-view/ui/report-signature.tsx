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
    <div className="mt-8 flex items-end gap-6">
      <Typography variant="body2" sx={{ color: '#333' }} className="shrink-0">
        {signature.role}
      </Typography>
      <div className="flex flex-1 gap-8">
        {captions.map((caption, ci) => (
          <div key={ci} className="flex flex-1 flex-col items-center">
            <Typography
              variant="body2"
              sx={{ color: '#333' }}
              className="min-h-5 truncate"
            >
              {ci === lastIdx ? (signature.name ?? '') : ''}
            </Typography>
            <div className="w-full border-t border-[#333]" />
            <Typography variant="caption" sx={{ color: '#666', fontSize: 10 }}>
              {caption}
            </Typography>
          </div>
        ))}
      </div>
    </div>
  )
}
