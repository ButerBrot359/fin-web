import { useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { SduiScreen } from '@/features/sdui'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { useUniversalDomainType } from '../../universal-domain-list'

/**
 * SDUI-карточка записи универсального домена (SCRUM-388, ADR-0048 Tier R):
 * CALCULATION_PLAN «Виды начислений/удержаний организации» и будущие домены
 * без выделенной страницы. Маршрут — модульный, той же формы, что список
 * (`…/calculationplan/:moduleCode/:entryId?domain=…`): бэк резолвит его в
 * OPEN напрямую, отдельный плоский route не нужен.
 *
 * Read-only обеспечивает бэк (save-кнопки не эмитятся в Tier R), поэтому
 * диалога «Сохранить изменения?» здесь нет. Редактируемые ТЧ Фазы 2
 * персистятся сами table-level EVENT'ами (ADR-0049) — карточного save тоже
 * не требуют.
 *
 * Легаси-фолбэка у универсального домена нет: пока бэк-гейт выключен
 * (`sdui.object-form.enabled-domains` пуст / new_view=false) или OPEN отвечает
 * 422 — показываем нейтральное сообщение, не белый экран.
 */
export const UniversalDomainEntryPage = () => {
  const { pageCode = '', moduleCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'CALCULATION_PLAN'
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const {
    title: typeTitle,
    newView,
    isLoading,
  } = useUniversalDomainType(domain, moduleCode)
  const [sduiFailed, setSduiFailed] = useState(false)

  const [tabTitle, setTabTitle] = useState('')
  useTabMeta(tabTitle || typeTitle)

  const listPath = `/modules/${pageCode}/calculationplan/${moduleCode}?domain=${domain}`

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(listPath)
  }

  const screenApi = useMemo(
    () => ({
      shouldPersistSession: (route: string) =>
        useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === route),
      onCloseAfter: (route: string) => {
        useWorkspaceTabsStore.getState().closeTab(route)
      },
      onOpenFailed: () => {
        setSduiFailed(true)
      },
    }),
    []
  )

  if (isLoading) return <PageSkeleton />

  if (!newView || sduiFailed) {
    return (
      <div className="flex h-full flex-col gap-5 pt-5">
        <PageHeader title={typeTitle} onClose={handleClose} />
        <Typography variant="body2" className="text-ui-03">
          {t('universalDomain.cardUnavailable')}
        </Typography>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={tabTitle || typeTitle} onClose={handleClose} />
      <SduiScreen {...screenApi} onTitleChange={setTabTitle} />
    </div>
  )
}
