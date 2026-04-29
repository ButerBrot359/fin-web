import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTabMeta } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'

import { useInformationRegisterType } from '../lib/hooks/use-information-register-type'
import { InformationRegisterTable } from './information-register-table'

export const InformationRegisterPage = () => {
  const navigate = useNavigate()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'INFORMATION_REGISTER'

  const { title, attributes, isLoading } = useInformationRegisterType(
    domain,
    moduleCode
  )
  useTabMeta(title)

  const handleClose = () => {
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoading) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <InformationRegisterTable attributes={attributes} domain={domain} />
    </div>
  )
}
