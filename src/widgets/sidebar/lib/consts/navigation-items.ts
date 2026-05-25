import type { FC, SVGProps } from 'react'

import MainIcon from '@/shared/assets/navigation/main.svg'
import BankIcon from '@/shared/assets/navigation/bank.svg'
import WarehouseIcon from '@/shared/assets/navigation/warehouse.svg'
import ActivesIcon from '@/shared/assets/navigation/actives.svg'
import TarifsIcon from '@/shared/assets/navigation/tarifs.svg'
import SalaryIcon from '@/shared/assets/navigation/salary.svg'
import ReportIcon from '@/shared/assets/navigation/report.svg'
import OurCompanyIcon from '@/shared/assets/navigation/our-company.svg'
import FlkIcon from '@/shared/assets/navigation/flk.svg'
import RegulatedFinReportIcon from '@/shared/assets/navigation/regulated-fin-report.svg'

import type { NavigationItem } from '../../types/types'

export const ICON_MAP: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  bank: BankIcon,
  warehouse: WarehouseIcon,
  actives: ActivesIcon,
  tariffs: TarifsIcon,
  salary: SalaryIcon,
  reports: ReportIcon,
  'our-company': OurCompanyIcon,
  flk: FlkIcon,
  'regulated-fin-report': RegulatedFinReportIcon,
  admin: RegulatedFinReportIcon,
}

export const FALLBACK_ICON = MainIcon

export const MAIN_NAV_ITEM: NavigationItem = {
  id: 'main',
  label: 'sidebar.nav.main',
  icon: MainIcon,
  path: '/',
}
