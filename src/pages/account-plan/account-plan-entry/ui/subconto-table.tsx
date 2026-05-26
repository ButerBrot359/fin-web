import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { SubcontoLink, SubcontoType } from '@/entities/account-plan'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { BooleanMark } from '../../account-plan-list/ui/boolean-mark'

const MAX_ROWS = 3

interface SubcontoTableProps {
  value: SubcontoLink[]
  subcontoTypes: SubcontoType[]
  isReadOnly: boolean
  onChange: (value: SubcontoLink[]) => void
}

const EMPTY_ROW: SubcontoLink = {
  subcontoTypeId: null,
  onlyTurnovers: false,
  summable: true,
  quantitative: false,
  currency: false,
}

/**
 * Карточная табличная часть «Виды субконто» — до 3 строк.
 * В режиме просмотра отрисованы значки/имена; в режиме редактирования
 * каждая ячейка — select / checkbox.
 */
export const SubcontoTable = ({
  value,
  subcontoTypes,
  isReadOnly,
  onChange,
}: SubcontoTableProps) => {
  const { t, i18n } = useTranslation()

  // Доводим количество строк до MAX_ROWS для единообразия отображения.
  const rows: SubcontoLink[] = Array.from({ length: MAX_ROWS }, (_, i) =>
    value[i] ?? { ...EMPTY_ROW }
  )

  const updateRow = (index: number, patch: Partial<SubcontoLink>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    // Отбрасываем хвостовые пустые строки, чтобы не отправлять мусор на бэк.
    const trimmed = trimTrailingEmpty(next)
    onChange(trimmed)
  }

  const findTypeName = (id: number | null): string => {
    if (id == null) return ''
    const type = subcontoTypes.find((tp) => tp.id === id)
    return type ? getLocalizedName(type, i18n.language) : ''
  }

  return (
    <table className="w-full border-collapse">
      <thead className="bg-ui-02">
        <tr>
          <th className="w-10 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            #
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.type')}
          </th>
          <th className="w-32 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.onlyTurnovers')}
          </th>
          <th className="w-24 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.summable')}
          </th>
          <th className="w-28 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.quantitative')}
          </th>
          <th className="w-24 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.currency')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-ui-04/40">
            <td className="px-2 py-2 text-ui-05">{index + 1}</td>
            <td className="px-2 py-2">
              {isReadOnly ? (
                <Typography variant="body2" className="text-ui-06">
                  {findTypeName(row.subcontoTypeId)}
                </Typography>
              ) : (
                <select
                  className="w-full rounded-md border border-ui-03 bg-ui-01 px-2 py-1 text-sm"
                  value={row.subcontoTypeId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    updateRow(index, {
                      subcontoTypeId: v ? Number(v) : null,
                    })
                  }}
                >
                  <option value="">—</option>
                  {subcontoTypes.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {getLocalizedName(tp, i18n.language)}
                    </option>
                  ))}
                </select>
              )}
            </td>
            <FlagCell
              value={row.onlyTurnovers}
              isReadOnly={isReadOnly}
              onChange={(v) => {
                updateRow(index, { onlyTurnovers: v })
              }}
            />
            <FlagCell
              value={row.summable}
              isReadOnly={isReadOnly}
              onChange={(v) => {
                updateRow(index, { summable: v })
              }}
            />
            <FlagCell
              value={row.quantitative}
              isReadOnly={isReadOnly}
              onChange={(v) => {
                updateRow(index, { quantitative: v })
              }}
            />
            <FlagCell
              value={row.currency}
              isReadOnly={isReadOnly}
              onChange={(v) => {
                updateRow(index, { currency: v })
              }}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface FlagCellProps {
  value: boolean
  isReadOnly: boolean
  onChange: (v: boolean) => void
}

const FlagCell = ({ value, isReadOnly, onChange }: FlagCellProps) => (
  <td className="px-2 py-2">
    {isReadOnly ? (
      <BooleanMark value={value} />
    ) : (
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => {
          onChange(e.target.checked)
        }}
      />
    )}
  </td>
)

const trimTrailingEmpty = (rows: SubcontoLink[]): SubcontoLink[] => {
  const out = [...rows]
  while (out.length > 0) {
    const last = out[out.length - 1]
    const empty =
      last.subcontoTypeId == null &&
      !last.onlyTurnovers &&
      !last.quantitative &&
      !last.currency
    if (!empty) break
    out.pop()
  }
  return out
}
