import { Typography } from '@mui/material'

import type { ReportHeaderBlockDto } from '@/pages/reports/report-list/types/report'

/** Один блок бланка: строки (как есть) [+ линия] [+ мелкая подпись под блоком]. */
const HeaderBlock = ({ block }: { block: ReportHeaderBlockDto }) => (
  <div className="flex max-w-[48%] flex-col items-center">
    <div className={block.underline ? 'w-full border-b border-[#333] pb-0.5' : undefined}>
      {block.lines.map((line, i) => (
        <Typography
          key={i}
          variant="caption"
          // whiteSpace: pre — двойные пробелы эталона байт-в-байт.
          sx={{ color: '#333', fontSize: 11, whiteSpace: 'pre', display: 'block', textAlign: 'center' }}
        >
          {line}
        </Typography>
      ))}
    </div>
    {block.caption && (
      <Typography
        variant="caption"
        sx={{ color: '#666', fontSize: 9, textAlign: 'center', mt: 0.25 }}
      >
        {block.caption}
      </Typography>
    )}
  </div>
)

/**
 * Зона гос-бланка над титулом (М-44): LEFT-блоки прижаты влево, RIGHT — вправо
 * (space-between; на узком экране RIGHT переносится над LEFT, строки не ломая).
 */
export const ReportHeaderBlocks = ({
  blocks,
}: {
  blocks: ReportHeaderBlockDto[]
}) => {
  const left = blocks.filter((b) => b.side === 'LEFT')
  const right = blocks.filter((b) => b.side === 'RIGHT')
  return (
    // Ширину зоны ограничиваем (≈ ширина бланка-документа), чтобы правый блок
    // реквизитов встал в центр-право, как в 1С, а не к краю широкого контейнера.
    <div className="mb-3 flex max-w-[900px] flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        {left.map((b, i) => (
          <HeaderBlock key={i} block={b} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {right.map((b, i) => (
          <HeaderBlock key={i} block={b} />
        ))}
      </div>
    </div>
  )
}
