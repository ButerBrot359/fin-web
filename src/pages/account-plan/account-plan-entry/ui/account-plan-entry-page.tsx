import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import {
  useAccountPlanItem,
  useSubcontoTypes,
} from '@/entities/account-plan'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import {
  AccountPlanCard,
  AccountPlanCardActions,
  type AccountPlanCardValue,
} from './account-plan-card'
import { useAccountPlanFormModeStore } from '../lib/hooks/use-account-plan-form-mode-store'
import { useAccountPlanEntryActions } from '../lib/hooks/use-account-plan-entry-actions'
import { buildAccountPlanPayload } from '../lib/utils/build-payload'

const EMPTY_VALUE: AccountPlanCardValue = {
  code: '',
  nameRu: '',
  nameKz: '',
  accountType: 'ACTIVE',
  isCurrency: false,
  isQuantitative: false,
  isOffBalance: false,
  parentId: null,
  subcontoList: [],
}

/**
 * При копировании счёта оставляем все «учётные» поля, но обнуляем
 * `code` и `parentId` — копия не должна занимать тот же код, что и
 * исходник, и обычно создаётся на верхнем уровне.
 */
const copyValue = (src: AccountPlanCardValue): AccountPlanCardValue => ({
  ...src,
  code: '',
  parentId: null,
})

export const AccountPlanEntryPage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '', moduleCode = '', entryId } = useParams()
  const [searchParams] = useSearchParams()
  const copyFromId = searchParams.get('copyFrom')

  const isNew = !entryId
  const listPath = `/modules/${pageCode}/accountplan/${moduleCode}`

  const modeStore = useAccountPlanFormModeStore()
  const mode = modeStore.getMode(location.pathname, isNew ? 'edit' : 'view')
  const isReadOnly = mode === 'view'

  const { account, isLoading } = useAccountPlanItem(entryId)
  const { account: copyFromAccount, isLoading: isLoadingCopy } =
    useAccountPlanItem(isNew && copyFromId ? copyFromId : null)
  const { subcontoTypes } = useSubcontoTypes()

  const [value, setValue] = useState<AccountPlanCardValue>(EMPTY_VALUE)

  // Заполняем форму из редактируемой записи или копируемой.
  useEffect(() => {
    const src = account ?? copyFromAccount
    if (!src) return
    const next: AccountPlanCardValue = {
      code: src.code,
      nameRu: src.nameRu,
      nameKz: src.nameKz,
      accountType: src.accountType,
      isCurrency: src.isCurrency,
      isQuantitative: src.isQuantitative,
      isOffBalance: src.isOffBalance,
      parentId: src.parentId,
      subcontoList: src.subcontoList ?? [],
    }
    setValue(isNew && copyFromAccount ? copyValue(next) : next)
  }, [account, copyFromAccount, isNew])

  const title = isNew
    ? t('accountPlan.newTitle')
    : account
      ? getLocalizedName(account, i18n.language) || account.code
      : t('accountPlan.title')

  useTabMeta(title)

  const { createMutation, updateMutation, isSaving } =
    useAccountPlanEntryActions({
      entryId,
      onCreated: (id) => {
        modeStore.setMode(location.pathname, 'view')
        void navigate(`${listPath}/${String(id)}`, { replace: true })
      },
      onUpdated: () => {
        modeStore.setMode(location.pathname, 'view')
      },
    })

  const handleSave = () => {
    const payload = buildAccountPlanPayload(value)
    if (isNew) {
      createMutation.mutate(payload)
    } else {
      updateMutation.mutate(payload)
    }
  }

  const handleEdit = () => {
    modeStore.setMode(location.pathname, 'edit')
  }

  const handleCancel = () => {
    if (account) {
      setValue({
        code: account.code,
        nameRu: account.nameRu,
        nameKz: account.nameKz,
        accountType: account.accountType,
        isCurrency: account.isCurrency,
        isQuantitative: account.isQuantitative,
        isOffBalance: account.isOffBalance,
        parentId: account.parentId,
        subcontoList: account.subcontoList ?? [],
      })
    }
    modeStore.setMode(location.pathname, 'view')
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(listPath)
  }

  const isBusy = isLoading || isLoadingCopy

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <div className="flex items-center justify-between pb-3">
        <AccountPlanCardActions
          isNew={isNew}
          isReadOnly={isReadOnly}
          isSaving={isSaving}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {isBusy ? (
          <div className="flex flex-col gap-3">
            <ShimmerBlock className="h-12 w-1/3" />
            <ShimmerBlock className="h-12 w-1/2" />
            <ShimmerBlock className="h-12 w-2/5" />
          </div>
        ) : (
          <AccountPlanCard
            value={value}
            subcontoTypes={subcontoTypes}
            isReadOnly={isReadOnly}
            onChange={setValue}
          />
        )}
      </div>
    </div>
  )
}
