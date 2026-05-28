import { useTranslation } from 'react-i18next'
import { Tooltip, Typography } from '@mui/material'

import {
  useAccountSubkontoKinds,
  type AccountPlanSubkontoKindDto,
  type CompositeTarget,
} from '@/entities/account-plan'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'

import { BooleanMark } from '../../account-plan-list/ui/boolean-mark'
import {
  describeValueKind,
  pickLocalizedName,
} from '../lib/utils/subkonto-value-kind'

interface SubkontoTabProps {
  /** id счёта; null означает «новая/копируемая запись» — таблица пуста. */
  accountId: number | null
}

/**
 * Read-only вкладка «Виды субконто» — данные приходят из отдельного
 * эндпоинта `/entries/{id}/subkonto-kinds`. Редактирование вынесено в
 * другой flow и не доступно из карточки счёта.
 */
export const SubkontoTab = ({ accountId }: SubkontoTabProps) => {
  const { t } = useTranslation()
  const { kinds, isLoading } = useAccountSubkontoKinds(accountId)

  if (!accountId) {
    return (
      <Typography variant="body2" className="text-ui-05">
        {t('accountPlan.subconto.notAvailableForNew')}
      </Typography>
    )
  }

  if (isLoading) {
    return <ShimmerBlock className="h-24" />
  }

  if (kinds.length === 0) {
    return (
      <Typography variant="body2" className="text-ui-05">
        {t('accountPlan.subconto.empty')}
      </Typography>
    )
  }

  return (
    <table className="w-full border-collapse">
      <thead className="bg-ui-02">
        <tr>
          <th className="w-10 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.position')}
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.type')}
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.valueKind')}
          </th>
          <th className="w-32 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.onlyTurnovers')}
          </th>
          <th className="w-24 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.summable')}
          </th>
          <th className="w-24 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.currency')}
          </th>
          <th className="w-28 px-2 py-2 text-left text-xs font-medium uppercase text-ui-05">
            {t('accountPlan.subconto.quantitative')}
          </th>
        </tr>
      </thead>
      <tbody>
        {kinds.map((row) => (
          <SubkontoRow key={row.id} row={row} />
        ))}
      </tbody>
    </table>
  )
}

interface SubkontoRowProps {
  row: AccountPlanSubkontoKindDto
}

const SubkontoRow = ({ row }: SubkontoRowProps) => {
  const { i18n } = useTranslation()
  return (
    <tr className="border-b border-ui-04/40">
      <td className="px-2 py-2 text-ui-05">{row.position}</td>
      <td className="px-2 py-2 text-ui-06">
        {pickLocalizedName(row, i18n.language)}
      </td>
      <td className="px-2 py-2">
        <ValueKindCell row={row} />
      </td>
      <td className="px-2 py-2">
        <BooleanMark value={row.isOnlyTurnover} />
      </td>
      <td className="px-2 py-2">
        <BooleanMark value={row.isSummary} />
      </td>
      <td className="px-2 py-2">
        <BooleanMark value={row.isCurrency} />
      </td>
      <td className="px-2 py-2">
        <BooleanMark value={row.isQuantity} />
      </td>
    </tr>
  )
}

interface ValueKindCellProps {
  row: AccountPlanSubkontoKindDto
}

const ValueKindCell = ({ row }: ValueKindCellProps) => {
  const { t } = useTranslation()
  const desc = describeValueKind(row)

  const badge = (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${desc.badgeClass}`}
    >
      {t(desc.labelKey)}
    </span>
  )

  if (desc.compositeTargets && desc.compositeTargets.length > 0) {
    return (
      <div className="flex items-center gap-2">
        {badge}
        <Tooltip
          arrow
          placement="top"
          title={<CompositeTooltip targets={desc.compositeTargets} />}
        >
          <span className="cursor-help text-sm text-ui-06 underline decoration-dotted">
            {desc.summary}
          </span>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {badge}
      {desc.summary && (
        <span className="text-sm text-ui-06">{desc.summary}</span>
      )}
    </div>
  )
}

interface CompositeTooltipProps {
  targets: CompositeTarget[]
}

const CompositeTooltip = ({ targets }: CompositeTooltipProps) => (
  <div className="flex flex-col gap-0.5">
    {targets.map((t) => (
      <span key={`${String(t.position)}-${t.targetCode}`}>
        {t.targetNameRu} ({t.targetKind})
      </span>
    ))}
  </div>
)
