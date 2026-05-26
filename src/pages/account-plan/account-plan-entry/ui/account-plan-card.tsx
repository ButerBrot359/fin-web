import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  AccountPlanEntry,
  AccountType,
  SubcontoLink,
  SubcontoType,
} from '@/entities/account-plan'
import { Button } from '@/shared/ui/buttons'
import { cn } from '@/shared/lib/utils/cn'

import { SubcontoTable } from './subconto-table'

export type AccountPlanCardValue = Pick<
  AccountPlanEntry,
  | 'code'
  | 'nameRu'
  | 'nameKz'
  | 'accountType'
  | 'isCurrency'
  | 'isQuantitative'
  | 'isOffBalance'
  | 'parentId'
  | 'subcontoList'
>

interface AccountPlanCardProps {
  value: AccountPlanCardValue
  subcontoTypes: SubcontoType[]
  isReadOnly: boolean
  onChange: (next: AccountPlanCardValue) => void
}

/**
 * Карточка плана счетов — две вкладки («Основное», «Субконто»).
 * Контролируемый компонент: получает `value` + `onChange`. В режиме
 * isReadOnly поля недоступны для редактирования.
 *
 * Когда нужна динамическая раскладка из JSON-схемы — оборачивающий
 * AccountPlanEntryPage подмешивает FormRenderer для вкладки «Основное».
 * Здесь — фолбэчная статика, повторяющая ту же раскладку.
 */
export const AccountPlanCard = ({
  value,
  subcontoTypes,
  isReadOnly,
  onChange,
}: AccountPlanCardProps) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'general' | 'subconto'>('general')

  const patch = (p: Partial<AccountPlanCardValue>) => {
    onChange({ ...value, ...p })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-ui-03">
        <TabButton
          isActive={activeTab === 'general'}
          label={t('accountPlan.tabs.general')}
          onClick={() => {
            setActiveTab('general')
          }}
        />
        <TabButton
          isActive={activeTab === 'subconto'}
          label={t('accountPlan.tabs.subconto')}
          onClick={() => {
            setActiveTab('subconto')
          }}
        />
      </div>

      <div className="pt-2">
        {activeTab === 'general' ? (
          <GeneralTab value={value} isReadOnly={isReadOnly} patch={patch} />
        ) : (
          <SubcontoTable
            value={value.subcontoList}
            subcontoTypes={subcontoTypes}
            isReadOnly={isReadOnly}
            onChange={(subcontoList: SubcontoLink[]) => {
              patch({ subcontoList })
            }}
          />
        )}
      </div>
    </div>
  )
}

interface TabButtonProps {
  isActive: boolean
  label: string
  onClick: () => void
}

const TabButton = ({ isActive, label, onClick }: TabButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-t-md px-4 py-2 text-[14px] font-medium transition-colors',
      isActive
        ? 'bg-ui-06 text-ui-01'
        : 'bg-ui-01 text-ui-05 hover:bg-ui-07'
    )}
  >
    {label}
  </button>
)

interface GeneralTabProps {
  value: AccountPlanCardValue
  isReadOnly: boolean
  patch: (p: Partial<AccountPlanCardValue>) => void
}

const GeneralTab = ({ value, isReadOnly, patch }: GeneralTabProps) => {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <LabeledInput
          label={t('accountPlan.field.code')}
          value={value.code}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ code: v })
          }}
        />
        <LabeledSelect
          label={t('accountPlan.field.accountType')}
          value={value.accountType}
          isReadOnly={isReadOnly}
          options={[
            { value: 'ACTIVE', label: t('accountPlan.accountType.active') },
            { value: 'PASSIVE', label: t('accountPlan.accountType.passive') },
            {
              value: 'ACTIVE_PASSIVE',
              label: t('accountPlan.accountType.activePassive'),
            },
          ]}
          onChange={(v) => {
            patch({ accountType: v as AccountType })
          }}
        />
      </div>
      <LabeledInput
        label={t('accountPlan.field.nameRu')}
        value={value.nameRu}
        isReadOnly={isReadOnly}
        onChange={(v) => {
          patch({ nameRu: v })
        }}
      />
      <LabeledInput
        label={t('accountPlan.field.nameKz')}
        value={value.nameKz}
        isReadOnly={isReadOnly}
        onChange={(v) => {
          patch({ nameKz: v })
        }}
      />
      <div className="flex gap-6">
        <LabeledCheckbox
          label={t('accountPlan.field.isCurrency')}
          value={value.isCurrency}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ isCurrency: v })
          }}
        />
        <LabeledCheckbox
          label={t('accountPlan.field.isQuantitative')}
          value={value.isQuantitative}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ isQuantitative: v })
          }}
        />
        <LabeledCheckbox
          label={t('accountPlan.field.isOffBalance')}
          value={value.isOffBalance}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ isOffBalance: v })
          }}
        />
      </div>
      <LabeledInput
        label={t('accountPlan.field.parent')}
        value={value.parentId != null ? String(value.parentId) : ''}
        isReadOnly={isReadOnly}
        onChange={(v) => {
          patch({ parentId: v ? Number(v) : null })
        }}
      />
    </div>
  )
}

interface LabeledInputProps {
  label: string
  value: string
  isReadOnly: boolean
  onChange: (v: string) => void
}

const LabeledInput = ({
  label,
  value,
  isReadOnly,
  onChange,
}: LabeledInputProps) => (
  <label className="flex flex-1 flex-col gap-1 text-sm">
    <span className="text-ui-05">{label}</span>
    <input
      className="rounded-md border border-ui-03 bg-ui-01 px-3 py-1.5 disabled:bg-ui-02"
      value={value}
      disabled={isReadOnly}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  </label>
)

interface LabeledSelectProps {
  label: string
  value: string
  isReadOnly: boolean
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}

const LabeledSelect = ({
  label,
  value,
  isReadOnly,
  options,
  onChange,
}: LabeledSelectProps) => (
  <label className="flex flex-1 flex-col gap-1 text-sm">
    <span className="text-ui-05">{label}</span>
    <select
      className="rounded-md border border-ui-03 bg-ui-01 px-3 py-1.5 disabled:bg-ui-02"
      value={value}
      disabled={isReadOnly}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
)

interface LabeledCheckboxProps {
  label: string
  value: boolean
  isReadOnly: boolean
  onChange: (v: boolean) => void
}

const LabeledCheckbox = ({
  label,
  value,
  isReadOnly,
  onChange,
}: LabeledCheckboxProps) => (
  <label className="flex items-center gap-2 text-sm text-ui-06">
    <input
      type="checkbox"
      checked={value}
      disabled={isReadOnly}
      onChange={(e) => {
        onChange(e.target.checked)
      }}
    />
    {label}
  </label>
)

export interface AccountPlanCardActionsProps {
  isNew: boolean
  isReadOnly: boolean
  isSaving: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

/** Кнопки управления режимом — рендерятся в тулбаре карточки. */
export const AccountPlanCardActions = ({
  isNew,
  isReadOnly,
  isSaving,
  onEdit,
  onSave,
  onCancel,
}: AccountPlanCardActionsProps) => {
  const { t } = useTranslation()
  if (isReadOnly && !isNew) {
    return (
      <Button variant="primary" onClick={onEdit}>
        {t('accountPlan.actions.edit')}
      </Button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" disabled={isSaving} onClick={onSave}>
        {t('accountPlan.actions.save')}
      </Button>
      {!isNew && (
        <Button variant="secondary" disabled={isSaving} onClick={onCancel}>
          {t('accountPlan.actions.cancel')}
        </Button>
      )}
    </div>
  )
}
