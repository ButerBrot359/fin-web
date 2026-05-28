import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountType } from '@/entities/account-plan'
import { Button } from '@/shared/ui/buttons'
import { cn } from '@/shared/lib/utils/cn'

import { AccountTypeBadge } from '../../account-plan-list/ui/account-type-badge'
import { SubkontoTab } from './subkonto-tab'

/**
 * Карточное value — флаги и идентифицирующие поля, которыми управляет
 * пользователь. Имена совпадают с DTO бэка, чтобы payload-маппинг был 1-в-1.
 */
export interface AccountPlanCardValue {
  code: string
  nameRu: string
  /** Может быть null — UI показывает плейсхолдер «не задано» в просмотре. */
  nameKz: string | null
  accountType: AccountType
  isCurrency: boolean
  isQuantity: boolean
  isOffBalance: boolean
  isGroup: boolean
  parentId: number | null
  parentName: string | null
}

interface AccountPlanCardProps {
  value: AccountPlanCardValue
  /** id счёта, для которого грузим виды субконто. null — для новой/копии. */
  accountId: number | null
  isReadOnly: boolean
  onChange: (next: AccountPlanCardValue) => void
}

/**
 * Карточка счёта — две вкладки («Основное», «Виды субконто»).
 * Контролируемый компонент. В view-режиме accountType отрисован бейджем,
 * в edit — селектом. Бэк не позволяет менять subkonto через эту форму:
 * правка субконто — это отдельный flow.
 */
export const AccountPlanCard = ({
  value,
  accountId,
  isReadOnly,
  onChange,
}: AccountPlanCardProps) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'general' | 'subkonto'>('general')

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
          isActive={activeTab === 'subkonto'}
          label={t('accountPlan.tabs.subconto')}
          onClick={() => {
            setActiveTab('subkonto')
          }}
        />
      </div>

      <div className="pt-2">
        {activeTab === 'general' ? (
          <GeneralTab value={value} isReadOnly={isReadOnly} patch={patch} />
        ) : (
          <SubkontoTab accountId={accountId} />
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
        <LabeledReadonly
          label={t('accountPlan.field.parent')}
          value={value.parentName ?? t('accountPlan.notSet')}
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
        value={value.nameKz ?? ''}
        placeholder={t('accountPlan.notSet')}
        isReadOnly={isReadOnly}
        onChange={(v) => {
          patch({ nameKz: v || null })
        }}
      />
      <div className="flex items-center gap-3">
        <span className="text-sm text-ui-05">
          {t('accountPlan.field.accountType')}:
        </span>
        {isReadOnly ? (
          <AccountTypeBadge type={value.accountType} />
        ) : (
          <select
            className="rounded-md border border-ui-03 bg-ui-01 px-3 py-1.5 text-sm"
            value={value.accountType}
            onChange={(e) => {
              patch({ accountType: e.target.value as AccountType })
            }}
          >
            <option value="A">{t('accountPlan.accountType.active')}</option>
            <option value="P">{t('accountPlan.accountType.passive')}</option>
            <option value="AP">
              {t('accountPlan.accountType.activePassive')}
            </option>
          </select>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <LabeledCheckbox
          label={t('accountPlan.field.isOffBalance')}
          value={value.isOffBalance}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ isOffBalance: v })
          }}
        />
        <LabeledCheckbox
          label={t('accountPlan.field.isGroup')}
          value={value.isGroup}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ isGroup: v })
          }}
        />
        <LabeledCheckbox
          label={t('accountPlan.field.isCurrency')}
          value={value.isCurrency}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ isCurrency: v })
          }}
        />
        <LabeledCheckbox
          label={t('accountPlan.field.isQuantity')}
          value={value.isQuantity}
          isReadOnly={isReadOnly}
          onChange={(v) => {
            patch({ isQuantity: v })
          }}
        />
      </div>
    </div>
  )
}

interface LabeledInputProps {
  label: string
  value: string
  isReadOnly: boolean
  placeholder?: string
  onChange: (v: string) => void
}

const LabeledInput = ({
  label,
  value,
  isReadOnly,
  placeholder,
  onChange,
}: LabeledInputProps) => (
  <label className="flex flex-1 flex-col gap-1 text-sm">
    <span className="text-ui-05">{label}</span>
    <input
      className="rounded-md border border-ui-03 bg-ui-01 px-3 py-1.5 disabled:bg-ui-02"
      value={value}
      placeholder={placeholder}
      disabled={isReadOnly}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  </label>
)

interface LabeledReadonlyProps {
  label: string
  value: string
}

const LabeledReadonly = ({ label, value }: LabeledReadonlyProps) => (
  <div className="flex flex-1 flex-col gap-1 text-sm">
    <span className="text-ui-05">{label}</span>
    <span className="rounded-md border border-ui-03 bg-ui-02 px-3 py-1.5 text-ui-06">
      {value}
    </span>
  </div>
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
